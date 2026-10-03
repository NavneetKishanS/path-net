"""Return evidence-bounded coverage information for P4's no-route response.

This is a read-only handoff helper, not a replacement for P3's loadGraph().
Unknown queries describe a gap in this selected slice, never absence of research.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import DATA_DIR, SEED_FILE, load_seed


def coverage_report(query: str, graph: dict, coverage: dict | None = None) -> dict:
    q = " ".join(query.strip().casefold().split())
    def labels(node):
        return [node["name"], *node["synonyms"], *node["ext_ids"].values()]
    exact = [n for n in graph["nodes"] if q and q in [s.casefold() for s in labels(n)]]
    matches = exact or [n for n in graph["nodes"] if q and any(q in s.casefold() for s in labels(n))]
    ids = {n["id"] for n in matches}
    evidence_edges = {e["edge_id"] for e in graph["evidence"] if e.get("source_url") and e.get("snippet")}
    edges = [e for e in graph["edges"] if (e["src"] in ids or e["dst"] in ids) and e["stance"] == "supports" and e["status"] == "verified" and e["tier"] in {"A", "B"} and e["id"] in evidence_edges]
    supported = bool(edges)
    return {
        "query": query, "status": "matches_with_supported_connections" if supported else "no_supported_route",
        "matched_node_ids": sorted(ids), "supported_edge_ids": sorted(e["id"] for e in edges),
        "searched": ["Names, exact synonyms, and stable external identifiers in the committed P1 slice", "Direct verified A/B relationships with source evidence; contradictory, rejected, and inferred edges excluded"],
        "missing": [] if supported else ["No supported connection for this query was found in the selected slice."],
        "next_steps": ["Review the cited relationship scopes before choosing a study or reusable resource."] if supported else ["Check spelling and resolve the term against MONDO/HGNC/HPO.", "Search the relevant official literature, trial and patient-organization sources; record coverage before adding a relationship."],
        "limitations": ["A coverage gap does not mean that no research, patient group or treatment exists.", "Source-backed connections do not establish clinical eligibility, treatment benefit, or equivalence between diseases."],
        "coverage": coverage or {},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("query")
    ap.add_argument("--graph", type=Path, default=SEED_FILE)
    args = ap.parse_args()
    path = DATA_DIR / "seed/coverage.json"
    coverage = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    print(json.dumps(coverage_report(args.query, load_seed(args.graph), coverage), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
