"""Offline cache audit boundaries, content bindings and source record units."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_cache import (audit_pinned, check_references, inventory_raw,
                         raw_references, safe_raw_path, write_report)
from restore_pubmed import content_digest
from validate_graph import digest


class CacheAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.data = Path(self.tmp.name)
        (self.data / "raw").mkdir()

    def save(self, relative, value):
        path = self.data / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def test_inventory_preserves_bytes_and_separates_housekeeping(self):
        body = b"one\r\ntwo\r\n"
        (self.data / "raw/source.txt").write_bytes(body)
        (self.data / "raw/.gitkeep").touch()
        (self.data / "raw/groups").mkdir()
        (self.data / "raw/groups/curate_community.py").write_text("# Helper\n", encoding="utf-8")
        rows, errors = inventory_raw(self.data)
        self.assertEqual(errors, [])
        self.assertEqual(sum(row["kind"] == "housekeeping" for row in rows), 2)
        source = next(row for row in rows if row["kind"] == "data")
        self.assertEqual(source["size_bytes"], len(body))
        self.assertEqual(source["sha256"], hashlib.sha256(body).hexdigest())
        self.assertEqual((self.data / "raw/source.txt").read_bytes(), body)

    def test_suspected_secret_is_not_opened_and_runtime_file_is_flagged(self):
        secret = self.data / "raw/.env"
        secret.write_text("SECRET_DO_NOT_READ=fixture", encoding="utf-8")
        (self.data / "raw/session.tmp").write_bytes(b"temporary")
        original_open = Path.open

        def guarded_open(path, *args, **kwargs):
            self.assertNotEqual(path, secret, "Secret file contents must not be read")
            return original_open(path, *args, **kwargs)

        with patch.object(Path, "open", guarded_open):
            rows, errors = inventory_raw(self.data)
        self.assertEqual(len(errors), 2)
        env_row = next(row for row in rows if row["kind"] == "suspected_secret")
        self.assertIsNone(env_row["sha256"])
        self.assertEqual(env_row["hash_status"], "not_read_suspected_secret")
        self.assertNotIn("SECRET_DO_NOT_READ", json.dumps(rows))

    def test_references_reject_missing_escape_and_changed_bytes(self):
        self.save("raw/record.json", {"changed": True})
        rows, _ = inventory_raw(self.data)
        refs = raw_references({
            "cache_path": "raw/record.json", "raw_sha256": "0" * 64,
            "raw_checks": [{"path": "raw/missing.json", "sha256": "0" * 64}],
            "source": {"body_path": "raw/../../outside.txt"},
        }, "curation/fixture.json")
        errors = check_references(self.data, rows, refs)
        self.assertEqual(len(errors), 3)
        self.assertTrue(any("SHA-256 differs" in error for error in errors))
        self.assertTrue(any("missing referenced" in error for error in errors))
        self.assertTrue(any("stay within" in error for error in errors))
        with self.assertRaises(ValueError):
            safe_raw_path(self.data, r"C:\outside\record.json")

    def test_symlink_reference_is_never_followed(self):
        outside = self.data / "outside.json"
        outside.write_text("sensitive fixture", encoding="utf-8")
        link = self.data / "raw/link.json"
        try:
            link.symlink_to(outside)
        except OSError:
            self.skipTest("Host does not permit unprivileged symlinks")
        with self.assertRaisesRegex(ValueError, "link"):
            safe_raw_path(self.data, "raw/link.json")
        rows, errors = inventory_raw(self.data)
        self.assertTrue(errors)
        self.assertEqual(rows[0]["kind"], "unsafe_link")
        self.assertIsNone(rows[0]["sha256"])

    def test_pubmed_requires_complete_membership_content_and_six_fields(self):
        record = {"pmid": "123", "title": "Fixture", "abstract": "A source abstract.",
                  "authors": ["Researcher"], "url": "https://pubmed.ncbi.nlm.nih.gov/123/",
                  "retrieved_at": "2026-01-01T00:00:00Z"}
        expected = [{"pmid": "123", "content_sha256": content_digest(record)}]
        self.save("raw/pubmed/123.json", record)
        self.assertEqual(audit_pinned(self.data, "pubmed", expected)["verified_count"], 1)
        # Retrieval timestamps can change; the pinned scientific content cannot.
        self.save("raw/pubmed/123.json", {**record, "retrieved_at": "2026-01-02T00:00:00Z"})
        self.assertEqual(audit_pinned(self.data, "pubmed", expected)["errors"], [])
        self.save("raw/pubmed/456.json", {**record, "pmid": "456"})
        self.save("raw/pubmed/123.json", {**record, "extra": "not in P2 interface"})
        errors = audit_pinned(self.data, "pubmed", expected)["errors"]
        self.assertTrue(any("six-field" in error for error in errors))
        self.assertTrue(any("unpinned" in error for error in errors))
        self.save("raw/pubmed/123.json", {**record, "abstract": "Changed meaning."})
        self.assertTrue(any("digest differs" in error for error in audit_pinned(self.data, "pubmed", expected)["errors"]))

    def test_nih_annual_applications_are_not_deduplicated_by_project(self):
        records = [{"appl_id": 123, "project_num": "R01-FIXTURE", "fiscal_year": 2024},
                   {"appl_id": 456, "project_num": "R01-FIXTURE", "fiscal_year": 2025}]
        for record in records:
            self.save(f"raw/reporter/projects/{record['appl_id']}.json", record)
        expected = [{"id": str(record["appl_id"]), "content_sha256": digest(record)} for record in records]
        report = audit_pinned(self.data, "reporter", expected)
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["verified_count"], 2)
        self.assertIn("not unique research projects", report["record_unit"])

    def test_report_cannot_contaminate_raw_cache(self):
        with self.assertRaisesRegex(ValueError, "acceptance"):
            write_report(self.data / "raw/audit.json", self.data, {})
        self.assertFalse((self.data / "raw/audit.json").exists())
        write_report(self.data / "acceptance/audit.json", self.data, {"status": "passed"})
        self.assertEqual(json.loads((self.data / "acceptance/audit.json").read_text()), {"status": "passed"})


if __name__ == "__main__":
    unittest.main()
