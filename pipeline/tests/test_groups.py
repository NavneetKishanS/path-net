"""Offline checks for robots compliance, paid-backend opt-in and source integrity."""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_groups import (BRIGHTDATA_ENDPOINT, FetchError, PublicFetcher, RobotsDenied,
                          extract_text, quote_locator, sha256, validate_curation, refresh_provenance)


def response(status=200, body="", headers=None):
    item = requests.Response()
    item.status_code = status
    item._content = body.encode("utf-8")
    item.headers.update(headers or {"Content-Type": "text/html; charset=utf-8"})
    item.encoding = "utf-8"
    return item


class FakeSession:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.headers = {}
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        item = next(self.responses)
        if isinstance(item, Exception):
            raise item
        return item


class PublicFetcherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.raw = Path(self.temp.name) / "raw"
        self.source = {"id": "group", "kind": "groups", "url": "https://example.org/public"}

    def fetcher(self, session, **kwargs):
        return PublicFetcher(raw_dir=self.raw, session=session, interval=0, sleeper=lambda _: None, **kwargs)

    def test_direct_is_default_even_when_brightdata_credentials_exist(self):
        session = FakeSession([response(404), response(body="<p>Public group for Gene A.</p>")])
        with patch.dict(os.environ, {"BRIGHTDATA_API_KEY": "test-key", "BRIGHTDATA_UNLOCKER_ZONE": "test-zone"}):
            record = self.fetcher(session).fetch(self.source)
        self.assertEqual(record["backend"], "direct")
        self.assertTrue(all(call[0] == "GET" for call in session.calls))
        self.assertNotIn(BRIGHTDATA_ENDPOINT, [call[1] for call in session.calls])

    def test_brightdata_requires_both_credentials_before_any_request(self):
        session = FakeSession([])
        with patch.dict(os.environ, {"BRIGHTDATA_API_KEY": "", "BRIGHTDATA_UNLOCKER_ZONE": ""}):
            with self.assertRaisesRegex(FetchError, "no API request sent"):
                self.fetcher(session, backend="brightdata")
        self.assertEqual(session.calls, [])

    def test_robots_denial_blocks_direct_and_brightdata(self):
        for backend in ["direct", "brightdata"]:
            with self.subTest(backend=backend), patch.dict(os.environ, {"BRIGHTDATA_API_KEY": "test", "BRIGHTDATA_UNLOCKER_ZONE": "test"}):
                session = FakeSession([response(body="User-agent: *\nDisallow: /public\n", headers={"Content-Type": "text/plain"})])
                with self.assertRaises(RobotsDenied):
                    self.fetcher(session, backend=backend).fetch(self.source)
                self.assertTrue(all(call[1].endswith("/robots.txt") for call in session.calls))

    def test_fresh_cache_performs_no_http_and_rejects_tampering(self):
        original = FakeSession([response(404), response(body="<p>Registry for Gene A.</p>")])
        record = self.fetcher(original).fetch(self.source)
        offline = FakeSession([])
        self.assertEqual(self.fetcher(offline).fetch(self.source), record)
        self.assertEqual(offline.calls, [])
        (self.raw / "groups" / "group.txt").write_text("Tampered evidence", encoding="utf-8")
        with self.assertRaisesRegex(FetchError, "hash mismatch"):
            self.fetcher(FakeSession([])).fetch(self.source)

    def test_redirect_checks_destination_robots_before_loading(self):
        session = FakeSession([
            response(404), response(302, headers={"Location": "https://blocked.example/new"}),
            response(body="User-agent: *\nDisallow: /\n", headers={"Content-Type": "text/plain"}),
        ])
        with self.assertRaises(RobotsDenied):
            self.fetcher(session).fetch(self.source)
        self.assertEqual([c[1] for c in session.calls], [
            "https://example.org/robots.txt", self.source["url"], "https://blocked.example/robots.txt"])

    def test_transient_server_error_retries_but_permanent_error_does_not(self):
        session = FakeSession([response(404), response(503), response(body="<p>Recovered</p>")])
        self.assertEqual(self.fetcher(session).fetch(self.source)["status_code"], 200)
        self.assertEqual(len(session.calls), 3)
        session = FakeSession([response(403)])
        other = {**self.source, "url": "https://other.example/public"}
        with self.assertRaises(RobotsDenied):
            self.fetcher(session).fetch(other)
        self.assertEqual(len(session.calls), 1)

    def test_brightdata_uses_structured_response_without_saving_credentials(self):
        session = FakeSession([response(404), response(body=json.dumps({
            "status": 200, "headers": {"content-type": "text/html"}, "body": "<p>Community</p>"}))])
        with patch.dict(os.environ, {"BRIGHTDATA_API_KEY": "sensitive-test-key", "BRIGHTDATA_UNLOCKER_ZONE": "test-zone"}):
            record = self.fetcher(session, backend="brightdata").fetch(self.source)
        self.assertEqual(session.calls[1][1], BRIGHTDATA_ENDPOINT)
        self.assertEqual(session.calls[1][2]["json"], {"zone": "test-zone", "url": self.source["url"], "format": "json"})
        self.assertNotIn("sensitive-test-key", json.dumps(record))

    def test_quote_validation_requires_exact_text_hash_offsets_url_and_date(self):
        session = FakeSession([response(404), response(body="<p>A natural history study for Gene A.</p>")])
        record = self.fetcher(session).fetch(self.source)
        quote = "natural history study for Gene A"
        text = (self.raw / "groups" / "group.txt").read_text(encoding="utf-8")
        evidence = {"id": "ev_1", "source_url": record["source_url"], "retrieved_at": record["retrieved_at"], "snippet": quote}
        claim = {"evidence_id": "ev_1", "source_id": "group", "body_sha256": record["body_sha256"],
                 "text_sha256": record["text_sha256"], **quote_locator(text, quote)}
        curated = {"sources": [self.source], "evidence": [evidence], "claims": [claim]}
        self.assertEqual(validate_curation(curated, self.raw), 1)
        evidence["snippet"] = "natural history study for Gene B"
        with self.assertRaisesRegex(FetchError, "does not occur verbatim"):
            validate_curation(curated, self.raw)

    def test_text_extraction_decodes_entities_without_changing_punctuation(self):
        text = extract_text(b"<html><head><title>Hidden</title></head><body><p>Research &amp; support</p><script>invented()</script><p>Gene-A's registry.</p></body></html>")
        self.assertEqual(text, "Research & support Gene-A's registry.")
        self.assertEqual(quote_locator(text, "Gene-A's registry.")["quote_sha256"], sha256("Gene-A's registry."))
        with self.assertRaises(FetchError):
            quote_locator(text, "gene-A's registry.")

    def test_cookie_gate_cannot_be_cached_as_evidence(self):
        session = FakeSession([response(404), response(203, "<h1>Cookies must be enabled</h1>")])
        with self.assertRaisesRegex(FetchError, "cookie/access gate"):
            self.fetcher(session).fetch(self.source)
        self.assertFalse((self.raw / "groups" / "group.json").exists())

    def test_pubmed_import_requires_matching_original_xml(self):
        article = {"pmid": "123", "abstract": "Gene A showed loss of function.",
                   "url": "https://pubmed.ncbi.nlm.nih.gov/123/", "retrieved_at": "2026-10-03T21:00:00Z"}
        (self.raw / "pubmed").mkdir(parents=True)
        (self.raw / "pubmed" / "123.json").write_text(json.dumps(article), encoding="utf-8")
        source = {"id": "pmid_123", "pmid": "123", "kind": "mechanisms", "access_method": "pubmed_cache", "url": article["url"]}
        session = FakeSession([])
        fetcher = self.fetcher(session)
        with self.assertRaisesRegex(FetchError, "matching original EFetch XML"):
            fetcher.fetch(source)
        folder = self.raw / "pubmed_searches" / "fixture"
        folder.mkdir(parents=True)
        xml = '<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>123</PMID><Article><Abstract><AbstractText>Gene A showed loss of function.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>'
        (folder / "efetch_fixture.xml").write_text(xml, encoding="utf-8")
        record = fetcher.fetch(source)
        self.assertEqual(record["backend"], "pubmed_api_cache")
        self.assertEqual(record["body_sha256"], sha256(xml))
        self.assertEqual(session.calls, [])

    def test_refresh_rebinds_dates_but_refuses_changed_quotes_atomically(self):
        session = FakeSession([response(404), response(body="<p>Registry for Gene A.</p>")])
        record = self.fetcher(session).fetch(self.source)
        curated = {"sources": [self.source], "evidence": [{"id": "ev_1", "source_url": "old", "retrieved_at": "old", "snippet": "Registry for Gene A."}],
                   "claims": [{"evidence_id": "ev_1", "source_id": "group", "body_sha256": "old", "text_sha256": "old"}]}
        updated = refresh_provenance(curated, self.raw)
        self.assertEqual(updated["evidence"][0]["retrieved_at"], record["retrieved_at"])
        self.assertEqual(curated["evidence"][0]["retrieved_at"], "old")
        self.assertEqual(validate_curation(updated, self.raw), 1)
        curated["evidence"][0]["snippet"] = "Invented quote"
        with self.assertRaises(FetchError):
            refresh_provenance(curated, self.raw)
        self.assertEqual(curated["claims"][0]["body_sha256"], "old")


if __name__ == "__main__":
    unittest.main()
