"""Cluster diseases by shared mechanism, refined by shared phenotype (not by name or gene).

    python cluster.py            # prints clusters, writes data/seed/clusters.generated.json

Mechanism overlap is what forms a cluster edge at all (weight 3 per shared mechanism node).
Phenotype overlap (weight 1 per shared HPO node) only adds to an edge that mechanism already
created -- it never connects two diseases on its own. Generic DEE symptoms (seizures,
developmental delay, hypotonia...) are shared by nearly everything in this slice, so letting
phenotype alone form edges lumps mechanistically unrelated diseases (e.g. KCNQ2 and STXBP1)
into one cluster with no real shared mechanism. Requiring a mechanism edge first keeps the
same-gene-family, different-mechanism counterexample (SCN2A loss-of-function vs. the
sodium-channel gain-of-function cluster) in two separate clusters, as the demo needs.
Contradicting disease_mechanism edges are excluded from clustering but reported separately,
so the counterexample's contradicting edge stays visible rather than silently dropped.
Owner: P2.
"""
from collections import defaultdict
from itertools import combinations

import networkx as nx

from common import DATA_DIR, load_seed, save_json

W_MECHANISM, W_PHENOTYPE = 3, 1


def cluster(seed: dict) -> list[dict]:
    types = {n["id"]: n["type"] for n in seed["nodes"]}
    names = {n["id"]: n["name"] for n in seed["nodes"]}
    links = defaultdict(lambda: defaultdict(set))  # disease -> kind -> {target ids}
    contradictions = []
    for e in seed["edges"]:
        if e["type"] == "disease_mechanism" and e["stance"] == "contradicts":
            contradictions.append({"disease": names.get(e["src"], e["src"]), "mechanism": names.get(e["dst"], e["dst"]), "edge_id": e["id"]})
            continue
        if e["stance"] == "contradicts":
            continue
        if e["type"] == "disease_mechanism":
            links[e["src"]]["mech"].add(e["dst"])
        elif e["type"] == "disease_phenotype":
            links[e["src"]]["pheno"].add(e["dst"])

    diseases = [i for i, t in types.items() if t == "disease"]
    g = nx.Graph()
    g.add_nodes_from(diseases)
    for a, b in combinations(diseases, 2):
        mech_overlap = len(links[a]["mech"] & links[b]["mech"])
        if not mech_overlap:
            continue  # phenotype alone never forms a cluster edge; see module docstring
        pheno_overlap = len(links[a]["pheno"] & links[b]["pheno"])
        g.add_edge(a, b, weight=W_MECHANISM * mech_overlap + W_PHENOTYPE * pheno_overlap)

    out = []
    for i, members in enumerate(nx.community.louvain_communities(g, weight="weight", seed=42)):
        shared = set.intersection(*[links[m]["mech"] for m in members]) if members else set()
        out.append({
            "id": f"c_{i}",
            "diseases": sorted(members),
            "label": ", ".join(sorted(names[m] for m in members)),
            "shared_mechanisms": sorted(names[s] for s in shared),
        })
    return out, contradictions


def main() -> None:
    result, contradictions = cluster(load_seed())
    for c in result:
        print(f"{c['id']}: {c['diseases']} shared mechanism: {c['shared_mechanisms'] or 'none'}")
    if contradictions:
        print("\nContradicting mechanism claims (excluded from clustering, kept visible):")
        for c in contradictions:
            print(f"  {c['disease']} contradicts {c['mechanism']} ({c['edge_id']})")
    save_json(DATA_DIR / "seed" / "clusters.generated.json", {"clusters": result, "contradictions": contradictions})


if __name__ == "__main__":
    main()
