"""Regression tests for evidence-sign and identifier integrity at ingestion."""
import json
import copy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_ontologies import (CLINVAR_IDS_BY_GENE, GENES, SourceCache, active_term,
                              build_slice, canonical_json, clinvar_records, digest,
                              exact_disease_ids, normalize_clinvar, parse_hpoa,
                              reconcile_gene, term_aliases)

ROOT = Path(__file__).resolve().parents[2]


class HpoTests(unittest.TestCase):
    def test_negative_qualifier_is_not_promoted_to_positive_edge(self):
        raw = "\n".join([
            "#version: 2026-09-02",
            "database_id\tdisease_name\tqualifier\thpo_id\treference\tevidence\tonset\tfrequency\tsex\tmodifier\taspect\tbiocuration",
            "OMIM:123456\tTest disease\tNOT\tHP:0001250\tPMID:123\tPCS\t\t0/4\t\t\tP\tHPO:curator[2026-01-01]",
            "OMIM:123456\tTest disease\t\tHP:0001252\tPMID:124\tPCS\t\t3/4\t\t\tP\tHPO:curator[2026-01-01]",
            "OMIM:123456\tTest disease\t\tHP:0001250\tPMID:124\tPCS\t\t\t\t\tI\tHPO:curator[2026-01-01]",
            "OMIM:654321\tDifferent disease\t\tHP:0001250\tPMID:124\tPCS\t\t\t\t\tP\tHPO:curator[2026-01-01]",
        ])
        rows, meta = parse_hpoa(raw, {"OMIM:123456": "dis_test"}, {"HP:0001250", "HP:0001252"})
        self.assertEqual(meta["version"], "2026-09-02")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["stance"], "contradicts")
        self.assertEqual(rows[0]["qualifier"], "NOT")
        self.assertEqual(rows[1]["stance"], "supports")
        self.assertEqual(rows[0]["raw_line"], raw.splitlines()[2])
        self.assertEqual(rows[0]["line_number"], 3)

    def test_unknown_qualifier_fails_closed(self):
        raw = "database_id\tqualifier\thpo_id\taspect\nOMIM:123456\tSOMETIMES\tHP:0001250\tP"
        with self.assertRaisesRegex(ValueError, "Unknown HPO qualifier"):
            parse_hpoa(raw, {"OMIM:123456": "dis_test"}, {"HP:0001250"})


class IdentifierTests(unittest.TestCase):
    def test_related_or_broader_concepts_are_not_identity_aliases(self):
        term = {"synonyms": ["Seizures", "Epilepsy", "Convulsion"], "obo_synonym": [
            {"name": "Seizures", "scope": "hasExactSynonym"},
            {"name": "Epilepsy", "scope": "hasRelatedSynonym"},
            {"name": "Convulsion", "scope": "hasBroadSynonym"},
        ]}
        exact, other = term_aliases(term)
        self.assertEqual(exact, ["Seizures"])
        self.assertEqual({(item["name"], item["scope"]) for item in other},
                         {("Epilepsy", "hasRelatedSynonym"), ("Convulsion", "hasBroadSynonym")})
        # Missing scope must not silently promote a flattened synonym to exact.
        self.assertEqual(term_aliases({"synonyms": ["Epilepsy"]}),
                         ([], [{"name": "Epilepsy", "scope": "untyped_in_ols_response"}]))

    def test_obsolete_term_requires_explicit_review(self):
        payload = {"_embedded": {"terms": [{"obo_id": "MONDO:0000001", "is_obsolete": True, "term_replaced_by": "MONDO:0000002"}]}}
        with self.assertRaisesRegex(ValueError, "Obsolete"):
            active_term(payload, "MONDO:0000001")
        with self.assertRaisesRegex(ValueError, "exact ontology term"):
            active_term(payload, "MONDO:0000002")

    def test_only_exact_mappings_can_join_hpo_annotations(self):
        term = {"obo_id": "MONDO:0000001", "obo_xref": [
            {"database": "OMIM", "id": "123456", "description": "MONDO:equivalentTo"},
            {"database": "Orphanet", "id": "999", "description": "MONDO:relatedTo"},
        ]}
        self.assertEqual(exact_disease_ids(term), {"MONDO": "MONDO:0000001", "OMIM": "123456"})
        self.assertEqual(exact_disease_ids({"obo_id": "MONDO:0000001", "obo_xref": None}), {"MONDO": "MONDO:0000001"})

    def test_gene_symbol_or_hgnc_identity_mismatch_is_rejected(self):
        record = {"symbol": "SETBP1", "status": "Approved", "hgnc_id": "HGNC:15573", "entrez_id": "26040"}
        with self.assertRaisesRegex(ValueError, "mismatched"):
            reconcile_gene(record, "SCN2A")
        record["symbol"] = "SCN2A"
        record["hgnc_id"] = "11444"
        with self.assertRaisesRegex(ValueError, "Missing HGNC"):
            reconcile_gene(record, "SCN2A")

    def test_pathogenic_missense_does_not_become_functional_direction(self):
        genes = {"SCN2A": {"id": "gene_scn2a", "ext_ids": {"NCBIGene": "6326"}}}
        record = {"uid": "196039", "title": "SCN2A test variant", "accession_version": "VCV000196039.1",
                  "genes": [{"symbol": "SCN2A", "geneid": "6326"}],
                  "molecular_consequence_list": ["missense variant"],
                  "germline_classification": {"description": "Pathogenic"}}
        self.assertEqual(normalize_clinvar(record, genes)["props"]["effect"], "unknown")
        record["genes"][0]["geneid"] = "6812"
        with self.assertRaisesRegex(ValueError, "identity mismatch"):
            normalize_clinvar(record, genes)


class CacheTests(unittest.TestCase):
    def test_tampered_bytes_are_not_reused_offline(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            (path / "source.json").write_text('{"changed":true}', encoding="utf-8")
            (path / "source.meta.json").write_text(json.dumps({"source_url": "https://example.org/data", "raw_sha256": digest(b'{"changed":false}')}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "provenance mismatch"):
                SourceCache(path, offline=True).json("source", "https://example.org/data", "HPO")


class ClinVarIdentityTests(unittest.TestCase):
    def setUp(self):
        self.genes = {
            "SCN2A": {"id": "gene_scn2a", "ext_ids": {"NCBIGene": "6326"}},
            "KCNQ2": {"id": "gene_kcnq2", "ext_ids": {"NCBIGene": "3785"}},
        }
        self.record = {
            "uid": "4945793", "title": "NM_172107.4(KCNQ2):c.387+2del",
            "accession_version": "VCV004945793.1",
            "genes": [{"symbol": "KCNQ2", "geneid": "3785"}],
            "germline_classification": {"description": "Pathogenic"},
            "molecular_consequence_list": ["splice donor variant"],
            "protein_change": "",
        }

    def test_missing_substituted_duplicate_or_extra_summary_fails(self):
        uid = self.record["uid"]
        valid = {"result": {"uids": [uid], uid: self.record}}
        cases = []
        missing = copy.deepcopy(valid)
        del missing["result"][uid]
        cases.append(missing)
        substituted = copy.deepcopy(valid)
        substituted["result"][uid]["uid"] = "196039"
        cases.append(substituted)
        duplicate = copy.deepcopy(valid)
        duplicate["result"]["uids"].append(uid)
        cases.append(duplicate)
        extra = copy.deepcopy(valid)
        extra["result"]["uids"].append("196039")
        cases.append(extra)
        for payload in cases:
            with self.subTest(payload=payload):
                with self.assertRaisesRegex(ValueError, "pinned request"):
                    clinvar_records(payload, (uid,))

    def test_response_order_does_not_reassign_pinned_ids(self):
        first = {"uid": "196039"}
        second = {"uid": "194555"}
        payload = {"result": {"uids": ["194555", "196039"], "196039": first, "194555": second}}
        self.assertEqual(clinvar_records(payload, ("196039", "194555")), [first, second])

    def test_accession_cannot_be_substituted_for_a_different_variation(self):
        for accession in ("VCV000196039.1", "VCV004945793", "RCV004945793.1"):
            with self.subTest(accession=accession):
                record = {**self.record, "accession_version": accession}
                with self.assertRaisesRegex(ValueError, "accession/Variation ID mismatch"):
                    normalize_clinvar(record, self.genes, expected_symbol="KCNQ2")

    def test_another_valid_slice_gene_cannot_satisfy_requested_gene(self):
        with self.assertRaisesRegex(ValueError, "gene identity mismatch"):
            normalize_clinvar(self.record, self.genes, expected_symbol="SCN2A")
        record = copy.deepcopy(self.record)
        record["genes"].append({"symbol": "UNRELATED", "geneid": "999999"})
        with self.assertRaisesRegex(ValueError, "gene identity mismatch"):
            normalize_clinvar(record, self.genes, expected_symbol="KCNQ2")

    def test_splice_or_frameshift_consequence_does_not_assign_function(self):
        for consequence in ("splice donor variant", "frameshift variant"):
            with self.subTest(consequence=consequence):
                record = {**self.record, "molecular_consequence_list": [consequence]}
                node = normalize_clinvar(record, self.genes, expected_symbol="KCNQ2")
                self.assertEqual(node["props"]["effect"], "unknown")
                self.assertEqual(node["props"]["classification"], "Pathogenic")
                self.assertEqual(node["synonyms"], [])

    def test_all_four_genes_have_pinned_auditable_offline_identity_coverage(self):
        snapshot = json.loads((ROOT / "data/curation/ontology_slice.json").read_text(encoding="utf-8"))
        with patch("urllib.request.urlopen", side_effect=AssertionError("Offline build attempted network")):
            rebuilt = build_slice(SourceCache(ROOT / "data/raw/ontologies", offline=True))
        self.assertEqual(rebuilt, snapshot)
        self.assertEqual({v["props"]["gene_symbol"] for v in rebuilt["variants"]}, set(GENES))
        self.assertEqual(len(rebuilt["variants"]), 5)
        for variant in rebuilt["variants"]:
            props = variant["props"]
            uid = variant["ext_ids"]["ClinVarVariation"]
            self.assertIn(uid, CLINVAR_IDS_BY_GENE[props["gene_symbol"]])
            self.assertEqual(props["effect"], "unknown")
            self.assertNotIn("effect_evidence_edge_ids", props)
            ev = variant["provenance"]
            raw = (ROOT / "data" / ev["cache_path"]).read_bytes()
            self.assertEqual(digest(raw), ev["raw_sha256"])
            self.assertEqual(json.loads(raw)["result"][uid], ev["source_record"])
            self.assertEqual(ev["record_sha256"], digest(canonical_json(ev["source_record"]).encode("utf-8")))


if __name__ == "__main__":
    unittest.main()
