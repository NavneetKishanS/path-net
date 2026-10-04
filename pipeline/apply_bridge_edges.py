"""Merge bridge_edges.py's proposal into data/seed/graph.json. Run by the seed owner (P1).

    python bridge_edges.py           # regenerate the proposal against the current seed
    python apply_bridge_edges.py     # merge it into data/seed/graph.json, then validate

This only ever appends edges/evidence that bridge_edges.py proposed (shares_mechanism_with,
shares_investigator) -- it does not touch nodes, clusters, or anything from merge_extracted.py
(that proposal is claims from the dev/Anthropic extraction run and should NOT go into the
real seed until a real OpenAI run replaces it -- see data/extracted/merge_proposal.json and
the P2 handoff notes).

After this runs, data/seed/provenance.json needs a provenance record for each new evidence id
(see validate_graph.py's --provenance check) -- that's P1's curation format/tooling, not
reproduced here. `python validate_graph.py` (schema only, no --provenance flag) will pass
immediately; `python validate_graph.py --provenance data/seed/provenance.json` will not, until
those records are added.
Owner: P2 (script), P1 (the file and the resulting provenance work).
"""
import sys

from common import DATA_DIR, SEED_FILE, load_seed, save_json

PROPOSAL_FILE = DATA_DIR / "seed" / "bridge_edges.generated.json"


def main() -> None:
    if not PROPOSAL_FILE.exists():
        sys.exit(f"{PROPOSAL_FILE} not found. Run bridge_edges.py first.")
    graph = load_seed(SEED_FILE)
    proposal = load_seed(PROPOSAL_FILE)
    existing_edge_ids = {e["id"] for e in graph["edges"]}
    existing_evidence_ids = {e["id"] for e in graph["evidence"]}

    new_edges = [e for e in proposal["new_edges"] if e["id"] not in existing_edge_ids]
    new_evidence = [e for e in proposal["new_evidence"] if e["id"] not in existing_evidence_ids]
    skipped = len(proposal["new_edges"]) - len(new_edges)
    if skipped:
        print(f"Skipped {skipped} edge(s) already present in the seed (already applied).")

    graph["edges"] += new_edges
    graph["evidence"] += new_evidence
    save_json(SEED_FILE, graph)
    print(f"Merged {len(new_edges)} edges and {len(new_evidence)} evidence rows into {SEED_FILE}.")
    print(f"Now: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges, {len(graph['evidence'])} evidence.")
    print("Next: python validate_graph.py (schema check, should pass now) then add provenance "
          "records for the new evidence ids before running the --provenance check.")


if __name__ == "__main__":
    main()
