"""Propose tier-C disease<->disease bridge edges: shared mechanism, shared investigator.

    python bridge_edges.py            # every disease pair; prints + writes a proposal

Two kinds, matching contract.json's edge_types:
  shares_mechanism_with  both diseases have a verified, supporting disease_mechanism edge
                          to the same mechanism node (the same signal cluster.py uses to
                          group them -- this makes that grouping walkable as real edges).
  shares_investigator     both diseases have a verified, supporting investigator_disease
                          edge to the same person (NIH-award co-coverage, not shared biology).

Confidence rule (deterministic, not model-scored -- these are graph inferences, not claims
from text): Jaccard overlap of each disease's full set of mechanism (or investigator) links,
clamped to [0.05, 0.95]. Two diseases that share one mechanism out of five each is a weaker
bridge than two diseases whose only mechanism is the shared one; Jaccard captures that where
a raw shared-count would not. The clamp keeps a tier-C hypothesis from ever reading as certain
(and avoids rounding to exactly 0 or 1, which would be an obviously-fabricated precision).

Every evidence row reuses a real source_url already in the seed (the contributing
disease_mechanism or investigator_disease edge's own evidence) -- nothing is invented, and the
snippet is clearly framed as a derivation, not a quote. Tier is always C, status "unverified"
(validate_graph.py forbids tier C + verified), stance "supports".

Does NOT touch data/seed/graph.json (P1's file). Writes a review proposal:
    data/seed/bridge_edges.generated.json
Owner: P2.
"""
import itertools
import re

from cluster import build_links
from common import DATA_DIR, load_seed, save_json

CONF_FLOOR, CONF_CEILING = 0.05, 0.95


def jaccard(a: set, b: set) -> float:
    union = a | b
    return len(a & b) / len(union) if union else 0.0


def confidence(a: set, b: set) -> float:
    return round(min(CONF_CEILING, max(CONF_FLOOR, jaccard(a, b))), 2)


def slugify(s: str, max_len: int = 48) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")[:max_len].strip("_") or "x"


def propose(seed: dict) -> dict:
    nodes = {n["id"]: n for n in seed["nodes"]}
    names = {i: n["name"] for i, n in nodes.items()}
    links, _ = build_links(seed)
    evidence_by_edge: dict[str, list[dict]] = {}
    for ev in seed["evidence"]:
        evidence_by_edge.setdefault(ev["edge_id"], []).append(ev)
    edge_by_src_dst_type = {(e["src"], e["dst"], e["type"]): e for e in seed["edges"]}
    existing = {(e["src"], e["dst"]) for e in seed["edges"] if e["type"] in ("shares_mechanism_with", "shares_investigator")}
    existing |= {(b, a) for a, b in existing}

    diseases = sorted(i for i, n in nodes.items() if n["type"] == "disease")
    new_edges, new_evidence = [], []

    def contributing_evidence(disease_id: str, target_type: str, target_id: str) -> list[dict]:
        edge_type = "disease_mechanism" if target_type == "mech" else "investigator_disease"
        src, dst = (disease_id, target_id) if edge_type == "disease_mechanism" else (target_id, disease_id)
        edge = edge_by_src_dst_type.get((src, dst, edge_type))
        return evidence_by_edge.get(edge["id"], []) if edge else []

    for kind, edge_type, label in (("mech", "shares_mechanism_with", "mechanism"), ("investigator", "shares_investigator", "investigator")):
        for a, b in itertools.combinations(diseases, 2):
            if (a, b) in existing:
                continue
            shared = links[a][kind] & links[b][kind]
            if not shared:
                continue
            conf = confidence(links[a][kind], links[b][kind])
            edge_id = slugify(f"bridge_{edge_type}_{a}_{b}", max_len=60)
            shared_names = ", ".join(sorted(names.get(s, s) for s in shared))
            new_edges.append({
                "id": edge_id, "src": a, "dst": b, "type": edge_type, "tier": "C",
                "confidence": conf, "stance": "supports", "status": "unverified",
                "note": f"Inferred (Jaccard {conf}): both diseases have a verified {label} link to {shared_names}. A hypothesis to check, not a proven shared biology.",
            })
            seen_urls = set()
            i = 0
            for target_id in sorted(shared):
                for disease_id, other_id in ((a, b), (b, a)):
                    for ev in contributing_evidence(disease_id, kind, target_id):
                        key = (ev["source_url"], ev.get("pmid"))
                        if key in seen_urls:
                            continue
                        seen_urls.add(key)
                        new_evidence.append({
                            "id": f"{edge_id}_ev{i}",
                            "edge_id": edge_id, "source_type": "inferred", "source_url": ev["source_url"],
                            "pmid": ev.get("pmid"), "retrieved_at": ev["retrieved_at"],
                            "snippet": f"Derived from {names[disease_id]}'s existing {label} link to {names.get(target_id, target_id)}, "
                                       f"shared with {names[other_id]}.",
                        })
                        i += 1

    return {"new_edges": new_edges, "new_evidence": new_evidence}


def main() -> None:
    seed = load_seed()
    proposal = propose(seed)
    for e in proposal["new_edges"]:
        print(f"{e['type']}: {e['src']} <-> {e['dst']} (confidence {e['confidence']})")
    print(f"\n{len(proposal['new_edges'])} bridge edges, {len(proposal['new_evidence'])} evidence rows proposed.")
    out = DATA_DIR / "seed" / "bridge_edges.generated.json"
    save_json(out, proposal)
    print(f"Written to {out}. Does not touch data/seed/graph.json -- review before merging with P1.")


if __name__ == "__main__":
    main()
