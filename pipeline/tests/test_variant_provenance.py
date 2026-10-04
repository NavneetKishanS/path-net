"""Identity-only ClinVar nodes must be bound to their original source records."""
import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_graph import digest, validate_provenance


class VariantProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.data = Path(self.tmp.name)
        (self.data / "raw").mkdir()
        (self.data / "curation").mkdir()
        self.record = {"uid": "123", "title": "Fixture variant", "accession_version": "VCV000000123.1",
                       "genes": [{"geneid": "456"}], "germline_classification": {"description": "Pathogenic"}}
        body = json.dumps({"result": {"123": self.record}}).encode()
        (self.data / "raw/variant.json").write_bytes(body)
        (self.data / "curation/variants.json").write_text(json.dumps(self.record), encoding="utf-8")
        self.graph = {"nodes": [
            {"id": "gene_fixture", "type": "gene", "ext_ids": {"NCBIGene": "456"}},
            {"id": "var_fixture", "type": "variant", "name": "Fixture variant",
             "ext_ids": {"ClinVarVariation": "123", "ClinVar": "VCV000000123.1"},
             "props": {"gene_id": "gene_fixture", "effect": "unknown"}},
        ], "evidence": []}
        self.source = {"source_url": "https://example.org/clinvar-fixture", "source_record_locator": "result.123",
                       "cache_path": "raw/variant.json", "raw_sha256": hashlib.sha256(body).hexdigest(),
                       "source_record": copy.deepcopy(self.record), "record_sha256": digest(self.record)}
        self.provenance = {"graph_sha256": digest(self.graph),
                           "curation_inputs": {"curation/variants.json": digest(self.record)},
                           "nodes": {"var_fixture": {"curation_file": "curation/variants.json", "source_record": self.source}}}

    def audit(self):
        return validate_provenance(self.graph, self.provenance, self.data, check_raw=True)

    def test_identity_without_functional_edge_is_audited(self):
        self.assertEqual(self.audit(), [])

    def test_missing_identity_source_fails(self):
        self.provenance["nodes"] = {}
        self.assertTrue(any("missing ClinVar identity" in e for e in self.audit()))

    def test_changed_classification_fails_even_when_title_matches(self):
        self.source["source_record"]["germline_classification"]["description"] = "Benign"
        self.assertTrue(any("source record digest" in e for e in self.audit()))

    def test_reviewed_record_must_match_original_cache(self):
        self.source["source_record"]["germline_classification"]["description"] = "Benign"
        self.source["record_sha256"] = digest(self.source["source_record"])
        self.assertTrue(any("raw record differs" in e for e in self.audit()))

    def test_wrong_node_accession_and_gene_fail(self):
        self.graph["nodes"][1]["ext_ids"]["ClinVar"] = "VCV000000999.1"
        self.graph["nodes"][0]["ext_ids"]["NCBIGene"] = "789"
        self.provenance["graph_sha256"] = digest(self.graph)
        errors = self.audit()
        self.assertTrue(any("node identity differs" in e for e in errors))
        self.assertTrue(any("gene identity mismatch" in e for e in errors))

    def test_changed_node_classification_fails(self):
        self.graph["nodes"][1]["props"]["classification"] = "Benign"
        self.provenance["graph_sha256"] = digest(self.graph)
        self.assertTrue(any("clinical property classification" in e for e in self.audit()))

    def test_claimed_effect_requires_separately_supported_mechanism(self):
        self.graph["nodes"][1]["props"]["effect"] = "gain_of_function"
        self.provenance["graph_sha256"] = digest(self.graph)
        self.assertTrue(any("functional effect lacks" in e for e in self.audit()))

    def test_gene_reference_cannot_point_to_another_node_type(self):
        self.graph["nodes"][0]["type"] = "disease"
        self.provenance["graph_sha256"] = digest(self.graph)
        self.assertTrue(any("gene identity mismatch" in e for e in self.audit()))

    def test_removing_one_external_id_cannot_bypass_audit(self):
        del self.graph["nodes"][1]["ext_ids"]["ClinVar"]
        self.provenance["graph_sha256"] = digest(self.graph)
        self.assertTrue(any("node identity differs" in e for e in self.audit()))

    def test_bad_raw_locator_and_path_fail(self):
        self.source["source_record_locator"] = "result.999"
        self.assertTrue(any("raw record locator" in e for e in self.audit()))
        self.source["cache_path"] = "../outside.json"
        self.assertTrue(any("missing or invalid ClinVar raw" in e for e in self.audit()))


if __name__ == "__main__":
    unittest.main()
