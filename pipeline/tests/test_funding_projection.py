"""Source integrity and counting checks for the administrative funding report."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_funding_projection import build_funding_projection
from validate_graph import digest

ROOT = Path(__file__).resolve().parents[2]


class FundingProjectionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.data = Path(self.temporary.name)
        self.graph = {"nodes": [], "edges": [], "evidence": [], "clusters": [], "node_cluster": []}
        self.provenance = {"curation_inputs": {}, "evidence": {}, "nodes": {}}

    def save(self, relative, value):
        path = self.data / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        return path

    def persist_pair(self):
        self.provenance["graph_sha256"] = digest(self.graph)
        self.save("seed/graph.json", self.graph)
        self.save("seed/provenance.json", self.provenance)

    def add_award(self, application="12345678", core="R01NS123456", disease="dis_test"):
        asset_id = "asset_nih_" + application
        title = "Research into the selected condition"
        funding = {"fy": 2026, "code": "NS", "name": "National Institute of Neurological Disorders and Stroke",
                   "abbreviation": "NINDS", "total_cost": 100.0}
        original = {"appl_id": int(application), "agency_code": "NIH", "project_num": "5" + core + "-02",
                    "core_project_num": core, "fiscal_year": 2026, "project_title": title,
                    "agency_ic_fundings": [{**funding, "direct_cost_ic": 80.0, "indirect_cost_ic": 20.0}],
                    "agency_ic_admin": {"code": "OTHER", "name": "Not the funding institute"}}
        raw = self.save(f"raw/reporter/projects/{application}.json", original)
        url = f"https://reporter.nih.gov/project-details/{application}"
        asset = {"id": asset_id, "type": "asset", "name": title, "synonyms": [],
                 "ext_ids": {"NIHRePORTER": application, "NIHProject": original["project_num"]},
                 "props": {"kind": "funded_research_project", "funder": [funding],
                           "core_project_num": core, "fiscal_year": 2026, "url": url, "source_url": url,
                           "retrieved_at": "2026-10-03"}}
        if disease not in {row["id"] for row in self.graph["nodes"]}:
            self.graph["nodes"].append({"id": disease, "type": "disease", "name": "Selected condition",
                                        "synonyms": [], "ext_ids": {}, "props": {}})
        self.graph["nodes"].append(asset)
        edge = {"id": "edge_" + application, "src": asset_id, "dst": disease, "type": "asset_disease",
                "tier": "A", "confidence": None, "stance": "supports", "status": "verified",
                "note": "Research discovery scope; not every phenotype is necessarily included."}
        evidence = {"id": "ev_" + application, "edge_id": edge["id"], "source_type": "nih_reporter",
                    "source_url": url, "pmid": None, "snippet": title, "retrieved_at": "2026-10-03"}
        source = {"appl_id": int(application), "project_title": title, "fiscal_year": 2026,
                  "agency_ic_fundings": [copy.deepcopy(funding)]}
        self.graph["edges"].append(edge)
        self.graph["evidence"].append(evidence)
        self.provenance["evidence"][evidence["id"]] = {
            "source_url": url, "curation_file": "curation/research.json", "verification": "structured_record",
            "source_record_locator": "project_title; agency_ic_fundings; fiscal_year",
            "source_record": source, "record_sha256": digest(source), "evidence_sha256": digest(evidence),
            "raw_checks": [{"path": raw.relative_to(self.data).as_posix(),
                            "sha256": hashlib.sha256(raw.read_bytes()).hexdigest(), "contains": [title]}],
        }
        return asset, edge, evidence, original

    def test_reviewed_awards_use_exact_sources_and_preserve_original_four(self):
        paths = [p for folder in ("raw", "curation") for p in (ROOT / "data" / folder).rglob("*") if p.is_file()]
        paths += [ROOT / "data/seed" / name for name in ("graph.json", "provenance.json", "coverage.json", "demo_paths.json")]
        before = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
        report = build_funding_projection(ROOT / "data")
        expanded = (ROOT / "data/curation/expansion_selection.json").is_file()
        count = 11 if expanded else 4
        self.assertEqual(report["summary"], {"funding_groups": 2 if expanded else 1, "supporting_memberships": count,
                                            "application_count": count, "core_project_count": count})
        group = next(g for g in report["groups"] if g["funding_ic_code"] == "NS")
        self.assertEqual((group["agency_code"], group["funding_ic_code"], group["fiscal_year"]), ("NIH", "NS", 2026))
        original_members = {
            ("11261066", "dis_scn8a"), ("11317220", "dis_scn2a_dee"),
            ("11322512", "dis_stxbp1"), ("11381904", "dis_kcnq2"),
        }
        members = {(row["application_id"], row["disease_id"]) for row in group["members"]}
        self.assertTrue(original_members <= members)
        if not expanded:
            self.assertEqual(original_members, members)
        for member in [m for g in report["groups"] for m in g["members"]]:
            self.assertEqual(member["funding_source"]["locators"], ["agency_ic_fundings[0]"])
            self.assertEqual(len(member["edge_ids"]), 1)
            self.assertEqual(len(member["evidence_ids"]), 1)
            self.assertNotIn("total_cost", json.dumps(member))
        self.assertEqual(report, build_funding_projection(ROOT / "data"))
        self.assertEqual(before, {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths})

    def test_annual_supplement_applications_are_distinct_but_share_one_core_project(self):
        self.add_award("12345678")
        self.add_award("12345679")
        self.persist_pair()
        report = build_funding_projection(self.data)
        self.assertEqual(report["summary"]["application_count"], 2)
        self.assertEqual(report["summary"]["core_project_count"], 1)
        self.assertEqual(report["groups"][0]["application_ids"], ["12345678", "12345679"])
        self.assertNotIn("total_cost", json.dumps(report))

    def test_repeated_evidence_does_not_duplicate_awards_or_memberships(self):
        _, edge, evidence, _ = self.add_award()
        second = {**evidence, "id": "ev_repeated"}
        self.graph["evidence"].append(second)
        self.provenance["evidence"][second["id"]] = copy.deepcopy(self.provenance["evidence"][evidence["id"]])
        self.provenance["evidence"][second["id"]]["evidence_sha256"] = digest(second)
        self.persist_pair()
        report = build_funding_projection(self.data)
        self.assertEqual(report["summary"]["application_count"], 1)
        self.assertEqual(report["summary"]["supporting_memberships"], 1)
        self.assertEqual(report["groups"][0]["members"][0]["edge_ids"], [edge["id"]])
        self.assertEqual(len(report["groups"][0]["members"][0]["evidence_ids"]), 2)

    def test_member_order_is_deterministic_and_admin_institute_is_not_used(self):
        self.add_award("12345679", disease="dis_second")
        self.add_award("12345678")
        self.persist_pair()
        first = build_funding_projection(self.data)
        self.graph["edges"].reverse()
        self.graph["evidence"].reverse()
        self.persist_pair()
        second = build_funding_projection(self.data)
        self.assertEqual(first["groups"], second["groups"])
        self.assertEqual(second["groups"][0]["funding_ic_code"], "NS")
        self.assertEqual([row["application_id"] for row in second["groups"][0]["members"]], ["12345678", "12345679"])

    def test_contradictory_unverified_neutral_and_inferred_edges_do_not_enter_report(self):
        _, edge, _, _ = self.add_award()
        for field, value in (("stance", "contradicts"), ("stance", "neutral"),
                             ("status", "unverified"), ("status", "rejected"), ("tier", "D")):
            with self.subTest(field=field, value=value):
                original = edge[field]
                edge[field] = value
                self.persist_pair()
                self.assertEqual(build_funding_projection(self.data)["summary"]["application_count"], 0)
                edge[field] = original

    def test_raw_byte_tampering_fails_even_when_json_still_parses(self):
        _, _, _, original = self.add_award()
        self.persist_pair()
        original["agency_ic_fundings"][0]["name"] = "Changed funding institute"
        self.save("raw/reporter/projects/12345678.json", original)
        with self.assertRaisesRegex(ValueError, "raw SHA-256 mismatch"):
            build_funding_projection(self.data)

    def test_missing_raw_hash_or_funding_locator_fails(self):
        _, _, evidence, _ = self.add_award()
        binding = self.provenance["evidence"][evidence["id"]]
        for field, value, message in (("raw_checks", [], "raw SHA-256"),
                                      ("source_record_locator", "project_title; fiscal_year", "source locator")):
            with self.subTest(field=field):
                original = binding[field]
                binding[field] = value
                self.persist_pair()
                with self.assertRaisesRegex(ValueError, message):
                    build_funding_projection(self.data)
                binding[field] = original

    def test_graph_metadata_tampering_fails_after_pair_digest_is_updated(self):
        asset, _, _, _ = self.add_award()
        asset["props"]["funder"][0]["code"] = "OTHER"
        self.persist_pair()
        with self.assertRaisesRegex(ValueError, "funding metadata differs"):
            build_funding_projection(self.data)

    def test_reviewed_source_tampering_cannot_replace_the_original_funding_row(self):
        _, _, evidence, _ = self.add_award()
        binding = self.provenance["evidence"][evidence["id"]]
        binding["source_record"]["agency_ic_fundings"][0]["code"] = "OTHER"
        binding["record_sha256"] = digest(binding["source_record"])
        self.persist_pair()
        with self.assertRaisesRegex(ValueError, "source differs from original record"):
            build_funding_projection(self.data)

    def test_stale_graph_provenance_pair_is_rejected(self):
        self.add_award()
        self.persist_pair()
        self.graph["nodes"][0]["name"] = "Changed after review"
        self.save("seed/graph.json", self.graph)
        with self.assertRaisesRegex(ValueError, "graph digest does not match"):
            build_funding_projection(self.data)

    def test_wrong_award_identity_cannot_pass_with_a_rehashed_raw_file(self):
        _, _, evidence, original = self.add_award()
        original["appl_id"] = 99999999
        raw = self.save("raw/reporter/projects/12345678.json", original)
        self.provenance["evidence"][evidence["id"]]["raw_checks"][0]["sha256"] = hashlib.sha256(raw.read_bytes()).hexdigest()
        self.persist_pair()
        with self.assertRaisesRegex(ValueError, "source differs from original record"):
            build_funding_projection(self.data)

    def test_full_cache_audit_rejects_a_corrupt_saved_projection(self):
        from audit_cache import audit_cache
        _, _, _, original = self.add_award()
        self.persist_pair()
        self.save("curation/community.json", {"sources": [], "claims": [], "evidence": []})
        self.save("curation/pubmed_manifest.json", {"records": [], "record_count": 0})
        self.save("curation/research_cache_manifest.json", {
            "clinicaltrials": [], "reporter": [{"id": "12345678", "content_sha256": digest(original)}],
        })
        report = build_funding_projection(self.data)
        self.save("seed/funding_overlap.json", report)
        self.assertEqual(audit_cache(self.data)["status"], "passed")
        before = {str(p): p.read_bytes() for p in self.data.rglob("*.json")
                  if p.name != "funding_overlap.json"}
        report["summary"]["application_count"] = 999
        self.save("seed/funding_overlap.json", report)
        audited = audit_cache(self.data)
        self.assertEqual(audited["status"], "failed")
        self.assertIn("Funding projection differs from its source-bound rebuild", audited["errors"])
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.data.rglob("*.json")
                                  if p.name != "funding_overlap.json"})


if __name__ == "__main__":
    unittest.main()
