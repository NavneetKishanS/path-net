"""Audit the existing P1 cache once, offline, without changing source bytes.

    python pipeline/audit_cache.py --report data/acceptance/cache-audit.json

Reports are restricted to DATA_DIR/acceptance. Suspected secret files are named
and sized but never opened, hashed or copied into the report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath

from common import DATA_DIR, save_json
from restore_pubmed import content_digest
from validate_graph import digest, validate_graph, validate_provenance

HOUSEKEEPING = {"raw/.gitkeep", "raw/groups/curate_community.py"}
PATH_HASH_KEYS = {"cache_path": "raw_sha256", "body_path": "body_sha256",
                  "text_path": "text_sha256", "raw_path": "raw_sha256",
                  "original_cache_path": None, "path": "sha256"}
PUBMED_FIELDS = {"pmid", "title", "abstract", "authors", "url", "retrieved_at"}


def file_kind(relative: str) -> str:
    parts = Path(relative).parts
    name = parts[-1].lower()
    if (name == ".env" or name.startswith(".env.") or
            re.search(r"(^|[._-])(credentials?|secrets?|api[_-]?keys?|tokens?)([._-]|$)", name) or
            Path(name).suffix in {".pem", ".key", ".p12", ".pfx", ".kdbx"}):
        return "suspected_secret"
    if relative in HOUSEKEEPING or name == ".gitkeep":
        return "housekeeping"
    if (set(p.lower() for p in parts) & {"__pycache__", ".venv", "node_modules", "tmp", "temp", ".pytest_cache"}
            or name.endswith((".tmp", ".temp", ".pyc", ".pyo", ".log", ".lock", ".sqlite", ".db", "~"))
            or name in {".ds_store", "thumbs.db"}):
        return "runtime"
    return "data"


def linked(path: Path) -> bool:
    return path.is_symlink() or getattr(path, "is_junction", lambda: False)()


def safe_raw_path(data_dir: Path, value: str) -> Path:
    normalized = value.replace("\\", "/")
    if not normalized.startswith("raw/") or PureWindowsPath(value).drive or ".." in Path(normalized).parts:
        raise ValueError("raw reference must stay within data/raw")
    path = data_dir / normalized
    if not path.resolve().is_relative_to((data_dir / "raw").resolve()):
        raise ValueError("raw reference escapes through a link")
    for parent in (path, *path.parents):
        if parent == data_dir:
            break
        if linked(parent):
            raise ValueError("raw reference traverses a symlink or junction")
    return path


def inventory_raw(data_dir: Path):
    raw = data_dir / "raw"
    rows, errors = [], []
    if not raw.is_dir() or linked(raw):
        return rows, ["Raw directory is missing or is a symlink/junction"]
    for folder, directories, files in os.walk(raw, followlinks=False):
        for name in list(directories):
            path = Path(folder) / name
            if linked(path) or not path.resolve().is_relative_to(raw.resolve()):
                directories.remove(name)
                errors.append(f"Unsafe raw directory link: {path.relative_to(data_dir).as_posix()}")
        for name in files:
            path = Path(folder) / name
            relative = path.relative_to(data_dir).as_posix()
            kind = file_kind(relative)
            row = {"path": relative, "size_bytes": path.lstat().st_size,
                   "sha256": None, "kind": kind}
            if linked(path) or not path.resolve().is_relative_to(raw.resolve()):
                row["kind"] = "unsafe_link"
                errors.append(f"Unsafe raw file link: {relative}")
            elif kind == "suspected_secret":
                row["hash_status"] = "not_read_suspected_secret"
                errors.append(f"Suspected secret file (contents not read): {relative}")
            else:
                hasher = hashlib.sha256()
                with path.open("rb") as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b""):
                        hasher.update(block)
                row["sha256"] = hasher.hexdigest()
                if kind == "runtime":
                    errors.append(f"Unexpected runtime or temporary file: {relative}")
            rows.append(row)
    return sorted(rows, key=lambda row: row["path"]), errors


def raw_references(value, origin, locator="$", references=None):
    references = [] if references is None else references
    if isinstance(value, dict):
        for key, child in value.items():
            location = f"{locator}.{key}"
            if isinstance(child, str) and (child.replace("\\", "/").startswith("raw/") or
                    key in PATH_HASH_KEYS and (key != "path" or "raw_checks" in locator)):
                hash_key = PATH_HASH_KEYS.get(key)
                references.append({"path": child, "origin": origin, "locator": location,
                                   "expected_sha256": value.get(hash_key) if hash_key else None})
            raw_references(child, origin, location, references)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            raw_references(child, origin, f"{locator}[{index}]", references)
    return references


def check_references(data_dir, inventory, references):
    indexed = {row["path"]: row for row in inventory}
    errors = []
    for ref in references:
        label = f"{ref['origin']}:{ref['locator']}"
        try:
            path = safe_raw_path(data_dir, ref["path"])
        except ValueError as exc:
            errors.append(f"{label}: {exc}")
            continue
        row = indexed.get(path.relative_to(data_dir).as_posix())
        if row is None:
            errors.append(f"{label}: missing referenced raw file {ref['path']}")
        elif row["kind"] in {"suspected_secret", "unsafe_link", "runtime"}:
            errors.append(f"{label}: reference targets an unsafe/non-source file")
        elif ref["expected_sha256"] is not None and ref["expected_sha256"] != row["sha256"]:
            errors.append(f"{label}: referenced raw SHA-256 differs for {ref['path']}")
    return errors


def audit_pinned(data_dir, source, records):
    folder, id_key, pattern = {
        "pubmed": ("raw/pubmed", "pmid", r"[1-9]\d*"),
        "clinicaltrials": ("raw/clinicaltrials/studies", "id", r"NCT\d{8}"),
        "reporter": ("raw/reporter/projects", "id", r"[1-9]\d*"),
    }[source]
    errors, checked = [], 0
    identifiers = [r.get(id_key) for r in records]
    if len(set(identifiers)) != len(identifiers):
        errors.append(f"{source}: duplicate pinned identifiers")
    for expected in records:
        identifier = expected.get(id_key)
        if not isinstance(identifier, str) or not re.fullmatch(pattern, identifier):
            errors.append(f"{source}: invalid pinned identifier")
            continue
        path = safe_raw_path(data_dir, f"{folder}/{identifier}.json")
        if not path.is_file():
            errors.append(f"{source}: missing pinned record {identifier}")
            continue
        record = json.loads(path.read_text(encoding="utf-8"))
        if source == "pubmed":
            if (set(record) != PUBMED_FIELDS
                    or any(not isinstance(record.get(key), str) or not record[key].strip()
                           for key in ("pmid", "title", "abstract", "url", "retrieved_at"))
                    or not isinstance(record.get("authors"), list)
                    or not all(isinstance(author, str) for author in record["authors"])):
                errors.append(f"pubmed: invalid six-field/nonempty-abstract record {identifier}")
                continue
            actual_id, actual_digest = record["pmid"], content_digest(record)
        elif source == "clinicaltrials":
            actual_id = record.get("protocolSection", {}).get("identificationModule", {}).get("nctId")
            actual_digest = digest(record)
        else:
            actual_id, actual_digest = str(record.get("appl_id")), digest(record)
        if actual_id != identifier or actual_digest != expected.get("content_sha256"):
            errors.append(f"{source}: pinned identity/content digest differs for {identifier}")
        else:
            checked += 1
    actual = {p.stem for p in (data_dir / folder).glob("*.json")}
    unexpected = sorted(actual - set(identifiers))
    if unexpected:
        errors.append(f"{source}: unpinned cached records: {', '.join(unexpected)}")
    return {"expected_count": len(records), "verified_count": checked,
            "unexpected_ids": unexpected,
            "record_unit": "annual NIH application records, not unique research projects" if source == "reporter" else "pinned source records",
            "errors": errors}


def audit_cache(data_dir=DATA_DIR):
    data_dir = Path(data_dir).resolve()
    inventory, errors = inventory_raw(data_dir)
    references, documents, providers = [], {}, Counter()
    inputs = sorted((data_dir / "curation").glob("*.json")) + [data_dir / "seed/graph.json", data_dir / "seed/provenance.json"]
    if (data_dir / "seed/funding_overlap.json").is_file():
        inputs.append(data_dir / "seed/funding_overlap.json")
    inputs += [data_dir / row["path"] for row in inventory if row["kind"] == "data" and row["path"].endswith(".json")]
    for path in inputs:
        relative = path.relative_to(data_dir).as_posix()
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            documents[relative] = value
            raw_references(value, relative, references=references)
            if relative.startswith("raw/") and isinstance(value, dict) and value.get("provider"):
                providers[value["provider"]] += 1
        except (OSError, ValueError) as exc:
            errors.append(f"Cannot read JSON input {relative}: {type(exc).__name__}")
    reference_errors = check_references(data_dir, inventory, references)
    errors.extend(reference_errors)
    validations = {}
    # Do not let downstream readers follow a reference that failed the path audit.
    if not errors:
        try:
            graph = documents["seed/graph.json"]
            graph_errors = validate_graph(graph) + validate_provenance(graph, documents["seed/provenance.json"], data_dir, check_raw=True)
            validations["graph_and_provenance"] = {"errors": graph_errors, "evidence_count": len(graph["evidence"])}
            errors.extend(graph_errors)
            if "seed/funding_overlap.json" in documents:
                from build_funding_projection import build_funding_projection
                projection = build_funding_projection(data_dir)
                projection_errors = [] if projection == documents["seed/funding_overlap.json"] else ["Funding projection differs from its source-bound rebuild"]
                validations["funding_projection"] = {"errors": projection_errors}
                errors.extend(projection_errors)
            from fetch_groups import validate_curation
            validations["community"] = {"verified_quotes": validate_curation(documents["curation/community.json"], data_dir / "raw")}
            for source in ("pubmed", "clinicaltrials", "reporter"):
                manifest = documents["curation/pubmed_manifest.json"] if source == "pubmed" else documents["curation/research_cache_manifest.json"]
                records = manifest["records"] if source == "pubmed" else manifest[source]
                validations[source] = audit_pinned(data_dir, source, records)
                errors.extend(validations[source]["errors"])
                if source == "pubmed" and manifest.get("record_count") != len(records):
                    errors.append("PubMed declared record_count differs from pinned membership")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"Source validation failed: {type(exc).__name__}: {exc}")
    else:
        validations["source_checks"] = {"status": "skipped_until_inventory_and_references_are_safe"}
    groups = {}
    for row in inventory:
        group = row["path"].split("/")[1] if "/" in row["path"][4:] else "root"
        counts = groups.setdefault(group, {"files": 0, "data_files": 0, "housekeeping_files": 0, "bytes": 0})
        counts["files"] += 1
        counts["bytes"] += row["size_bytes"]
        counts["data_files"] += row["kind"] == "data"
        counts["housekeeping_files"] += row["kind"] == "housekeeping"
    return {"schema_version": 1, "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "passed" if not errors else "failed", "mode": "offline_read_only",
            "summary": {"raw_files": len(inventory), "data_files": sum(r["kind"] == "data" for r in inventory),
                        "housekeeping_files": sum(r["kind"] == "housekeeping" for r in inventory),
                        "raw_bytes": sum(r["size_bytes"] for r in inventory), "reference_count": len(references),
                        "unique_referenced_files": len({r["path"] for r in references})},
            "groups": groups, "provider_metadata_records": dict(sorted(providers.items())),
            "inventory": inventory, "references": references, "validations": validations, "errors": errors}


def write_report(path, data_dir, report):
    path, allowed = Path(path).resolve(), (Path(data_dir).resolve() / "acceptance").resolve()
    if not path.is_relative_to(allowed) or path == allowed or not allowed.is_relative_to(Path(data_dir).resolve()):
        raise ValueError("Audit report must be a file under DATA_DIR/acceptance")
    save_json(path, report)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    report = audit_cache(args.data_dir)
    write_report(args.report, args.data_dir, report)
    print(json.dumps({"status": report["status"], **report["summary"], "error_count": len(report["errors"]), "report": str(args.report)}))
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
