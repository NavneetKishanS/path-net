"""Make a compact, reproducible research snapshot from reviewed official API records.

Selection is explicit in data/curation/research_selection.json; search hits alone
never become graph edges. No personal email addresses or phone numbers are copied.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from common import DATA_DIR, RAW_DIR, save_json


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def retrieval_date(source: str, identifier: str) -> str:
    field = "study_ids" if source == "clinicaltrials" else "application_ids"
    dates = [m["retrieved_at"][:10] for f in (RAW_DIR / source / "searches").glob("*/manifest.json") if identifier in (m := read(f)).get(field, [])]
    if not dates:
        raise ValueError(f"Missing source retrieval manifest for {source}/{identifier}")
    return max(dates)


def curate(selection: dict) -> dict:
    result = {"nodes": [], "edges": [], "evidence": [], "provenance": {}, "sources": []}
    nodes = {}

    def node(id_, type_, name, ext_ids, props, synonyms=None):
        row = {"id": id_, "type": type_, "name": name, "synonyms": synonyms or [], "ext_ids": ext_ids, "props": props}
        if id_ in nodes and nodes[id_] != row:
            # Repeated investigators must be reconciled explicitly, never merged by name.
            if nodes[id_]["ext_ids"] != ext_ids:
                raise ValueError(f"Conflicting source identity {id_}")
        else:
            nodes[id_] = row

    def edge(src, dst, type_, snippet, record, locator, source, url, cache, date, note, checks):
        id_ = f"e_{type_}_{src}_{dst}"
        eid = f"ev_{id_[2:]}"
        result["edges"].append({"id": id_, "src": src, "dst": dst, "type": type_, "tier": "A", "confidence": None, "stance": "supports", "status": "verified", "note": note})
        result["evidence"].append({"id": eid, "edge_id": id_, "source_type": source, "source_url": url, "pmid": None, "snippet": snippet, "retrieved_at": date})
        result["provenance"][eid] = {
            "source_url": url, "curation_file": "curation/research.json", "verification": "structured_record",
            "source_record_locator": locator, "source_record": record,
            "raw_checks": [{"path": cache.relative_to(DATA_DIR).as_posix(), "sha256": hashlib.sha256(cache.read_bytes()).hexdigest(), "contains": checks}],
        }

    for selected in selection["studies"]:
        nct, target, gene = selected["id"], selected["disease"], selected["gene"]
        cache = RAW_DIR / "clinicaltrials/studies" / f"{nct}.json"
        record = read(cache)["protocolSection"]
        ident, status = record["identificationModule"], record["statusModule"]
        assert ident["nctId"] == nct
        title = ident["briefTitle"]
        conditions = record.get("conditionsModule", {}).get("conditions", [])
        if not any(gene.lower() in s.lower() for s in [title, *conditions]):
            raise ValueError(f"{nct}: selected gene missing from title/conditions; manual review required")
        url, date = f"https://clinicaltrials.gov/study/{nct}", retrieval_date("clinicaltrials", nct)
        id_ = f"study_{nct.lower()}"
        sponsor = record.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name")
        overall = status["overallStatus"]
        next_step = "Review the public protocol and outcome measures with the patient organization or research team. Confirm the current study status and eligibility on the source page."
        if overall in {"TERMINATED", "WITHDRAWN", "COMPLETED", "ACTIVE_NOT_RECRUITING", "UNKNOWN"}:
            next_step = "Review the public study record as a research resource. Do not present it as an open enrollment opportunity; check the current official status."
        props = {
            "plain": f"A registered study relevant to {gene}. Recorded status: {overall.replace('_', ' ').lower()}.",
            "url": url, "source_url": url, "study_type": record.get("designModule", {}).get("studyType"),
            "status": overall, "status_verified_date": status.get("statusVerifiedDate"),
            "last_update_posted": status.get("lastUpdatePostDateStruct", {}).get("date"),
            "retrieved_at": date, "sponsor": sponsor, "conditions": conditions, "next_step": next_step,
            "scope_note": selection["scope_note"],
        }
        node(id_, "study", selected["label"], {"ClinicalTrials.gov": nct}, props, [title, nct])
        ev_record = {"nctId": nct, "briefTitle": title, "conditions": conditions, "overallStatus": overall}
        edge(id_, target, "study_disease", title, ev_record, "protocolSection.identificationModule.briefTitle; conditionsModule.conditions; statusModule.overallStatus", "clinicaltrials", url, cache, date,
             f"The registry title/conditions explicitly name {gene}. Scope may include a broader gene-related spectrum; this is a research-discovery link, not an eligibility or efficacy claim. Status at retrieval: {overall}.", [title, overall])
        result["sources"].append({"id": nct, "source_type": "clinicaltrials", "url": url, "retrieved_at": date, "raw_path": cache.relative_to(DATA_DIR).as_posix()})

    for selected in selection["awards"]:
        appl, target, gene = selected["id"], selected["disease"], selected["gene"]
        cache = RAW_DIR / "reporter/projects" / f"{appl}.json"
        r = read(cache)
        assert str(r["appl_id"]) == appl
        title = r["project_title"]
        if gene.lower() not in title.lower():
            raise ValueError(f"{appl}: selected gene absent from project title")
        url, date = r["project_detail_url"], retrieval_date("reporter", appl)
        pis = r.get("principal_investigators", [])
        funders = [{k: f.get(k) for k in ("fy", "code", "name", "abbreviation", "total_cost")} for f in r.get("agency_ic_fundings", [])]
        id_ = f"asset_nih_{appl}"
        props = {
            "plain": f"An NIH-supported research project studying {gene}; this record describes planned work, not proven treatment benefit.",
            "kind": "funded_research_project", "url": url, "source_url": url, "retrieved_at": date,
            "fiscal_year": r["fiscal_year"], "core_project_num": r.get("core_project_num"),
            "project_start_date": r.get("project_start_date"), "project_end_date": r.get("project_end_date"),
            "source_is_active": r.get("is_active"), "funder": funders,
            "administering_institute": r.get("agency_ic_admin", {}).get("name"),
            "organization": r.get("organization", {}).get("org_name"),
            "investigator_ids": [f"person_nih_{p['profile_id']}" for p in pis],
            "next_step": "Review the funded aims and linked publications to assess whether methods or models can be reused. Verify availability with the research institution.",
            "scope_note": selection["scope_note"],
        }
        node(id_, "asset", title, {"NIHRePORTER": appl, "NIHProject": r["project_num"]}, props)
        source_record = {"appl_id": r["appl_id"], "project_title": title, "principal_investigators": pis, "agency_ic_fundings": funders, "fiscal_year": r["fiscal_year"]}
        edge(id_, target, "asset_disease", title, source_record, "project_title; agency_ic_fundings; fiscal_year", "nih_reporter", url, cache, date,
             "Funded project relevant to this gene-related condition. Funding is represented as asset metadata because the shared contract has no funder node/edge type. Award years must not be summed as independent projects.", [title])
        for pi in pis:
            person_id = f"person_nih_{pi['profile_id']}"
            name = " ".join(pi["full_name"].split())
            node(person_id, "person", name, {"NIHProfile": str(pi["profile_id"])}, {
                "plain": "Publicly listed principal investigator on the cited NIH award.",
                "award_recipient_organization": r.get("organization", {}).get("org_name"), "source_url": url,
                "contact_policy": "Use institutional/public source links. Email and phone fields are omitted; P4 owns any restricted contact view.",
            })
            edge(person_id, target, "investigator_disease", f"{pi['full_name']} — {title}", source_record, f"principal_investigators[profile_id={pi['profile_id']}]; project_title", "nih_reporter", url, cache, date,
                 "Structured association: the source lists this person as a PI on the cited gene-related research award. It does not imply clinical availability, an endorsement, or a collaboration agreement.", [pi["full_name"], title])
        result["sources"].append({"id": appl, "source_type": "nih_reporter", "url": url, "retrieved_at": date, "raw_path": cache.relative_to(DATA_DIR).as_posix()})
    for selected in selection.get("investigator_links", []):
        appl = selected["award_id"]
        cache = RAW_DIR / "reporter/projects" / f"{appl}.json"
        r = read(cache)
        excerpt = selected["excerpt"]
        if excerpt not in r["abstract_text"]:
            raise ValueError(f"{appl}: reviewed investigator scope excerpt has changed")
        pi = next(p for p in r["principal_investigators"] if str(p["profile_id"]) == selected["profile_id"])
        person_id = f"person_nih_{pi['profile_id']}"
        url, date = r["project_detail_url"], retrieval_date("reporter", appl)
        node(person_id, "person", " ".join(pi["full_name"].split()), {"NIHProfile": str(pi["profile_id"])}, {
            "plain": "Publicly listed NIH investigator whose cited projects describe longitudinal phenotyping across these gene-related disorders.",
            "award_recipient_organization": r.get("organization", {}).get("org_name"), "source_url": url,
            "contact_policy": "Use institutional/public source links. Email and phone fields are omitted; P4 owns any restricted contact view.",
        })
        for target in selected["targets"]:
            edge(person_id, target, "investigator_disease", f"{pi['full_name']} — {excerpt}",
                 {"appl_id": r["appl_id"], "principal_investigator": pi, "abstract_excerpt": excerpt},
                 f"principal_investigators[profile_id={pi['profile_id']}]; abstract_text", "nih_reporter", url, cache, date,
                 "The award identifies this PI and explicitly describes the team's research on the named gene-related disorders. Shared investigators are a discovery opportunity, not proof of a shared disease mechanism.", [pi["full_name"], excerpt])
        result["sources"].append({"id": appl, "source_type": "nih_reporter", "url": url, "retrieved_at": date, "raw_path": cache.relative_to(DATA_DIR).as_posix()})
    result["nodes"] = sorted(nodes.values(), key=lambda n: n["id"])
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--selection", type=Path, default=DATA_DIR / "curation/research_selection.json")
    ap.add_argument("--output", type=Path, default=DATA_DIR / "curation/research.json")
    args = ap.parse_args()
    result = curate(read(args.selection))
    save_json(args.output, result)
    print(f"Curated {len(result['nodes'])} research nodes and {len(result['edges'])} source-backed relationships.")


if __name__ == "__main__":
    main()
