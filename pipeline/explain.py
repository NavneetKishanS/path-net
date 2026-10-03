"""Turn an ordered list of edge ids into plain-language steps, each citing its edge id.

    python explain.py group_stxbp1_disease asset_starr_disease
    python explain.py --demo primary_journey        # read ordered_path_edge_ids from demo_paths.json
    python explain.py --demo no_route                # a demo entry with no path -> coverage report

Every step rests on a real edge that has at least one evidence row; an edge id that does not
exist, or has no evidence, is dropped rather than turned into an unsupported sentence. Tier C
(inferred) edges are phrased with "may" and flagged inferred, per the evidence-tier contract.
A contradicting edge is never phrased as positive support -- it is phrased as a contradiction.
An empty path (nothing left after dropping) returns the coverage report instead, so the no-route
fixture still gets a real answer. Owner: P2.
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from common import DATA_DIR, SEED_FILE, load_seed
from coverage_report import coverage_report

TEMPLATES = {
    "disease_gene": ("{src} is associated with variants in {dst}.", "{src} may be associated with variants in {dst}."),
    "gene_variant_mechanism": ("The {src} variant acts through {dst}.", "The {src} variant may act through {dst}."),
    "disease_mechanism": ("{src} is understood to arise through {dst}.", "{src} may arise through {dst}."),
    "disease_phenotype": ("{src} is associated with {dst}.", "{src} may be associated with {dst}."),
    "group_disease": ("{src} supports people with {dst}.", "{src} may support people with {dst}."),
    "asset_disease": ("{src} is a resource relevant to {dst}.", "{src} may be a resource relevant to {dst}."),
    "study_disease": ("{src} is studying {dst}.", "{src} may be studying {dst}."),
    "investigator_disease": ("{src} is an investigator working on {dst}.", "{src} may be an investigator working on {dst}."),
    "shares_mechanism_with": ("{src} shares a mechanism with {dst}.", "{src} may share a mechanism with {dst}."),
    "shares_investigator": ("{src} shares an investigator with {dst}.", "{src} may share an investigator with {dst}."),
}


def sentence_for(edge: dict, src: str, dst: str, inferred: bool) -> str:
    if edge["stance"] == "contradicts":
        kind = edge["type"].replace("_", " ")
        return f"Evidence contradicts a {kind} connection between {src} and {dst}."
    pair = TEMPLATES.get(edge["type"])
    if not pair:
        base = f"{src} connects to {dst} ({edge['type'].replace('_', ' ')})."
    else:
        base = (pair[1] if inferred else pair[0]).format(src=src, dst=dst)
    if inferred:
        base += " This is inferred by the graph, not yet directly confirmed."
    return base


def explain_path(edge_ids: list[str], graph: dict, query: str = "") -> dict:
    edges_by_id = {e["id"]: e for e in graph["edges"]}
    nodes_by_id = {n["id"]: n for n in graph["nodes"]}
    evidence_by_edge: dict[str, list[dict]] = defaultdict(list)
    for ev in graph["evidence"]:
        evidence_by_edge[ev["edge_id"]].append(ev)

    steps, dropped = [], []
    for eid in edge_ids:
        edge = edges_by_id.get(eid)
        if not edge:
            dropped.append({"edge_id": eid, "reason": "edge not found"})
            continue
        if edge["status"] == "rejected":
            dropped.append({"edge_id": eid, "reason": "edge rejected"})
            continue
        evs = evidence_by_edge.get(eid, [])
        if not evs:
            dropped.append({"edge_id": eid, "reason": "no evidence"})
            continue
        src = nodes_by_id.get(edge["src"], {}).get("name", edge["src"])
        dst = nodes_by_id.get(edge["dst"], {}).get("name", edge["dst"])
        inferred = edge["tier"] == "C"
        steps.append({
            "edge_id": eid,
            "text": sentence_for(edge, src, dst, inferred),
            "inferred": inferred,
            "stance": edge["stance"],
            "tier": edge["tier"],
            "evidence": [{"source_url": e["source_url"], "snippet": e["snippet"], "pmid": e.get("pmid")} for e in evs],
        })

    if not steps:
        coverage_path = DATA_DIR / "seed" / "coverage.json"
        coverage = json.loads(coverage_path.read_text(encoding="utf-8")) if coverage_path.exists() else {}
        return {"status": "empty_path", "dropped": dropped, "coverage_report": coverage_report(query, graph, coverage)}
    return {"status": "explained", "steps": steps, "dropped": dropped}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("edge_ids", nargs="*")
    ap.add_argument("--demo", help="key into data/seed/demo_paths.json to read ordered_path_edge_ids (or a query) from")
    ap.add_argument("--query", default="", help="query to use for the coverage report if the path is empty")
    ap.add_argument("--graph", type=Path, default=SEED_FILE)
    args = ap.parse_args()

    graph = load_seed(args.graph)
    edge_ids, query = args.edge_ids, args.query
    if args.demo:
        demo = json.loads((DATA_DIR / "seed" / "demo_paths.json").read_text(encoding="utf-8"))
        entry = demo.get(args.demo)
        if entry is None:
            sys.exit(f"No '{args.demo}' entry in demo_paths.json")
        edge_ids = entry.get("ordered_path_edge_ids", [])
        query = entry.get("search") or entry.get("query") or query

    print(json.dumps(explain_path(edge_ids, graph, query), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
