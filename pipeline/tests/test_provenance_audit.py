"""Ensure provenance audits fail when a review binding is removed or changed."""
import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_graph import digest, validate_provenance


class ProvenanceAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.data = Path(self.tmp.name)
        (self.data / "raw").mkdir()
        (self.data / "curation").mkdir()
        self.record = {"briefTitle": "A fixture study.", "overallStatus": "RECRUITING"}
        raw = json.dumps(self.record).encode("utf-8")
        (self.data / "raw/study.json").write_bytes(raw)
        (self.data / "curation/study.json").write_text(json.dumps(self.record), encoding="utf-8")
        ev = {"id": "ev_fixture", "edge_id": "e_fixture", "source_type": "test_fixture",
              "source_url": "https://example.org/fixture", "snippet": "A fixture study.",
              "pmid": None, "retrieved_at": "2026-01-01"}
        self.graph = {"evidence": [ev]}
        self.provenance = {
            "graph_sha256": digest(self.graph),
            "curation_inputs": {"curation/study.json": digest(self.record)},
            "evidence": {"ev_fixture": {
                "evidence_sha256": digest(ev), "source_url": ev["source_url"],
                "curation_file": "curation/study.json", "source_record": copy.deepcopy(self.record),
                "record_sha256": digest(self.record), "raw_checks": [{
                    "path": "raw/study.json", "sha256": hashlib.sha256(raw).hexdigest(),
                    "contains": [ev["snippet"]],
                }],
            }},
        }

    def audit(self):
        return validate_provenance(self.graph, self.provenance, self.data, check_raw=True)

    def test_valid_reviewed_source(self):
        self.assertEqual(self.audit(), [])

    def test_existing_path_without_digest_is_not_a_successful_raw_check(self):
        check = self.provenance["evidence"]["ev_fixture"]["raw_checks"][0]
        del check["sha256"]
        del check["contains"]
        self.assertTrue(any("requires a SHA-256" in error for error in self.audit()))

    def test_changed_structured_record_fails_even_when_quote_is_unchanged(self):
        self.provenance["evidence"]["ev_fixture"]["source_record"]["overallStatus"] = "COMPLETED"
        self.assertTrue(any("source record digest mismatch" in error for error in self.audit()))

    def test_missing_record_binding_is_rejected(self):
        del self.provenance["evidence"]["ev_fixture"]["record_sha256"]
        self.assertTrue(any("source record digest mismatch" in error for error in self.audit()))

    def test_changed_curation_snapshot_invalidates_review(self):
        changed = {**self.record, "overallStatus": "COMPLETED"}
        (self.data / "curation/study.json").write_text(json.dumps(changed), encoding="utf-8")
        self.assertTrue(any("Curation input changed" in error for error in self.audit()))

    def test_changed_raw_record_fails_even_when_quote_remains_present(self):
        changed = {**self.record, "overallStatus": "COMPLETED"}
        (self.data / "raw/study.json").write_text(json.dumps(changed), encoding="utf-8")
        self.assertTrue(any("raw cache digest mismatch" in error for error in self.audit()))


if __name__ == "__main__":
    unittest.main()
