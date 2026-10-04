"""Independently compare this candidate against the frozen working-tree baseline.

No network or database connection. Frozen baseline receipts are retained under
data/acceptance/expansion. A missing source checkout is reported, not invented.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

from common import DATA_DIR, save_json
from validate_graph import digest, validate_graph, validate_provenance

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_CHANGED = {
    "pipeline/build_graph.py", "pipeline/fetch_slice.py",
    "pipeline/tests/test_release.py", "pipeline/tests/test_funding_projection.py",
    "data/curation/coverage_inventory.json", "data/seed/graph.json",
    "data/seed/provenance.json", "data/seed/coverage.json",
    "data/seed/demo_paths.json", "data/seed/funding_overlap.json",
}
ALLOWED_ADDED = {
    "pipeline/expand_slice.py", "pipeline/verify_expansion.py", "pipeline/tests/test_expansion.py",
    "pipeline/tests/check_expansion_database.py", "pipeline/tests/check_expansion_consumers.mjs",
    "data/curation/expansion.json", "data/curation/expansion_selection.json", "context/P1-EXPANSION.md",
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def check_candidate(source_root: Path | None = None, data_only: bool = False):
    receipt_dir = DATA_DIR / "acceptance/expansion"
    baseline = json.loads((receipt_dir / "baseline.json").read_text(encoding="utf-8"))
    original = json.loads((receipt_dir / "baseline_graph.json").read_text(encoding="utf-8"))
    graph = json.loads((DATA_DIR / "seed/graph.json").read_text(encoding="utf-8"))
    provenance = json.loads((DATA_DIR / "seed/provenance.json").read_text(encoding="utf-8"))
    selection = json.loads((DATA_DIR / "curation/expansion_selection.json").read_text(encoding="utf-8"))
    errors = validate_graph(graph) + validate_provenance(graph, provenance, DATA_DIR, check_raw=True)
    if digest(original) != selection["baseline_graph_sha256"]:
        errors.append("Frozen baseline graph differs from the reviewed selection")
    source = (source_root or Path(baseline["source"])).resolve()
    source_checked = source.is_dir() and not data_only
    changed = []
    for relative, record in baseline["files"].items():
        if data_only and not relative.startswith("data/raw/"):
            continue
        actual = sha(ROOT / relative)
        if actual != record["sha256"]:
            changed.append(relative)
            if relative not in ALLOWED_CHANGED or actual is None:
                errors.append(f"Protected candidate file changed or missing: {relative}")
        if source_checked and sha(source / relative) != record["sha256"]:
            errors.append(f"Original source working tree changed: {relative}")
    added = []
    for path in ([] if data_only else sorted(ROOT.rglob("*"))):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if any(part in {".runtime", "__pycache__", "node_modules", ".git"} for part in path.relative_to(ROOT).parts):
            continue
        if relative not in baseline["files"]:
            added.append(relative)
            if relative not in ALLOWED_ADDED and not relative.startswith(("data/acceptance/expansion/", "output/")):
                errors.append(f"Unexpected added candidate file: {relative}")
    retained = {}
    for table, rows in original.items():
        key = lambda row: row["id"] if "id" in row else (row["node_id"], row["cluster_id"])
        actual = {key(row): row for row in graph[table]}
        retained[table] = sum(actual.get(key(row)) == row for row in rows)
        if retained[table] != len(rows):
            errors.append(f"Original records changed/removed in {table}")
    if graph["clusters"] != original["clusters"]:
        errors.append("Original clusters were changed")
    return {"status": "passed" if not errors else "failed",
            "scope": "Published graph/provenance/raw integrity; working-tree boundaries not checked" if data_only else "Frozen candidate and source working-tree boundaries",
            "source_checkout_checked": source_checked,
            "source_checkout": str(source), "baseline_counts": {t: len(v) for t, v in original.items()},
            "candidate_counts": {t: len(v) for t, v in graph.items()}, "retained_exact_records": retained,
            "graph_file_sha256": sha(DATA_DIR / "seed/graph.json"), "graph_sha256": digest(graph),
            "changed_files": sorted(changed), "added_files": added, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path)
    parser.add_argument("--data-only", action="store_true", help="Check published graph, provenance, original rows and raw hashes without requiring the original working-tree layout")
    args = parser.parse_args()
    report = check_candidate(args.source_root, data_only=args.data_only)
    report_name = "published-data-integrity.json" if args.data_only else "boundaries.json"
    save_json(DATA_DIR / "acceptance/expansion" / report_name, report)
    print(json.dumps({k: report[k] for k in ("status", "source_checkout_checked", "baseline_counts", "candidate_counts", "retained_exact_records", "errors")}))
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
