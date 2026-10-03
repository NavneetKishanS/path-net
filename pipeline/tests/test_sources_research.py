"""Offline parsing, cache, pagination and retry tests for P1 research sources."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fetch_clinicaltrials as trials
import fetch_pubmed as pubmed
import fetch_reporter as reporter


ARTICLE_XML = b'''<PubmedArticleSet><PubmedArticle><MedlineCitation>
<PMID>12345</PMID><Article><ArticleTitle>A <i>gene</i> study.</ArticleTitle>
<Abstract><AbstractText Label="BACKGROUND">First <b>exact</b> sentence.</AbstractText>
<AbstractText Label="RESULTS">Second sentence.</AbstractText></Abstract>
<AuthorList><Author><ForeName>Ada</ForeName><LastName>Example</LastName></Author>
<Author><CollectiveName>Example Consortium</CollectiveName></Author>
<Author><Initials>BC</Initials><LastName>Sample</LastName></Author></AuthorList>
</Article></MedlineCitation><PubmedData><ReferenceList><Reference><ArticleIdList>
<ArticleId IdType="pubmed">99999</ArticleId></ArticleIdList></Reference></ReferenceList>
</PubmedData></PubmedArticle><PubmedArticle><MedlineCitation><PMID>67890</PMID>
<Article><ArticleTitle>No abstract</ArticleTitle></Article></MedlineCitation>
</PubmedArticle></PubmedArticleSet>'''


def response(payload):
    item = Mock()
    item.json.return_value = payload
    return item


class PubMedTests(unittest.TestCase):
    def test_nested_text_and_author_types_preserve_extraction_contract(self):
        records = pubmed.parse_articles(ARTICLE_XML, "2026-10-03T00:00:00+00:00")
        self.assertEqual(records[0]["title"], "A gene study.")
        self.assertEqual(records[0]["abstract"], "First exact sentence. Second sentence.")
        self.assertEqual(records[0]["authors"], ["Ada Example", "Example Consortium", "BC Sample"])
        self.assertEqual(records[0]["pmid"], "12345")
        self.assertEqual(set(records[0]), {"pmid", "title", "abstract", "authors", "url", "retrieved_at"})
        self.assertEqual(records[1]["abstract"], "")

    def test_api_error_is_not_accepted_as_empty_dataset(self):
        with self.assertRaises(ValueError):
            pubmed.parse_articles(b"<eFetchResult><ERROR>unavailable</ERROR></eFetchResult>")

    def test_book_abstracts_use_chapter_authors_instead_of_book_editors(self):
        xml = b'''<PubmedArticleSet><PubmedBookArticle><BookDocument><PMID>12345</PMID>
        <Book><AuthorList><Author><LastName>Editor</LastName></Author></AuthorList></Book>
        <ArticleTitle>A chapter</ArticleTitle><Abstract><AbstractText>Chapter abstract.</AbstractText></Abstract>
        <AuthorList><Author><ForeName>Ada</ForeName><LastName>Author</LastName></Author></AuthorList>
        </BookDocument></PubmedBookArticle></PubmedArticleSet>'''
        record = pubmed.parse_articles(xml)[0]
        self.assertEqual(record["abstract"], "Chapter abstract.")
        self.assertEqual(record["authors"], ["Ada Author"])

    def test_only_nonempty_records_enter_extraction_directory_and_rerun_is_offline(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(pubmed, "RAW_DIR", Path(folder)):
            xml_response = Mock(content=ARTICLE_XML)
            search_response = response({"esearchresult": {"count": "2", "idlist": ["12345", "67890"]}})
            with patch.object(pubmed, "request", side_effect=[search_response, xml_response]):
                result = pubmed.collect("fixture", 2, "2026/10/03")
            self.assertEqual(result["cached_pmids"], ["12345"])
            self.assertEqual(result["missing_abstract_pmids"], ["67890"])
            self.assertEqual([p.name for p in (Path(folder) / "pubmed").iterdir()], ["12345.json"])
            self.assertTrue(list((Path(folder) / "pubmed_searches").glob("*/*.xml")))
            with patch.object(pubmed, "request", side_effect=AssertionError("network used")):
                self.assertEqual(pubmed.collect("fixture", 2, "2026/10/03"), result)


class TrialTests(unittest.TestCase):
    def test_validates_ids(self):
        with self.assertRaises(ValueError):
            trials.study_id({"protocolSection": {"identificationModule": {"nctId": "../../bad"}}})

    def test_pagination_preserves_complete_records_and_reuses_cache(self):
        first = {"protocolSection": {"identificationModule": {"nctId": "NCT00000001"}}, "extraOfficialField": "retain me"}
        second = {"protocolSection": {"identificationModule": {"nctId": "NCT00000002"}}, "hasResults": False}
        with tempfile.TemporaryDirectory() as folder, patch.object(trials, "RAW_DIR", Path(folder)):
            with patch.object(trials, "request", side_effect=[
                response({"studies": [first], "totalCount": 2, "nextPageToken": "next"}),
                response({"studies": [second], "totalCount": 2}),
            ]) as mock_request:
                result = trials.collect("fixture", 2)
            self.assertEqual(mock_request.call_args_list[1].kwargs["params"]["pageToken"], "next")
            stored = json.loads((Path(folder) / "clinicaltrials/studies/NCT00000001.json").read_text())
            self.assertEqual(stored, first)
            self.assertFalse(result["truncated"])
            with patch.object(trials, "request", side_effect=AssertionError("network used")):
                self.assertEqual(trials.collect("fixture", 2), result)


class ReporterTests(unittest.TestCase):
    def test_validates_application_id(self):
        with self.assertRaises(ValueError):
            reporter.project_id({"appl_id": "../../bad"})

    def test_complete_records_and_annual_awards_are_not_collapsed(self):
        first = {"appl_id": 100, "core_project_num": "R01EXAMPLE", "fiscal_year": 2025,
                 "principal_investigators": [{"profile_id": 9}], "extraOfficialField": [1, 2]}
        second = {"appl_id": 101, "core_project_num": "R01EXAMPLE", "fiscal_year": 2026}
        with tempfile.TemporaryDirectory() as folder, patch.object(reporter, "RAW_DIR", Path(folder)):
            with patch.object(reporter, "request", side_effect=[
                response({"meta": {"total": 2}, "results": [first]}),
                response({"meta": {"total": 2}, "results": [second]}),
            ]) as mock_request:
                result = reporter.collect("fixture", 2)
            self.assertEqual(mock_request.call_args_list[1].kwargs["json"]["offset"], 1)
            self.assertEqual(result["application_ids"], ["100", "101"])
            stored = json.loads((Path(folder) / "reporter/projects/100.json").read_text())
            self.assertEqual(stored, first)
            with patch.object(reporter, "request", side_effect=AssertionError("network used")):
                self.assertEqual(reporter.collect("fixture", 2), result)


class RequestTests(unittest.TestCase):
    @patch.object(pubmed.time, "sleep")
    def test_error_does_not_echo_ncbi_query_credentials(self, sleep):
        denied = requests.Response()
        denied.status_code = 400
        denied.url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?api_key=private-fixture-key"
        session = Mock()
        session.request.return_value = denied
        with self.assertRaises(requests.HTTPError) as result:
            pubmed.request(session, "GET", "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", params={"api_key": "private-fixture-key"})
        self.assertNotIn("private-fixture-key", str(result.exception))

    @patch.object(pubmed.time, "sleep")
    def test_rate_limit_is_retried_with_retry_after(self, sleep):
        limited = requests.Response()
        limited.status_code = 429
        limited.headers["Retry-After"] = "3"
        success = requests.Response()
        success.status_code = 200
        session = Mock()
        session.request.side_effect = [limited, success]
        self.assertIs(pubmed.request(session, "GET", "https://example.org", interval=1.1), success)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1.1, 3.0, 1.1])

    @patch.object(pubmed.time, "sleep")
    def test_nontransient_http_error_is_not_retried(self, sleep):
        denied = requests.Response()
        denied.status_code = 400
        session = Mock()
        session.request.return_value = denied
        with self.assertRaises(requests.HTTPError):
            pubmed.request(session, "GET", "https://example.org")
        self.assertEqual(session.request.call_count, 1)


if __name__ == "__main__":
    unittest.main()
