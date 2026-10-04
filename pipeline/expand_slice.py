"""Build an explicitly reviewed additive slice from existing pinned public caches.

No network, models, credentials or database calls. The baseline curation and raw
bytes are read-only. New records live in curation/expansion.json, which the P1
builder consumes without changing the five-table graph or consumer interfaces.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path

from build_graph import build
from common import DATA_DIR, save_json
from curate_research import curate
from validate_graph import digest

GENE_TARGETS = {
    "STXBP1": "dis_stxbp1", "SCN2A": "dis_scn2a",
    "KCNQ2": "dis_kcnq2", "SCN8A": "dis_scn8a",
}
ORPHA_TARGETS = {"599373": "dis_stxbp1", "439218": "dis_kcnq2"}


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def key(edge):
    return tuple(edge[field] for field in ("src", "dst", "type", "stance"))


def build_expansion(selection: dict, data_dir: Path = DATA_DIR) -> dict:
    """Return only new rows/evidence, preserving every existing baseline row."""
    data_dir = Path(data_dir).resolve()
    # curate() already uses the selected process DATA_DIR. Reject mixed roots.
    if data_dir != DATA_DIR.resolve():
        raise ValueError("Select an isolated DATA_DIR before starting this process")
    baseline, bindings = build(data_dir / "curation", include_expansion=False)
    if digest(baseline) != selection["baseline_graph_sha256"]:
        raise ValueError("Baseline graph changed; review the expansion selection again")
    nodes = {n["id"]: n for n in baseline["nodes"]}
    edges = {key(e): e for e in baseline["edges"]}
    result = {"nodes": [], "edges": [], "evidence": [], "provenance": {}, "sources": []}
    new_nodes, new_edges = {}, {}
    evidence_ids = {e["id"] for e in baseline["evidence"]}
    raw_bindings = selection["raw_files"]

    def checked_raw(relative):
        path = data_dir / relative
        if not relative.startswith("raw/") or ".." in Path(relative).parts:
            raise ValueError("Expansion sources must stay in raw/")
        if not path.resolve().is_relative_to((data_dir / "raw").resolve()):
            raise ValueError("Expansion source escapes raw/")
        if any(p.is_symlink() or getattr(p, "is_junction", lambda: False)()
               for p in (path, *path.parents) if p != data_dir):
            raise ValueError("Expansion source cannot traverse links")
        body = path.read_bytes()
        if hashlib.sha256(body).hexdigest() != raw_bindings.get(relative):
            raise ValueError(f"Reviewed raw source changed or is unpinned: {relative}")
        return json.loads(body.decode("utf-8-sig"))

    def merge(section, source_suffix):
        for node in section["nodes"]:
            old = nodes.get(node["id"]) or new_nodes.get(node["id"])
            if old:
                if old["type"] != node["type"] or old["ext_ids"] != node["ext_ids"]:
                    raise ValueError(f"Conflicting source identity: {node['id']}")
                # New awards never overwrite the original PI node's source/name.
            else:
                new_nodes[node["id"]] = copy.deepcopy(node)
        edge_ids = {}
        for edge in section["edges"]:
            semantic = key(edge)
            old = edges.get(semantic) or new_edges.get(semantic)
            if old:
                edge_ids[edge["id"]] = old["id"]
            else:
                new_edges[semantic] = copy.deepcopy(edge)
                edge_ids[edge["id"]] = edge["id"]
        for ev in section["evidence"]:
            original_id = ev["id"]
            row = copy.deepcopy(ev)
            row["edge_id"] = edge_ids[row["edge_id"]]
            row["id"] = f"ev_{row['edge_id'][2:]}_{source_suffix}"
            if row["id"] in evidence_ids:
                raise ValueError("Duplicate selected source/evidence")
            evidence_ids.add(row["id"])
            result["evidence"].append(row)
            binding = copy.deepcopy(section["provenance"][original_id])
            binding["curation_file"] = "curation/expansion.json"
            result["provenance"][row["id"]] = binding
        result["sources"].extend(copy.deepcopy(section["sources"]))

    seen_selections = set()
    for kind, source, folder in (("studies", "clinicaltrials", "clinicaltrials/studies"),
                                  ("awards", "reporter", "reporter/projects")):
        seen_projects = {n["props"].get("core_project_num") for n in baseline["nodes"]
                         if n["props"].get("kind") == "funded_research_project"}
        for selected in selection[kind]:
            identity = (kind, selected["id"], selected["disease"])
            if identity in seen_selections:
                raise ValueError("Duplicate explicit source selection")
            seen_selections.add(identity)
            if selected["gene"] not in GENE_TARGETS or selected["disease"] != GENE_TARGETS[selected["gene"]]:
                raise ValueError("Expansion must use the reviewed gene-spectrum target")
            record = checked_raw(f"raw/{folder}/{selected['id']}.json")
            if kind == "awards":
                if record["core_project_num"] in seen_projects:
                    raise ValueError("Annual award duplicates an already selected core project")
                seen_projects.add(record["core_project_num"])
                if selected["review_excerpt"] not in record["abstract_text"]:
                    raise ValueError("Reviewed award disease-scope excerpt changed")
            else:
                protocol = record["protocolSection"]
                text = [protocol["identificationModule"]["briefTitle"],
                        *protocol.get("conditionsModule", {}).get("conditions", [])]
                if not any(re.search(r"\b" + selected["gene"] + r"\b", t, re.I) for t in text):
                    raise ValueError("Trial gene absent from title/conditions")
                if selected["review_excerpt"] not in protocol.get("descriptionModule", {}).get("briefSummary", ""):
                    raise ValueError("Reviewed trial disease-scope excerpt changed")
            single = {"studies": [], "awards": [], "investigator_links": [],
                      "scope_note": selection["scope_note"]}
            single[kind] = [selected]
            section = curate(single)
            if kind == "studies":
                # Keep dated discovery scope in the existing visible text field.
                study = next(n for n in section["nodes"] if n["type"] == "study")
                props = study["props"]
                scope = f"A registered research record relevant to {selected['gene']}."
                if selected["id"] == "NCT06314490":
                    enrollment = protocol["designModule"]["enrollmentInfo"]
                    if enrollment != {"count": 1, "type": "ACTUAL"} or "single pediatric participant" not in selected["review_excerpt"]:
                        raise ValueError("Reviewed single-participant study scope changed")
                    scope = "An individualized research protocol for one pediatric participant with SCN2A-associated developmental epileptic encephalopathy; not a general enrollment opportunity."
                props["plain"] = (
                    f"{scope} Retrieved {props['retrieved_at']}. "
                    f"Recorded status: {props['status'].replace('_', ' ').lower()}. "
                    "Cluster membership is a provisional discovery grouping, not a functional assignment."
                )
            merge(section, f"{source}_{selected['id'].lower()}")

    # Orphadata's full public responses include exact HPO IDs, labels and source
    # frequency bands. Preserve those bands without assigning individual risk.
    baseline_locators = {(b.get("source_url"), b.get("source_record_locator"))
                         for b in bindings["evidence"].values()}
    seen_orpha = set()
    for selected in selection["orphadata"]:
        code = selected["id"]
        if code not in ORPHA_TARGETS or code in seen_orpha:
            raise ValueError("Invalid or duplicate exact Orphanet disease selection")
        seen_orpha.add(code)
        source_id = f"orpha_phenotypes_{code}"
        relative = f"raw/ontologies/{source_id}.json"
        payload = checked_raw(relative)
        meta = checked_raw(f"raw/ontologies/{source_id}.meta.json")
        disease_id = ORPHA_TARGETS[code]
        if nodes[disease_id]["ext_ids"].get("Orphanet") != code:
            raise ValueError("Orphanet disease identity must be exact")
        original = payload["data"]["results"]
        disorder = original["Disorder"]
        if str(disorder["ORPHAcode"]) != code or original["ValidationStatus"] != "y":
            raise ValueError("Unvalidated or mismatched Orphadata record")
        if meta["raw_sha256"] != raw_bindings[relative] or payload["uri"] != meta["source_url"]:
            raise ValueError("Orphadata metadata does not match pinned response")
        rows = disorder["HPODisorderAssociation"]
        if selected["association_ids"] != [row["HPO"]["HPOId"] for row in rows]:
            raise ValueError("Reviewed Orphadata annotation membership changed")
        result["sources"].append(meta)
        for index, association in enumerate(rows):
            locator = f"data.results.Disorder.HPODisorderAssociation[{index}]"
            if (meta["source_url"], locator) in baseline_locators:
                continue
            hpo_id, label = association["HPO"]["HPOId"], association["HPO"]["HPOTerm"]
            if not re.fullmatch(r"HP:\d{7}", hpo_id) or not label:
                raise ValueError("Missing exact HPO identity/label in source")
            frequency = association["HPOFrequency"]
            if not isinstance(frequency, str) or frequency.startswith("Excluded"):
                raise ValueError("Negative or absent phenotype frequency requires separate review")
            phenotype_id = hpo_id.lower().replace(":", "_")
            edge_id = f"e_disease_phenotype_{disease_id}_{phenotype_id}_supports"
            ev_id = f"ev_{edge_id[2:]}_orpha_{code}_{index}"
            snippet = f"{label} ({hpo_id}); recorded Orphadata frequency: {frequency}."
            binding = {"source_url": meta["source_url"], "curation_file": "curation/expansion.json",
                       "verification": "structured_record", "source_id": source_id,
                       "source_record_locator": locator, "source_record": association,
                       "raw_checks": [{"path": relative, "sha256": meta["raw_sha256"],
                                       "contains": [hpo_id, label, frequency]}]}
            section = {
                "nodes": [{"id": phenotype_id, "type": "phenotype", "name": label,
                           "synonyms": [], "ext_ids": {"HPO": hpo_id},
                           "props": {"source_id": source_id, "ontology_version": f"Orphadata record {original['Date']}"}}],
                "edges": [{"id": edge_id, "src": disease_id, "dst": phenotype_id,
                           "type": "disease_phenotype", "tier": "A", "confidence": None,
                           "stance": "supports", "status": "verified",
                           "note": f"Orphadata disease-level annotation; recorded frequency: {frequency}. Not every affected person has this feature; frequency is a source band, not individual risk. Exact HPO label is retained from the dated Orphadata response; no new HPO release validation is claimed."}],
                "evidence": [{"id": ev_id, "edge_id": edge_id, "source_type": "orphadata",
                              "source_url": meta["source_url"], "pmid": None, "snippet": snippet,
                              "retrieved_at": meta["retrieved_at"][:10]}],
                "provenance": {ev_id: binding}, "sources": [],
            }
            merge(section, f"orpha_{code}_{index}")
    result["nodes"] = sorted(new_nodes.values(), key=lambda n: n["id"])
    result["edges"] = sorted(new_edges.values(), key=lambda e: e["id"])
    result["evidence"].sort(key=lambda e: e["id"])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selection", type=Path, default=DATA_DIR / "curation/expansion_selection.json")
    args = parser.parse_args()
    result = build_expansion(read(args.selection))
    save_json(DATA_DIR / "curation/expansion.json", result)
    print("New curation: " + ", ".join(f"{len(result[k])} {k}" for k in ("nodes", "edges", "evidence")))


if __name__ == "__main__":
    main()
