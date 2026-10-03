"""Cluster diseases by shared mechanism and phenotype (not by name or gene).

    python cluster.py            # prints clusters, writes data/seed/clusters.generated.json

Weights: shared mechanism = 3, shared phenotype = 1. Then Louvain community detection.
Owner: P2. Extend with HPO term overlap, shared investigators, and contradicting edges.
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
    for e in seed["edges"]:
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
        w = W_MECHANISM * len(links[a]["mech"] & links[b]["mech"]) + W_PHENOTYPE * len(links[a]["pheno"] & links[b]["pheno"])
        if w:
            g.add_edge(a, b, weight=w)

    out = []
    for i, members in enumerate(nx.community.louvain_communities(g, weight="weight", seed=42)):
        shared = set.intersection(*[links[m]["mech"] for m in members]) if members else set()
        out.append({
            "id": f"c_{i}",
            "diseases": sorted(members),
            "label": ", ".join(sorted(names[m] for m in members)),
            "shared_mechanisms": sorted(names[s] for s in shared),
        })
    return out


def main() -> None:
    result = cluster(load_seed())
    for c in result:
        print(f"{c['id']}: {c['diseases']} shared mechanism: {c['shared_mechanisms'] or 'none'}")
    save_json(DATA_DIR / "seed" / "clusters.generated.json", result)


if __name__ == "__main__":
    main()
