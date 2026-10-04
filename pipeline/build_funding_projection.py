"""Build a source-checked administrative funding report without graph changes.

    python pipeline/build_funding_projection.py
    python pipeline/build_funding_projection.py --data-dir /path/to/data

The report joins existing NIH award metadata to verified supporting asset_disease
relationships. It is a sidecar, not a biological relationship or explanation route.
No network, database, model call, currency assumption or cost aggregation is used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from common import DATA_DIR
from validate_graph import digest, validate_graph, validate_provenance

FUNDING_FIELDS = ("fy", "code", "name", "abbreviation", "total_cost")
LIMITATIONS = [
    "Shared funding is an administrative association, not evidence of a shared mechanism, treatment response or clinical eligibility.",
    "These are recorded fiscal-year awards in a selected snapshot, not a claim of currently active funding or comprehensive coverage.",
    "Application IDs identify annual records, supplements or subprojects; distinct core project numbers are counted separately. Costs are not summed.",
    "Disease links retain the source scope of the existing asset_disease edges; they do not prove that every phenotype or variant is included.",
    "This P1 report is not an explanation route, a new graph relation, a platform endpoint or a completed P3 view.",
]


def read_json(path: Path) -> tuple[dict, str]:
    body = path.read_bytes()
    return json.loads(body.decode("utf-8-sig")), hashlib.sha256(body).hexdigest()


def matches_subset(expected, actual) -> bool:
    """Compare a reviewed structured projection with its full original record."""
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(key in actual and matches_subset(value, actual[key])
                                                for key, value in expected.items())
    if isinstance(expected, list):
        return isinstance(actual, list) and len(expected) == len(actual) and all(
            matches_subset(left, right) for left, right in zip(expected, actual))
    return type(expected) is type(actual) and expected == actual


def raw_project_path(data_dir: Path, application_id: str) -> tuple[Path, str]:
    relative = f"raw/reporter/projects/{application_id}.json"
    path = data_dir / relative
    if not path.resolve().is_relative_to((data_dir / "raw").resolve()):
        raise ValueError("Funding raw path escapes DATA_DIR/raw")
    for part in (path, *path.parents):
        if part == data_dir:
            break
        if part.is_symlink() or getattr(part, "is_junction", lambda: False)():
            raise ValueError("Funding raw references must not traverse links")
    if not path.is_file():
        raise ValueError(f"Missing funding raw record: {relative}")
    return path, relative


def checked_source(asset: dict, evidence: dict, binding: dict, data_dir: Path) -> dict:
    application_id = asset.get("ext_ids", {}).get("NIHRePORTER", "")
    if not isinstance(application_id, str) or not re.fullmatch(r"[1-9]\d*", application_id):
        raise ValueError(f"{asset['id']}: missing NIH application identity")
    path, relative = raw_project_path(data_dir, application_id)
    original, raw_sha256 = read_json(path)
    checks = [row for row in binding.get("raw_checks", []) if row.get("path") == relative]
    if not checks or any(row.get("sha256") != raw_sha256 for row in checks):
        raise ValueError(f"{evidence['id']}: funding raw SHA-256 mismatch or missing binding")
    required_locators = {"project_title", "agency_ic_fundings", "fiscal_year"}
    locators = {part.strip() for part in binding.get("source_record_locator", "").split(";")}
    source = binding.get("source_record", {})
    if not required_locators <= locators or not required_locators | {"appl_id"} <= source.keys():
        raise ValueError(f"{evidence['id']}: missing structured funding source locator")
    if binding.get("record_sha256") != digest(source) or not matches_subset(source, original):
        raise ValueError(f"{evidence['id']}: structured funding source differs from original record")
    props = asset.get("props", {})
    expected_url = f"https://reporter.nih.gov/project-details/{application_id}"
    if (str(original.get("appl_id")) != application_id or original.get("agency_code") != "NIH"
            or asset.get("name") != original.get("project_title")
            or asset.get("ext_ids", {}).get("NIHProject") != original.get("project_num")
            or props.get("core_project_num") != original.get("core_project_num")
            or not isinstance(props.get("core_project_num"), str) or not props["core_project_num"].strip()
            or props.get("fiscal_year") != original.get("fiscal_year")
            or type(props.get("fiscal_year")) is not int
            or props.get("source_url") != expected_url or props.get("url") != expected_url
            or evidence.get("source_url") != expected_url
            or props.get("retrieved_at") != evidence.get("retrieved_at")
            or evidence.get("snippet") != original.get("project_title")):
        raise ValueError(f"{asset['id']}: award identity/year/source metadata differs from original record")
    funding = original.get("agency_ic_fundings")
    if not isinstance(funding, list) or not funding:
        raise ValueError(f"{asset['id']}: no original funding array")
    projected = []
    for row in funding:
        if (not isinstance(row, dict) or not set(FUNDING_FIELDS) <= row.keys()
                or type(row["fy"]) is not int
                or any(not isinstance(row[key], str) or not row[key].strip()
                       for key in ("code", "name", "abbreviation"))):
            raise ValueError(f"{asset['id']}: invalid original funding metadata")
        projected.append({key: row[key] for key in FUNDING_FIELDS})
    if props.get("funder") != projected or source.get("agency_ic_fundings") != projected:
        raise ValueError(f"{asset['id']}: graph/reviewed funding metadata differs from original funding array")
    return {"original": original, "funding": projected, "application_id": application_id,
            "source_url": expected_url, "raw_path": relative, "raw_sha256": raw_sha256,
            "raw_record_sha256": digest(original), "source_record_sha256": digest(source)}


def build_funding_projection(data_dir: Path = DATA_DIR) -> dict:
    """Read a complete reviewed graph/provenance pair; return a deterministic report."""
    data_dir = Path(data_dir).resolve()
    graph, graph_file_sha256 = read_json(data_dir / "seed/graph.json")
    provenance, provenance_file_sha256 = read_json(data_dir / "seed/provenance.json")
    errors = validate_graph(graph) + validate_provenance(graph, provenance, data_dir, check_raw=False)
    if errors:
        raise ValueError("Invalid graph/provenance pair: " + "; ".join(errors))
    nodes = {node["id"]: node for node in graph["nodes"]}
    evidence_by_edge = {}
    for evidence in graph["evidence"]:
        evidence_by_edge.setdefault(evidence["edge_id"], []).append(evidence)
    groups = {}
    for edge in sorted(graph["edges"], key=lambda row: row["id"]):
        asset = nodes[edge["src"]]
        if (edge["type"] != "asset_disease" or edge["status"] != "verified"
                or edge["stance"] != "supports" or edge["tier"] not in {"A", "B"}
                or asset["type"] != "asset" or asset["props"].get("kind") != "funded_research_project"):
            continue
        evidence_rows = [row for row in evidence_by_edge.get(edge["id"], [])
                         if row["source_type"] == "nih_reporter"]
        if not evidence_rows:
            raise ValueError(f"{edge['id']}: funded project has no NIH source evidence")
        for evidence in sorted(evidence_rows, key=lambda row: row["id"]):
            source = checked_source(asset, evidence, provenance["evidence"][evidence["id"]], data_dir)
            for index, funding in enumerate(source["funding"]):
                key = (source["original"]["agency_code"], funding["code"], funding["fy"])
                group = groups.setdefault(key, {
                    "provider": "NIH RePORTER", "agency_code": key[0], "funding_ic_code": key[1],
                    "funding_ic_name": funding["name"], "funding_ic_abbreviation": funding["abbreviation"],
                    "fiscal_year": key[2], "members": {},
                })
                if (group["funding_ic_name"] != funding["name"]
                        or group["funding_ic_abbreviation"] != funding["abbreviation"]):
                    raise ValueError("Conflicting funding institute metadata for the same code/year")
                member_key = (source["application_id"], asset["id"], edge["dst"])
                member = group["members"].setdefault(member_key, {
                    "application_id": source["application_id"], "asset_id": asset["id"], "disease_id": edge["dst"],
                    "core_project_num": asset["props"]["core_project_num"],
                    "application_fiscal_year": asset["props"]["fiscal_year"],
                    "edge_ids": [], "evidence_ids": [], "edge_scope_notes": [],
                    "source_url": source["source_url"], "retrieved_at": evidence["retrieved_at"],
                    "funding_source": {key: source[key] for key in
                                       ("raw_path", "raw_sha256", "raw_record_sha256", "source_record_sha256")},
                })
                member["edge_ids"].append(edge["id"])
                member["evidence_ids"].append(evidence["id"])
                if edge.get("note"):
                    member["edge_scope_notes"].append(edge["note"])
                member["funding_source"].setdefault("locators", []).append(f"agency_ic_fundings[{index}]")
    result_groups = []
    all_applications, all_projects = set(), set()
    for key in sorted(groups):
        group = groups[key]
        members = [group["members"][key] for key in sorted(group["members"])]
        for member in members:
            for field in ("edge_ids", "evidence_ids", "edge_scope_notes"):
                member[field] = sorted(set(member[field]))
            member["funding_source"]["locators"] = sorted(set(member["funding_source"]["locators"]))
        group["members"] = members
        applications = sorted({member["application_id"] for member in members})
        projects = sorted({member["core_project_num"] for member in members})
        group.update(application_ids=applications, core_project_numbers=projects,
                     application_count=len(applications), core_project_count=len(projects))
        all_applications.update(applications)
        all_projects.update(projects)
        result_groups.append(group)
    return {
        "schema_version": 1, "kind": "administrative_funding_overlap",
        "graph_sha256": digest(graph), "graph_file_sha256": graph_file_sha256,
        "provenance_sha256": digest(provenance), "provenance_file_sha256": provenance_file_sha256,
        "summary": {"funding_groups": len(result_groups),
                    "supporting_memberships": sum(len(group["members"]) for group in result_groups),
                    "application_count": len(all_applications), "core_project_count": len(all_projects)},
        "count_units": {"application_count": "Distinct NIH appl_id values, including annual applications, supplements and subprojects.",
                        "core_project_count": "Distinct core_project_num values; annual rows are not independent projects.",
                        "supporting_memberships": "Distinct application/asset/disease associations within a funding institute and fiscal year."},
        "groups": result_groups, "limitations": list(LIMITATIONS),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    args = parser.parse_args()
    try:
        report = build_funding_projection(args.data_dir)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(1, f"Funding projection failed: {exc}\n")
    output = args.data_dir / "seed/funding_overlap.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes((json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    print(json.dumps({"output": str(output), **report["summary"]}))


if __name__ == "__main__":
    main()
