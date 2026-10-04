"""Validate a P1 graph against the unchanged P2/P3/P4 contract.

Run from any directory: python pipeline/validate_graph.py
No network, database, or model credentials are needed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

from common import DATA_DIR, SEED_FILE, load_seed

ROOT = Path(__file__).resolve().parents[1]
FIELDS = {
    "nodes": {"id", "type", "name", "synonyms", "ext_ids", "props"},
    "edges": {"id", "src", "dst", "type", "tier", "confidence", "stance", "status", "note"},
    "evidence": {"id", "edge_id", "source_type", "source_url", "pmid", "snippet", "retrieved_at"},
    "clusters": {"id", "label", "mechanism"},
    "node_cluster": {"node_id", "cluster_id"},
}


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def valid_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password


def validate_graph(graph: dict, contract: dict | None = None) -> list[str]:
    contract = contract or json.loads((ROOT / "contract/contract.json").read_text(encoding="utf-8"))
    errors: list[str] = []
    if set(graph) != set(FIELDS):
        errors.append("Graph must contain exactly nodes, edges, evidence, clusters, node_cluster; metadata belongs in sidecars.")
    indexes: dict[str, dict] = {}
    for table, fields in FIELDS.items():
        rows = graph.get(table)
        if not isinstance(rows, list):
            errors.append(f"{table}: expected an array")
            rows = []
        indexes[table] = {}
        for i, row in enumerate(rows):
            if not isinstance(row, dict):
                errors.append(f"{table}[{i}]: expected an object")
                continue
            if set(row) != fields:
                errors.append(f"{table}[{i}]: unexpected/missing fields: {sorted(set(row) ^ fields)}")
            if table == "node_cluster":
                key = (row.get("node_id"), row.get("cluster_id"))
            else:
                key = row.get("id")
                if not isinstance(key, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_]*", key):
                    errors.append(f"{table}[{i}]: id must be a readable lowercase slug")
            try:
                if key in indexes[table]:
                    errors.append(f"{table}: duplicate id/membership {key}")
                indexes[table][key] = row
            except TypeError:
                errors.append(f"{table}[{i}]: invalid key")
    nodes, edges = indexes["nodes"], indexes["edges"]
    for n in nodes.values():
        tag = n.get("id")
        if n.get("type") not in contract["node_types"]:
            errors.append(f"{tag}: unknown node type")
        if not isinstance(n.get("name"), str) or not n["name"].strip():
            errors.append(f"{tag}: missing name")
        if not isinstance(n.get("synonyms"), list) or not all(isinstance(s, str) for s in n.get("synonyms", [])):
            errors.append(f"{tag}: synonyms must be strings")
        if not isinstance(n.get("ext_ids"), dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in (n.get("ext_ids") or {}).items()):
            errors.append(f"{tag}: ext_ids must map strings to strings (P3 compatibility)")
        if not isinstance(n.get("props"), dict):
            errors.append(f"{tag}: props must be an object")
        elif n["props"].get("placeholder"):
            errors.append(f"{tag}: placeholder node remains")
    for e in edges.values():
        tag = e.get("id")
        definition = contract["edge_types"].get(e.get("type"))
        if not definition:
            errors.append(f"{tag}: unknown edge type")
        for endpoint in ("src", "dst"):
            if e.get(endpoint) not in nodes:
                errors.append(f"{tag}: dangling {endpoint}")
        if definition and e.get("src") in nodes and e.get("dst") in nodes:
            if nodes[e["src"]]["type"] != definition["from"] or nodes[e["dst"]]["type"] != definition["to"]:
                errors.append(f"{tag}: wrong endpoint types for {e['type']}")
        if e.get("tier") not in contract["tiers"]:
            errors.append(f"{tag}: unknown evidence tier")
        for field, enum in (("stance", "stances"), ("status", "statuses")):
            if e.get(field) not in contract[enum]:
                errors.append(f"{tag}: unknown {field}")
        confidence = e.get("confidence")
        if confidence is not None and (isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not math.isfinite(confidence) or not 0 <= confidence <= 1):
            errors.append(f"{tag}: confidence must be null or a finite number between 0 and 1")
        if e.get("note") is not None and not isinstance(e["note"], str):
            errors.append(f"{tag}: note must be string or null")
        if e.get("tier") == "C" and e.get("status") == "verified":
            errors.append(f"{tag}: an inferred hypothesis must not be marked verified")
    evidence_counts: Counter = Counter()
    for ev in indexes["evidence"].values():
        tag = ev.get("id")
        if ev.get("edge_id") not in edges:
            errors.append(f"{tag}: dangling edge_id")
        evidence_counts[ev.get("edge_id")] += 1
        if not valid_url(ev.get("source_url")):
            errors.append(f"{tag}: missing/invalid HTTPS source URL")
        if not ev.get("source_type") or ev.get("source_type") == "placeholder":
            errors.append(f"{tag}: missing/placeholder source type")
        if not isinstance(ev.get("snippet"), str) or not ev["snippet"].strip():
            errors.append(f"{tag}: missing evidence snippet")
        if ev.get("pmid") is not None and (not isinstance(ev["pmid"], str) or not re.fullmatch(r"[0-9]+", ev["pmid"])):
            errors.append(f"{tag}: PMID must be a numeric string or null")
        try:
            date = dt.date.fromisoformat(ev.get("retrieved_at", ""))
            if date > dt.datetime.now(dt.timezone.utc).date():
                errors.append(f"{tag}: retrieval date is in the future")
        except (TypeError, ValueError):
            errors.append(f"{tag}: retrieved_at must be YYYY-MM-DD for the SQL date column")
    errors.extend(f"{eid}: edge has no evidence" for eid in edges if not evidence_counts[eid])
    for row in indexes["node_cluster"].values():
        if row.get("node_id") not in nodes or row.get("cluster_id") not in indexes["clusters"]:
            errors.append(f"Invalid cluster membership: {row}")
    for c in indexes["clusters"].values():
        if not isinstance(c.get("mechanism"), dict) or not isinstance(c.get("label"), str):
            errors.append(f"{c.get('id')}: invalid cluster metadata")
    return errors


def validate_provenance(graph: dict, provenance: dict, data_dir: Path = DATA_DIR, check_raw: bool = False) -> list[str]:
    """Bind the delivered graph to reviewed source records and optional raw caches."""
    errors = []
    if provenance.get("graph_sha256") != digest(graph):
        errors.append("Provenance graph digest does not match graph.json; rebuild or re-review changed edges.")
    audit = provenance.get("evidence", {})
    loaded = {}
    for relative, expected in provenance.get("curation_inputs", {}).items():
        path = (data_dir / relative).resolve()
        if not path.is_relative_to(data_dir.resolve()) or not path.is_file():
            errors.append(f"Missing or invalid curation input {relative}")
        elif digest(json.loads(path.read_text(encoding="utf-8"))) != expected:
            errors.append(f"Curation input changed: {relative}; rebuild and review the release.")
    # Identity-only variants may have no functional edge. Audit their original
    # ClinVar records as well as edge evidence so they cannot escape raw checks.
    nodes = {n["id"]: n for n in graph.get("nodes", [])}
    for node in nodes.values():
        if node.get("type") != "variant" or not ({"ClinVar", "ClinVarVariation"} & node.get("ext_ids", {}).keys()):
            continue
        binding = provenance.get("nodes", {}).get(node["id"], {})
        source = binding.get("source_record", {})
        record = source.get("source_record", {})
        tag = node["id"]
        if not source or not record:
            errors.append(f"{tag}: missing ClinVar identity provenance")
            continue
        if binding.get("curation_file") not in provenance.get("curation_inputs", {}):
            errors.append(f"{tag}: missing reviewed curation binding")
        if not valid_url(source.get("source_url")) or not source.get("source_record_locator"):
            errors.append(f"{tag}: invalid ClinVar source locator")
        if source.get("record_sha256") != digest(record):
            errors.append(f"{tag}: ClinVar source record digest mismatch")
        if (str(record.get("uid")) != node["ext_ids"].get("ClinVarVariation")
                or record.get("accession_version") != node["ext_ids"].get("ClinVar")
                or record.get("title") != node.get("name")):
            errors.append(f"{tag}: ClinVar node identity differs from the reviewed record")
        props = node.get("props", {})
        classification = record.get("germline_classification", {})
        for key, expected in (("classification", classification.get("description", "")),
                              ("review_status", classification.get("review_status", "")),
                              ("last_evaluated", classification.get("last_evaluated", "")),
                              ("molecular_consequences", record.get("molecular_consequence_list", []))):
            if key in props and props[key] != expected:
                errors.append(f"{tag}: ClinVar clinical property {key} differs from the reviewed record")
        gene = nodes.get(props.get("gene_id"), {})
        gene_ids = {str(g.get("geneid")) for g in record.get("genes", [])}
        if gene.get("type") != "gene" or gene.get("ext_ids", {}).get("NCBIGene") not in gene_ids:
            errors.append(f"{tag}: ClinVar gene identity mismatch")
        if props.get("effect") not in (None, "", "unknown"):
            claimed = set(props.get("effect_evidence_edge_ids", []))
            supporting = {e["id"] for e in graph.get("edges", [])
                          if e.get("src") == tag and e.get("type") == "gene_variant_mechanism"
                          and e.get("stance") == "supports" and e.get("status") == "verified"
                          and e.get("tier") in {"A", "B"}
                          and nodes.get(e.get("dst"), {}).get("type") == "mechanism"
                          and nodes.get(e.get("dst"), {}).get("props", {}).get("effect") == props["effect"]}
            if not claimed or not claimed <= supporting:
                errors.append(f"{tag}: functional effect lacks referenced, matching source-backed mechanism edges")
        if check_raw:
            relative = source.get("cache_path", "")
            path = (data_dir / relative).resolve()
            if not relative or not path.is_relative_to(data_dir.resolve()) or not path.is_file():
                errors.append(f"{tag}: missing or invalid ClinVar raw cache")
                continue
            body = path.read_bytes()
            if (not re.fullmatch(r"[0-9a-f]{64}", source.get("raw_sha256", ""))
                    or hashlib.sha256(body).hexdigest() != source["raw_sha256"]):
                errors.append(f"{tag}: ClinVar raw cache digest mismatch")
            try:
                original = json.loads(body)
                locator = source["source_record_locator"].split(".")
                for key in locator:
                    original = original[key]
                if digest(original) != source["record_sha256"]:
                    errors.append(f"{tag}: ClinVar raw record differs from the reviewed identity")
            except (ValueError, KeyError, TypeError):
                errors.append(f"{tag}: invalid ClinVar raw record locator")
    for ev in graph.get("evidence", []):
        p = audit.get(ev["id"])
        if not p:
            errors.append(f"{ev['id']}: missing provenance record")
            continue
        if p.get("evidence_sha256") != digest(ev):
            errors.append(f"{ev['id']}: evidence changed after review")
        if not p.get("curation_file") or not p.get("source_url") == ev["source_url"]:
            errors.append(f"{ev['id']}: source/curation provenance is missing or inconsistent")
        if p.get("source_record") is not None and p.get("record_sha256") != digest(p["source_record"]):
            errors.append(f"{ev['id']}: curated source record digest mismatch")
        if check_raw:
            paths = p.get("raw_checks", [])
            if not paths:
                errors.append(f"{ev['id']}: no raw verification locator")
            for check in paths:
                if not re.fullmatch(r"[0-9a-f]{64}", check.get("sha256", "")):
                    errors.append(f"{ev['id']}: raw check requires a SHA-256 digest")
                path = (data_dir / check["path"]).resolve()
                if not path.is_relative_to(data_dir.resolve()):
                    errors.append(f"{ev['id']}: raw path escapes DATA_DIR")
                    continue
                if not path.is_file():
                    errors.append(f"{ev['id']}: missing raw cache {check['path']}")
                    continue
                if path not in loaded:
                    loaded[path] = path.read_bytes()
                body = loaded[path]
                if check.get("sha256") and hashlib.sha256(body).hexdigest() != check["sha256"]:
                    errors.append(f"{ev['id']}: raw cache digest mismatch {check['path']}")
                if check.get("contains"):
                    text = body.decode("utf-8-sig")
                    candidates = [text]
                    if path.suffix == ".json":
                        def strings(obj):
                            if isinstance(obj, str):
                                yield obj
                            elif isinstance(obj, dict):
                                for value in obj.values():
                                    yield from strings(value)
                            elif isinstance(obj, list):
                                for value in obj:
                                    yield from strings(value)
                        candidates.extend(strings(json.loads(text)))
                    for needle in check["contains"]:
                        if not any(needle in candidate for candidate in candidates):
                            errors.append(f"{ev['id']}: source text/record no longer contains reviewed evidence")
    return errors


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--graph", type=Path, default=SEED_FILE)
    ap.add_argument("--provenance", type=Path)
    ap.add_argument("--check-raw", action="store_true")
    args = ap.parse_args()
    graph = load_seed(args.graph)
    errors = validate_graph(graph)
    path = args.provenance or args.graph.with_name("provenance.json")
    if path.exists():
        errors += validate_provenance(graph, json.loads(path.read_text(encoding="utf-8")), check_raw=args.check_raw)
    elif args.check_raw or args.provenance:
        errors.append(f"Missing provenance file: {path}")
    if errors:
        raise SystemExit("Validation failed:\n" + "\n".join(f"- {e}" for e in errors))
    print("Valid graph: " + ", ".join(f"{len(graph[k])} {k}" for k in FIELDS))
    if args.check_raw:
        print("All evidence raw-cache checks passed.")


if __name__ == "__main__":
    main()
