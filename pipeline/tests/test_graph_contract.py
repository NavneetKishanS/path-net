"""Consumer-boundary regressions: reject data the UI/SQL cannot safely consume."""
import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_graph import digest, validate_graph, validate_provenance


def small_graph():
    return {
        "nodes": [
            {"id": "dis_test", "type": "disease", "name": "Test condition", "synonyms": [], "ext_ids": {}, "props": {}},
            {"id": "gene_test", "type": "gene", "name": "Test gene", "synonyms": [], "ext_ids": {}, "props": {}},
        ],
        "edges": [{"id": "e_test", "src": "dis_test", "dst": "gene_test", "type": "disease_gene", "tier": "A", "confidence": None, "stance": "supports", "status": "verified", "note": None}],
        "evidence": [{"id": "ev_test", "edge_id": "e_test", "source_type": "test_fixture", "source_url": "https://example.org/fixture", "pmid": None, "snippet": "A fixture for a contract test.", "retrieved_at": "2026-01-01"}],
        "clusters": [{"id": "c_test", "label": "Fixture", "mechanism": {}}],
        "node_cluster": [{"node_id": "dis_test", "cluster_id": "c_test"}],
    }


class ContractTests(unittest.TestCase):
    def test_valid_shape(self):
        self.assertEqual(validate_graph(small_graph()), [])

    def test_wrong_relation_direction(self):
        g = small_graph()
        g["edges"][0].update(src="gene_test", dst="dis_test")
        self.assertTrue(any("endpoint types" in e for e in validate_graph(g)))

    def test_missing_evidence_and_dangling_membership(self):
        g = small_graph()
        g["evidence"] = []
        g["node_cluster"][0]["node_id"] = "missing"
        errors = validate_graph(g)
        self.assertTrue(any("no evidence" in e for e in errors))
        self.assertTrue(any("cluster membership" in e for e in errors))

    def test_sql_and_typescript_field_types(self):
        g = small_graph()
        g["nodes"][0]["ext_ids"] = {"MONDO": ["bad"]}
        g["evidence"][0]["retrieved_at"] = "2026-01-01T10:00:00Z"
        g["edges"][0]["confidence"] = float("nan")
        errors = validate_graph(g)
        self.assertTrue(any("ext_ids" in e for e in errors))
        self.assertTrue(any("YYYY-MM-DD" in e for e in errors))
        self.assertTrue(any("finite number" in e for e in errors))

    def test_duplicate_ids_and_metadata_in_graph(self):
        g = small_graph()
        g["nodes"].append(copy.deepcopy(g["nodes"][0]))
        g["coverage"] = {}
        self.assertTrue(any("duplicate" in e for e in validate_graph(g)))
        self.assertTrue(any("sidecars" in e for e in validate_graph(g)))

    def test_inference_cannot_be_verified(self):
        g = small_graph()
        g["edges"][0]["tier"] = "C"
        self.assertTrue(any("hypothesis" in e for e in validate_graph(g)))

    def test_provenance_detects_tampering_and_missing_source(self):
        g = small_graph()
        ev = g["evidence"][0]
        p = {"graph_sha256": digest(g), "evidence": {ev["id"]: {"evidence_sha256": digest(ev), "source_url": ev["source_url"], "curation_file": "curation/test.json", "raw_checks": [{"path": "raw/test.json", "contains": [ev["snippet"]]}]}}}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "raw").mkdir()
            (root / "raw/test.json").write_text(json.dumps({"text": ev["snippet"]}), encoding="utf-8")
            p["evidence"][ev["id"]]["raw_checks"][0]["sha256"] = hashlib.sha256((root / "raw/test.json").read_bytes()).hexdigest()
            self.assertEqual(validate_provenance(g, p, root, True), [])
            (root / "raw/test.json").write_text('{"text": "not the source"}', encoding="utf-8")
            self.assertTrue(any("reviewed evidence" in e for e in validate_provenance(g, p, root, True)))
        g["edges"][0]["stance"] = "contradicts"
        self.assertTrue(any("digest" in e for e in validate_provenance(g, p)))


if __name__ == "__main__":
    unittest.main()
