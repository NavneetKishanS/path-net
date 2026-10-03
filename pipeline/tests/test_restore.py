"""Pinned source replay must detect drift and keep local credentials inert."""
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fetch_pubmed
import fetch_slice
import restore_pubmed


def article(pmid="12345"):
    return {"pmid": pmid, "title": "A fixture study.", "abstract": "A complete fixture abstract.",
            "authors": ["Ada Example"], "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "retrieved_at": "2026-01-01T00:00:00+00:00"}


def pubmed_manifest(records):
    return {"records": [{"pmid": record["pmid"], "content_sha256": restore_pubmed.content_digest(record)}
                        for record in records]}


def response(payload=None, content=None):
    result = Mock()
    result.json.return_value = payload
    result.content = content
    return result


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raw = Path(self.tmp.name)
        for module in (fetch_pubmed, fetch_slice, restore_pubmed):
            override = patch.object(module, "RAW_DIR", self.raw)
            override.start()
            self.addCleanup(override.stop)

    def save(self, relative, record):
        path = self.raw / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(record), encoding="utf-8")

    def test_pubmed_complete_cache_never_uses_network_and_ignores_retrieval_time(self):
        original = article()
        cached = {**original, "retrieved_at": "2026-10-03T00:00:00+00:00"}
        self.save("pubmed/12345.json", cached)
        with patch.object(restore_pubmed, "collect", side_effect=AssertionError("Unexpected network")):
            report = restore_pubmed.restore(pubmed_manifest([original]))
        self.assertEqual(report["changed_pmids"], [])

    def test_pubmed_changed_content_is_not_accepted_as_pinned_release(self):
        original = article()
        self.save("pubmed/12345.json", {**original, "abstract": "A revised claim."})
        with patch.object(restore_pubmed, "collect", side_effect=AssertionError("Unexpected network")):
            with self.assertRaises(ValueError) as raised:
                restore_pubmed.restore(pubmed_manifest([original]))
        self.assertEqual(json.loads(str(raised.exception))["changed_pmids"], ["12345"])

    def test_pubmed_check_only_reports_missing_without_network(self):
        with patch.object(restore_pubmed, "collect", side_effect=AssertionError("Unexpected network")):
            with self.assertRaises(ValueError) as raised:
                restore_pubmed.restore(pubmed_manifest([article()]), check_only=True)
        self.assertEqual(json.loads(str(raised.exception))["missing_pmids"], ["12345"])

    def test_pubmed_refresh_cannot_reuse_an_old_abstract_when_current_response_is_empty(self):
        original = article()
        self.save("pubmed/12345.json", original)
        no_abstract = b"<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>12345</PMID><Article><ArticleTitle>A fixture study.</ArticleTitle></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>"
        with patch.object(fetch_pubmed, "request", side_effect=[
            response({"esearchresult": {"count": "1", "idlist": ["12345"]}}),
            response(content=no_abstract),
        ]):
            with self.assertRaises(ValueError):
                restore_pubmed.restore(pubmed_manifest([original]), refresh=True)

    def test_pubmed_refresh_cannot_reuse_an_old_record_omitted_from_efetch(self):
        original = article()
        self.save("pubmed/12345.json", original)
        with patch.object(fetch_pubmed, "request", side_effect=[
            response({"esearchresult": {"count": "1", "idlist": ["12345"]}}),
            response(content=b"<PubmedArticleSet/>"),
        ]):
            with self.assertRaises(ValueError):
                restore_pubmed.restore(pubmed_manifest([original]), refresh=True)

    def test_pubmed_refresh_detects_ids_omitted_from_esearch_even_with_old_cache(self):
        original = article()
        self.save("pubmed/12345.json", original)
        with patch.object(fetch_pubmed, "request", return_value=response(
            {"esearchresult": {"count": "0", "idlist": []}}
        )):
            with self.assertRaises(ValueError):
                restore_pubmed.restore(pubmed_manifest([original]), refresh=True)

    def test_pubmed_restore_batches_exact_ids_instead_of_replaying_search_ranking(self):
        records = [article(str(10000 + index)) for index in range(41)]
        by_id = {record["pmid"]: record for record in records}

        def collect_explicit(query, maximum, refresh):
            identifiers = re.findall(r"(\d+)\[uid\]", query)
            self.assertEqual(query, " OR ".join(f"{identifier}[uid]" for identifier in identifiers))
            self.assertEqual(maximum, len(identifiers))
            for identifier in identifiers:
                self.save(f"pubmed/{identifier}.json", by_id[identifier])
            return {"cached_pmids": identifiers}

        with patch.object(restore_pubmed, "collect", side_effect=collect_explicit) as collect:
            restore_pubmed.restore(pubmed_manifest(records))
        self.assertEqual([call.kwargs["maximum"] for call in collect.call_args_list], [40, 1])

    def test_research_complete_caches_skip_network_and_content_drift_fails(self):
        study = {"protocolSection": {"identificationModule": {"nctId": "NCT00000001"}}}
        project = {"appl_id": 100, "project_title": "A fixture award"}
        manifest = {
            "clinicaltrials": [{"id": "NCT00000001", "content_sha256": fetch_slice.record_digest(study)}],
            "reporter": [{"id": "100", "content_sha256": fetch_slice.record_digest(project)}],
        }
        self.save("clinicaltrials/studies/NCT00000001.json", study)
        self.save("reporter/projects/100.json", project)
        with patch.object(fetch_slice, "request", side_effect=AssertionError("Unexpected network")):
            fetch_slice.restore_research(manifest)
            self.save("reporter/projects/100.json", {**project, "project_title": "A revised award"})
            with self.assertRaisesRegex(ValueError, "100"):
                fetch_slice.restore_research(manifest)

    def test_reporter_refresh_cannot_validate_old_cache_for_omitted_current_record(self):
        record = {"appl_id": 100, "project_title": "A fixture award"}
        manifest = {"clinicaltrials": [], "reporter": [{"id": "100", "content_sha256": fetch_slice.record_digest(record)}]}
        self.save("reporter/projects/100.json", record)
        with patch.object(fetch_slice, "request", return_value=response({"results": []})):
            with self.assertRaisesRegex(ValueError, "100"):
                fetch_slice.restore_research(manifest, refresh=True)

    def test_wrong_clinicaltrial_id_is_rejected_before_caching(self):
        expected = {"protocolSection": {"identificationModule": {"nctId": "NCT00000001"}}}
        wrong = {"protocolSection": {"identificationModule": {"nctId": "NCT00000002"}}}
        manifest = {"clinicaltrials": [{"id": "NCT00000001", "content_sha256": fetch_slice.record_digest(expected)}], "reporter": []}
        with patch.object(fetch_slice, "request", return_value=response(wrong)):
            with self.assertRaisesRegex(ValueError, "wrong ID"):
                fetch_slice.restore_research(manifest)
        self.assertFalse((self.raw / "clinicaltrials/studies/NCT00000001.json").exists())

    def test_reporter_response_order_does_not_change_exact_id_mapping(self):
        records = [{"appl_id": 100, "project_title": "First"}, {"appl_id": 101, "project_title": "Second"}]
        manifest = {"clinicaltrials": [], "reporter": [
            {"id": str(record["appl_id"]), "content_sha256": fetch_slice.record_digest(record)} for record in records
        ]}
        with patch.object(fetch_slice, "request", return_value=response({"results": list(reversed(records))})) as request:
            fetch_slice.restore_research(manifest)
        self.assertEqual(request.call_args.kwargs["json"]["criteria"]["appl_ids"], [100, 101])
        for record in records:
            self.assertEqual(json.loads((self.raw / f"reporter/projects/{record['appl_id']}.json").read_text()), record)

    def test_missing_reporter_record_is_detected(self):
        record = {"appl_id": 100}
        manifest = {"clinicaltrials": [], "reporter": [{"id": "100", "content_sha256": fetch_slice.record_digest(record)}]}
        with patch.object(fetch_slice, "request", return_value=response({"results": []})):
            with self.assertRaisesRegex(ValueError, "100"):
                fetch_slice.restore_research(manifest)

    def test_env_does_not_overwrite_existing_values_or_execute_shell_text(self):
        env_file = self.raw / ".env"
        literal = '$(echo never-run); `echo never-run`'
        env_file.write_text(
            "\ufeff# Fixture, not credentials\nRESTORE_KEEP=from_file\n"
            f"RESTORE_LITERAL='{literal}'\nRESTORE_QUOTED=\"a=b c\"\n"
            "export RESTORE_BAD=ignored\nRESTORE-NOT-VALID=ignored\n",
            encoding="utf-8",
        )
        with patch.dict(os.environ, {"RESTORE_KEEP": "from_environment"}, clear=True), \
                patch.object(fetch_slice.subprocess, "run", side_effect=AssertionError("Shell execution")), \
                patch.object(os, "system", side_effect=AssertionError("Shell execution")):
            fetch_slice.load_env(env_file)
            self.assertEqual(os.environ["RESTORE_KEEP"], "from_environment")
            self.assertEqual(os.environ["RESTORE_LITERAL"], literal)
            self.assertEqual(os.environ["RESTORE_QUOTED"], "a=b c")
            self.assertNotIn("RESTORE_BAD", os.environ)
            self.assertNotIn("RESTORE-NOT-VALID", os.environ)


if __name__ == "__main__":
    unittest.main()
