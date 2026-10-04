"""Deterministically build the five-table graph from reviewed compact snapshots.

No API calls. Default inputs are the committed data/curation files. Raw caches
can be audited separately with validate_graph.py --check-raw. P2 may add extracted
claims through its own reviewed merge; this command rebuilds the P1 baseline.
"""
from __future__ import annotations

import argparse
import copy
import json
from collections import defaultdict
from pathlib import Path

from common import DATA_DIR, save_json
from validate_graph import FIELDS, digest, validate_graph


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


CLUSTERS = [
    {"id": "c_stxbp1_synaptic", "label": "STXBP1: synaptic release", "mechanism": {"effect": "loss_of_function", "mechanism_ids": ["mech_stxbp1_haploinsufficiency", "mech_synaptic_release"]}},
    {"id": "c_sodium_gof", "label": "Sodium channel: gain of function", "mechanism": {"effect": "gain_of_function", "mechanism_ids": ["mech_sodium_channel_gof"]}},
    {"id": "c_scn2a_lof", "label": "SCN2A: loss of function", "mechanism": {"effect": "loss_of_function", "mechanism_ids": ["mech_scn2a_loss_of_function"]}},
    {"id": "c_kcnq2_channel", "label": "KCNQ2: reduced channel function", "mechanism": {"effect": "loss_of_function", "mechanism_ids": ["mech_kcnq2_loss_of_function", "mech_kcnq2_dominant_negative"]}},
]


def build(curation_dir: Path, include_expansion: bool = True):
    ontology = read(curation_dir / "ontology_slice.json")
    community = read(curation_dir / "community.json")
    research = read(curation_dir / "research.json")
    graph = {key: [] for key in FIELDS}
    provenance = {"schema_version": 1, "curation_inputs": {}, "nodes": {}, "evidence": {}, "sources": [], "attribution": ontology.get("attribution", [])}
    for name in ("ontology_slice.json", "community.json", "research.json", "research_selection.json", "pubmed_manifest.json", "research_cache_manifest.json", "coverage_inventory.json", "demo_spec.json"):
        provenance["curation_inputs"][f"curation/{name}"] = digest(read(curation_dir / name))
    nodes = {}

    def add_node(original, source_file):
        node = {key: copy.deepcopy(original[key]) for key in ("id", "type", "name", "synonyms", "ext_ids", "props")}
        if node["id"] in nodes:
            if node != nodes[node["id"]]:
                raise ValueError(f"Conflicting node identity: {node['id']}")
            return
        if "plain" not in node["props"]:
            if node["type"] == "gene":
                plain = f"{node['name']} is a human gene. Different changes in a gene can have different effects."
            elif node["type"] == "phenotype":
                plain = f"A recorded clinical feature: {node['name']}. A disease-level annotation does not mean every person has this feature."
            elif node["props"].get("curated_subgroup"):
                plain = node["props"]["subgroup_definition"] + ". " + node["props"]["functional_scope"] + "."
            elif node["type"] == "disease":
                plain = f"A curated condition in the {node['props'].get('gene_symbol', 'selected')} disease spectrum. Follow the evidence for each specific connection."
            elif node["type"] == "mechanism":
                plain = node["props"].get("scope", node["name"])
            elif node["type"] == "variant":
                plain = "A specific DNA change recorded in ClinVar. Clinical classification does not establish its functional effect; follow separately cited assay evidence where available."
            else:
                plain = node["props"].get("scope") or node["props"].get("reuse_status") or node["name"]
            node["props"]["plain"] = plain
        if node["type"] == "asset":
            node["props"].setdefault("kind", node["props"].get("asset_type", "research_resource"))
        if node["props"].get("url"):
            node["props"].setdefault("source_url", node["props"]["url"])
        nodes[node["id"]] = node
        provenance["nodes"][node["id"]] = {"curation_file": source_file}
        if original.get("provenance"):
            provenance["nodes"][node["id"]]["source_record"] = original["provenance"]

    for category in ("genes", "diseases", "phenotypes", "variants"):
        for node in ontology[category]:
            add_node(node, "curation/ontology_slice.json")
    for source_file, section in (("curation/community.json", community), ("curation/research.json", research)):
        for node in section["nodes"]:
            add_node(node, source_file)

    # Merge parallel curated annotations into a single semantic edge, preserving
    # each independent source row as evidence. Negation is part of the edge key.
    ontology_edges = {}
    for relation in ontology["disease_genes"] + ontology["disease_phenotypes"]:
        key = tuple(relation[k] for k in ("src", "dst", "type", "stance"))
        if key not in ontology_edges:
            edge_id = f"e_{relation['type']}_{relation['src']}_{relation['dst']}_{relation['stance']}"
            note = "Curated database association; source identity and exact ontology mappings are preserved in provenance.json."
            if relation["type"] == "disease_phenotype":
                note = "A disease-level phenotype annotation, not a statement that every affected person has this feature. See the source row for frequency, onset, and evidence code."
            if relation["stance"] == "contradicts":
                note += " The source explicitly uses the NOT qualifier; this is negative annotation evidence."
            ontology_edges[key] = {"id": edge_id, "src": relation["src"], "dst": relation["dst"], "type": relation["type"], "tier": "A", "confidence": None, "stance": relation["stance"], "status": "verified", "note": note}
        edge = ontology_edges[key]
        ev = relation["evidence"]
        eid = f"ev_{edge['id'][2:]}_{digest([ev['source_id'], ev['source_record_locator'], ev.get('record_sha256')])[:10]}"
        row = {"id": eid, "edge_id": edge["id"], "source_type": ev["source_type"], "source_url": ev["source_url"], "pmid": None, "snippet": ev["snippet"], "retrieved_at": ev["retrieved_at"][:10]}
        graph["evidence"].append(row)
        provenance["evidence"][eid] = {
            "source_url": ev["source_url"], "curation_file": "curation/ontology_slice.json", "verification": ev["snippet_kind"],
            "source_id": ev["source_id"], "source_record_locator": ev["source_record_locator"], "source_record": ev.get("source_record"),
            "raw_checks": [{"path": ev["cache_path"], "sha256": ev["raw_sha256"], "contains": [ev["snippet"]] if ev["snippet_kind"] == "verbatim" else []}],
        }
    graph["edges"].extend(ontology_edges.values())
    community_sources = {s["id"]: s for s in community["sources"]}
    claims = {c["evidence_id"]: c for c in community["claims"]}
    for section in (community, research):
        for edge in section["edges"]:
            row = copy.deepcopy(edge)
            row["confidence"] = None  # No calibrated probability has been measured; P2 owns scoring.
            graph["edges"].append(row)
        for evidence in section["evidence"]:
            row = copy.deepcopy(evidence)
            row["retrieved_at"] = row["retrieved_at"][:10]
            graph["evidence"].append(row)
    for ev in community["evidence"]:
        claim = claims[ev["id"]]
        source = community_sources[claim["source_id"]]
        snapshot = source["snapshot"]
        provenance["evidence"][ev["id"]] = {
            "source_url": ev["source_url"], "curation_file": "curation/community.json", "verification": "verbatim",
            "source_id": source["id"], "quote_start": claim["quote_start"], "quote_end": claim["quote_end"],
            "qualifier": claim.get("qualifier"), "evidence_stance": claim.get("stance", "supports"),
            "raw_checks": [
                {"path": snapshot["body_path"], "sha256": snapshot["body_sha256"]},
                {"path": snapshot["text_path"], "sha256": snapshot["text_sha256"], "contains": [ev["snippet"]]},
            ],
        }
    provenance["evidence"].update(copy.deepcopy(research["provenance"]))
    provenance["sources"] = ontology["sources"] + community["sources"] + research["sources"]

    # Optional P1-only additive curation; the consumer graph contract is unchanged.
    expansion_path = curation_dir / "expansion.json"
    if include_expansion and expansion_path.is_file():
        expansion = read(expansion_path)
        for name in ("expansion.json", "expansion_selection.json"):
            provenance["curation_inputs"][f"curation/{name}"] = digest(read(curation_dir / name))
        for node in expansion["nodes"]:
            add_node(node, "curation/expansion.json")
        for table in ("edges", "evidence"):
            existing_ids = {row["id"] for row in graph[table]}
            if any(row["id"] in existing_ids for row in expansion[table]):
                raise ValueError(f"Expansion cannot overwrite existing {table}")
            graph[table].extend(copy.deepcopy(expansion[table]))
        if provenance["evidence"].keys() & expansion["provenance"].keys():
            raise ValueError("Expansion cannot overwrite existing evidence provenance")
        provenance["evidence"].update(copy.deepcopy(expansion["provenance"]))
        provenance["sources"].extend(copy.deepcopy(expansion["sources"]))

    memberships = defaultdict(set)
    for cluster in CLUSTERS:
        for mechanism in cluster["mechanism"]["mechanism_ids"]:
            if mechanism in nodes:
                memberships[mechanism].add(cluster["id"])
    for edge in graph["edges"]:
        if edge["type"] in {"disease_mechanism", "gene_variant_mechanism"} and edge["stance"] == "supports" and edge["status"] == "verified":
            memberships[edge["src"]].update(memberships[edge["dst"]])
            if edge["type"] == "gene_variant_mechanism":
                variant = nodes[edge["src"]]
                memberships[variant["props"]["gene_id"]].update(memberships[edge["dst"]])
                variant["props"]["effect"] = nodes[edge["dst"]]["props"]["effect"]
                variant["props"].setdefault("effect_evidence_edge_ids", []).append(edge["id"])
                variant["props"]["functional_scope"] = edge["note"]
    # Broad parent membership is a visual container, never an added mechanism claim.
    for node in nodes.values():
        parent = node["props"].get("parent_disease")
        if parent:
            memberships[parent].update(memberships[node["id"]])
    # DEE11 is deliberately not assigned a single mechanism by diagnosis alone.
    for edge in graph["edges"]:
        if edge["stance"] != "supports":
            continue
        if edge["type"] in {"disease_gene", "disease_phenotype"}:
            memberships[edge["dst"]].update(memberships[edge["src"]])
        elif edge["type"] in {"group_disease", "asset_disease", "study_disease", "investigator_disease"}:
            memberships[edge["src"]].update(memberships[edge["dst"]])
    graph["nodes"] = sorted(nodes.values(), key=lambda n: n["id"])
    graph["clusters"] = copy.deepcopy(CLUSTERS)
    for cluster in graph["clusters"]:
        cluster["mechanism"]["method"] = "Provisional, source-reviewed P1 groups; P2 owns algorithmic clustering."
        cluster["mechanism"]["scope"] = "Membership organizes reviewed records; it does not establish treatment equivalence or a functional diagnosis."
    graph["node_cluster"] = [{"node_id": node, "cluster_id": cluster} for node in sorted(memberships) for cluster in sorted(memberships[node])]
    for key in ("edges", "evidence"):
        graph[key].sort(key=lambda row: row["id"])
    errors = validate_graph(graph)
    if errors:
        raise ValueError("\n".join(errors))
    for ev in graph["evidence"]:
        audit = provenance["evidence"][ev["id"]]
        audit["evidence_sha256"] = digest(ev)
        if audit.get("source_record") is not None:
            audit["record_sha256"] = digest(audit["source_record"])
    provenance["graph_sha256"] = digest(graph)
    provenance["confidence_policy"] = "Null means not calibrated. Verified means checked against the cited source within the stated scope, not clinical certainty."
    provenance["release_date"] = max(ev["retrieved_at"] for ev in graph["evidence"])
    return graph, provenance


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--curation-dir", type=Path, default=DATA_DIR / "curation")
    ap.add_argument("--output-dir", type=Path, default=DATA_DIR / "seed")
    args = ap.parse_args()
    graph, provenance = build(args.curation_dir)
    save_json(args.output_dir / "graph.json", graph)
    save_json(args.output_dir / "provenance.json", provenance)
    coverage = read(args.curation_dir / "coverage_inventory.json")
    coverage["graph_counts"] = {key: len(rows) for key, rows in graph.items()}
    coverage["graph_sha256"] = provenance["graph_sha256"]
    save_json(args.output_dir / "coverage.json", coverage)
    demo = read(args.curation_dir / "demo_spec.json")
    demo["graph_sha256"] = provenance["graph_sha256"]
    save_json(args.output_dir / "demo_paths.json", demo)
    print("Built " + ", ".join(f"{len(v)} {k}" for k, v in graph.items()))


if __name__ == "__main__":
    main()
