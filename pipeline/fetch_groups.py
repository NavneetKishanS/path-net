"""Fetch public community/mechanism pages and verify the curated short quotes.

    python pipeline/fetch_groups.py
    python pipeline/fetch_groups.py --kind mechanisms
    python pipeline/fetch_groups.py --validate-curation
    python pipeline/fetch_groups.py --backend brightdata --kind groups

Direct HTTPS is the default even when a key is present. Bright Data Web Unlocker
requires explicit selection plus BRIGHTDATA_API_KEY and BRIGHTDATA_UNLOCKER_ZONE.
It obeys the target site's robots policy, just like direct fetches. Full bodies
and extracted text are bundled in data/raw; only reviewed quotes enter the graph.
Mechanisms are imported offline from the documented fetch_pubmed.py API cache,
including its original EFetch XML. Run that API collector first if it is missing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

import requests

from common import DATA_DIR, RAW_DIR, save_json

USER_AGENT = "PathNetResearchBot/1.0 (+public-source research; no patient data)"
BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request"
CURATION_FILE = DATA_DIR / "curation" / "community.json"
RETRY_STATUSES = {429, 500, 502, 503, 504}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256(value: bytes | str) -> str:
    if isinstance(value, str):
        value = value.encode("utf-8")
    return hashlib.sha256(value).hexdigest()


class VisibleText(HTMLParser):
    """Keep visible text in document order; exclude code and hidden head content."""

    OMIT = {"script", "style", "noscript", "head", "template"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.OMIT:
            self.depth += 1
        if not self.depth:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in self.OMIT and self.depth:
            self.depth -= 1
        if not self.depth:
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.depth:
            self.parts.append(data)


def extract_text(body: bytes, encoding: str = "utf-8", content_type: str = "text/html") -> str:
    decoded = body.decode(encoding, errors="replace")
    if "html" in content_type:
        parser = VisibleText()
        parser.feed(decoded)
        decoded = "".join(parser.parts)
    elif "xml" in content_type:
        try:
            decoded = " ".join(ET.fromstring(body).itertext())
        except ET.ParseError as exc:
            raise FetchError(f"Malformed XML source: {exc}") from None
    # Quotes are verbatim in this whitespace-normalized visible-text snapshot.
    # Punctuation/case are never changed and ellipses are never inserted.
    return re.sub(r"\s+", " ", decoded).strip()


class FetchError(RuntimeError):
    pass


class RobotsDenied(FetchError):
    pass


class PublicFetcher:
    def __init__(
        self,
        raw_dir: Path = RAW_DIR,
        backend: str = "direct",
        max_age_hours: float = 24,
        retries: int = 2,
        interval: float = 1.0,
        offline: bool = False,
        session=None,
        sleeper=time.sleep,
        clock=time.time,
    ):
        if backend not in {"direct", "brightdata"}:
            raise ValueError("backend must be direct or brightdata")
        self.backend = backend
        self.offline = offline
        self.key = os.environ.get("BRIGHTDATA_API_KEY", "").strip()
        self.zone = os.environ.get("BRIGHTDATA_UNLOCKER_ZONE", "").strip()
        if backend == "brightdata" and not offline and not (self.key and self.zone):
            raise FetchError("Bright Data requires BRIGHTDATA_API_KEY and BRIGHTDATA_UNLOCKER_ZONE; no API request sent")
        self.raw_dir = Path(raw_dir)
        self.max_age_seconds = max_age_hours * 3600
        self.retries = retries
        self.interval = interval
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,text/plain;q=0.9"})
        self.sleep = sleeper
        self.clock = clock
        self.robots: dict[str, tuple[RobotFileParser, dict]] = {}
        self.last_request: dict[str, float] = {}

    @staticmethod
    def _check_url(url: str) -> str:
        parts = urlsplit(url)
        if parts.scheme != "https" or not parts.netloc or parts.username or parts.password:
            raise FetchError("Only public HTTPS URLs without credentials are supported")
        return f"{parts.scheme}://{parts.netloc}"

    def _throttle(self, origin: str, crawl_delay: float = 0):
        if origin in self.last_request:
            delay = max(self.interval, crawl_delay) - (self.clock() - self.last_request[origin])
            if delay > 0:
                self.sleep(delay)
        self.last_request[origin] = self.clock()

    def _request(self, method: str, url: str, **kwargs):
        if self.offline:
            raise FetchError("Offline mode prohibits network requests")
        origin = self._check_url(url)
        for attempt in range(self.retries + 1):
            self._throttle(origin)
            try:
                response = self.session.request(method, url, timeout=45, allow_redirects=False, **kwargs)
            except requests.RequestException:
                if attempt == self.retries:
                    # Do not print request headers, credentials, or provider response bodies.
                    raise FetchError(f"Network request failed for {origin} after {attempt + 1} attempts") from None
                self.sleep(min(2 ** attempt, 30))
                continue
            if response.status_code not in RETRY_STATUSES or attempt == self.retries:
                return response
            delay = min(2 ** attempt, 30)
            retry_after = response.headers.get("Retry-After", "")
            try:
                delay = max(delay, float(retry_after))
            except ValueError:
                try:
                    delay = max(delay, parsedate_to_datetime(retry_after).timestamp() - self.clock())
                except (ValueError, TypeError):
                    pass
            # Very long server waits must be honoured by stopping, not by retrying early.
            if delay > 60:
                raise FetchError(f"Server requested a {delay:.0f}s retry delay for {origin}; retry later")
            self.sleep(max(0, delay))
        raise AssertionError("unreachable")

    def _robots_for(self, url: str) -> tuple[RobotFileParser, dict]:
        origin = self._check_url(url)
        if origin in self.robots:
            return self.robots[origin]
        robot_url = origin + "/robots.txt"
        # Robots cache belongs to groups even when the page is a mechanism source.
        cache = self.raw_dir / "groups" / "robots" / f"{sha256(origin)[:20]}.json"
        record = None
        if cache.exists() and self.clock() - cache.stat().st_mtime <= self.max_age_seconds:
            record = json.loads(cache.read_text(encoding="utf-8"))
        if record is None:
            response = self._request("GET", robot_url)
            status = response.status_code
            if status in {404, 410}:
                rules = "User-agent: *\nAllow: /\n"
            elif status in {401, 403}:
                rules = "User-agent: *\nDisallow: /\n"
            elif 200 <= status < 300:
                rules = response.content.decode("utf-8", errors="replace")
            else:
                # Unknown robots policy is not permission to scrape or use a proxy.
                raise FetchError(f"Cannot establish robots policy at {robot_url}: HTTP {status}")
            rules_source = "response_text" if 200 <= status < 300 else f"local_policy_for_http_{status}"
            record = {"url": robot_url, "status_code": status, "retrieved_at": utc_now(), "text": rules,
                      "sha256": sha256(rules), "rules_source": rules_source, "sha256_scope": "policy_text"}
            save_json(cache, record)
        if sha256(record["text"]) != record["sha256"]:
            raise FetchError(f"Robots cache hash mismatch for {origin}")
        parser = RobotFileParser(robot_url)
        parser.parse(record["text"].splitlines())
        self.robots[origin] = (parser, record)
        return parser, record

    def _permission(self, url: str) -> dict:
        parser, record = self._robots_for(url)
        if not parser.can_fetch(USER_AGENT, url):
            if record["status_code"] in {401, 403}:
                raise RobotsDenied(f"robots.txt returned HTTP {record['status_code']} for {url}; permission is not established, no page or proxy request sent")
            raise RobotsDenied(f"robots.txt disallows {url}; no page or proxy request sent")
        self._throttle(self._check_url(url), parser.crawl_delay(USER_AGENT) or 0)
        return {"url": record["url"], "sha256": record["sha256"], "retrieved_at": record["retrieved_at"], "allowed": True}

    @staticmethod
    def _provider_response(response) -> tuple[int, dict, bytes]:
        """Validate the documented structured response without exposing its body.

        Bright Data examples use status for synchronous JSON responses and
        status_code for asynchronous responses. Accept both without treating the
        provider's outer HTTP 200 as proof of successful target retrieval.
        """
        try:
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError
            status = result.get("status", result.get("status_code"))
            if isinstance(status, bool) or not str(status).isdigit():
                raise ValueError
            status = int(status)
            if not 100 <= status <= 599:
                raise ValueError
            if "status" in result and "status_code" in result and str(result["status"]) != str(result["status_code"]):
                raise ValueError
            headers, body = result.get("headers", {}), result.get("body")
            if not isinstance(headers, dict) or not isinstance(body, str):
                raise ValueError
            normalized_headers = {}
            for key, value in headers.items():
                if not isinstance(key, str):
                    raise ValueError
                # The live structured API returns arrays for repeated headers.
                # Keep the client independent of singleton/repeated encoding.
                if isinstance(value, list) and all(isinstance(item, str) for item in value):
                    value = ", ".join(value)
                if not isinstance(value, str):
                    raise ValueError
                normalized_headers[key.lower()] = value
        except (ValueError, TypeError):
            raise FetchError("Bright Data returned a malformed structured target response; no snapshot saved") from None
        return status, normalized_headers, body.encode("utf-8")

    def fetch(self, source: dict, force: bool = False) -> dict:
        source_id = source["id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", source_id):
            raise FetchError("source id must be a simple slug")
        kind = source.get("kind", "groups")
        if kind not in {"groups", "mechanisms"}:
            raise FetchError("source kind must be groups or mechanisms")
        if source.get("access_method") == "pubmed_cache":
            return self.import_pubmed(source)
        folder = self.raw_dir / kind
        meta_path = folder / f"{source_id}.json"
        body_path = folder / f"{source_id}.body"
        text_path = folder / f"{source_id}.txt"
        if not force and meta_path.exists() and (self.offline or self.clock() - meta_path.stat().st_mtime <= self.max_age_seconds):
            record = json.loads(meta_path.read_text(encoding="utf-8"))
            if record["requested_url"] == source["url"] and body_path.exists() and text_path.exists():
                if not self.offline and self.backend == "brightdata" and record.get("backend") != self.backend:
                    raise FetchError("Cached backend differs from requested backend; use --force or a separate --raw-dir for an explicit fresh retrieval")
                self.verify_record(record, body_path.read_bytes(), text_path.read_text(encoding="utf-8"))
                return record
        if self.offline:
            raise FetchError(f"Offline cache is missing or incomplete for {source_id}; no network request sent")
        current = source["url"]
        robots_checks = []
        for _ in range(6):
            robots_checks.append(self._permission(current))
            if self.backend == "brightdata":
                response = self._request(
                    "POST", BRIGHTDATA_ENDPOINT,
                    headers={"Authorization": f"Bearer {self.key}"},
                    json={"zone": self.zone, "url": current, "format": "json"},
                )
                if response.status_code != 200:
                    raise FetchError(f"Bright Data request failed: HTTP {response.status_code}")
                status, target_headers, body = self._provider_response(response)
                encoding = "utf-8"
            else:
                response = self._request("GET", current)
                status = response.status_code
                target_headers = {k.lower(): v for k, v in response.headers.items()}
                body = response.content
                encoding = response.encoding or "utf-8"
                # HTML without a declared charset is commonly UTF-8, rather than
                # requests' legacy ISO-8859-1 default for text/html.
                if "charset=" not in target_headers.get("content-type", "").lower():
                    encoding = "utf-8"
            if status in {301, 302, 303, 307, 308}:
                location = target_headers.get("location")
                if not location:
                    raise FetchError(f"Redirect without Location at {current}")
                current = urljoin(current, location)
                self._check_url(current)
                continue
            if not 200 <= status < 300:
                raise FetchError(f"Page fetch failed: HTTP {status} at {current}")
            content_type = target_headers.get("content-type", "text/html")
            if not any(t in content_type for t in ("html", "text/plain", "xml", "json")):
                raise FetchError(f"Unsupported page content type at {current}: {content_type}")
            text = extract_text(body, encoding, content_type)
            if not text:
                raise FetchError(f"Empty visible text at {current}")
            if "cookies must be enabled" in text.lower() or "verify you are human" in text.lower():
                raise FetchError(f"Received a cookie/access gate instead of source content at {current}")
            record = {
                "source_id": source_id, "requested_url": source["url"], "source_url": current,
                "retrieved_at": utc_now(), "status_code": status, "backend": self.backend,
                "content_type": content_type, "encoding": encoding,
                "body_sha256": sha256(body), "text_sha256": sha256(text),
                "body_path": str(body_path.relative_to(self.raw_dir.parent)).replace("\\", "/"),
                "text_path": str(text_path.relative_to(self.raw_dir.parent)).replace("\\", "/"),
                "text_normalization": "HTML entities decoded; visible text; whitespace collapsed; punctuation and case preserved",
                "robots_checks": robots_checks,
                "licence": source.get("licence", "No blanket open licence verified; metadata and short quotations only"),
            }
            folder.mkdir(parents=True, exist_ok=True)
            body_path.write_bytes(body)
            text_path.write_text(text, encoding="utf-8")
            save_json(meta_path, record)
            return record
        raise FetchError(f"Too many redirects at {current}")

    def import_pubmed(self, source: dict) -> dict:
        """Copy an original API response; do not scrape API hosts as web pages."""
        pmid = source.get("pmid", "")
        if not pmid.isdigit() or source["kind"] != "mechanisms":
            raise FetchError("PubMed cache import needs a numeric PMID and mechanisms kind")
        article_path = self.raw_dir / "pubmed" / f"{pmid}.json"
        if not article_path.exists():
            raise FetchError(f"Missing PMID {pmid}; first run fetch_pubmed.py with a PMID query")
        article_record = json.loads(article_path.read_text(encoding="utf-8"))
        if article_record.get("pmid") != pmid or not article_record.get("abstract"):
            raise FetchError(f"Incomplete PubMed article cache for {pmid}")
        found = None
        for candidate in sorted((self.raw_dir / "pubmed_searches").rglob("efetch_*.xml")):
            body = candidate.read_bytes()
            try:
                root = ET.fromstring(body)
            except ET.ParseError:
                continue
            for art in root.findall(".//PubmedArticle"):
                if art.findtext("MedlineCitation/PMID") != pmid:
                    continue
                abstract = " ".join("".join(el.itertext()) for el in art.findall("MedlineCitation/Article/Abstract/AbstractText")).strip()
                if abstract == article_record["abstract"]:
                    found = (candidate, body, abstract)
                    break
            if found:
                break
        if found is None:
            raise FetchError(f"No matching original EFetch XML for PMID {pmid}; refresh its API query")
        original_path, body, abstract = found
        text = re.sub(r"\s+", " ", abstract).strip()
        folder = self.raw_dir / "mechanisms"
        folder.mkdir(parents=True, exist_ok=True)
        body_path = folder / f"{source['id']}.body"
        text_path = folder / f"{source['id']}.txt"
        record = {
            "source_id": source["id"], "requested_url": source["url"],
            "source_url": article_record["url"], "retrieved_at": article_record["retrieved_at"],
            "backend": "pubmed_api_cache", "content_type": "application/xml", "encoding": "utf-8",
            "body_sha256": sha256(body), "text_sha256": sha256(text),
            "body_path": str(body_path.relative_to(self.raw_dir.parent)).replace("\\", "/"),
            "text_path": str(text_path.relative_to(self.raw_dir.parent)).replace("\\", "/"),
            "original_cache_path": str(original_path.relative_to(self.raw_dir.parent)).replace("\\", "/"),
            "text_normalization": "Target PMID abstract from original EFetch XML, inline text preserved, whitespace collapsed",
            "access_policy": "Offline import from documented NCBI E-utilities API collector; website scraping is not used",
            "licence": source.get("licence", "Abstract copyright retained; short attributable quotes only"),
        }
        body_path.write_bytes(body)
        text_path.write_text(text, encoding="utf-8")
        save_json(folder / f"{source['id']}.json", record)
        return record

    @staticmethod
    def verify_record(record: dict, body: bytes, text: str):
        if sha256(body) != record["body_sha256"] or sha256(text) != record["text_sha256"]:
            raise FetchError(f"Cache hash mismatch for {record['source_id']}")


def quote_locator(text: str, quote: str) -> dict:
    if not quote or quote.strip() != quote or len(quote.split()) > 25:
        raise FetchError("Quote must be nonempty, trimmed, and at most 25 words")
    start = text.find(quote)
    if start < 0:
        raise FetchError("Curated quote does not occur verbatim in fetched visible text")
    return {"quote_start": start, "quote_end": start + len(quote), "quote_sha256": sha256(quote)}


def validate_curation(curation: dict, raw_dir: Path = RAW_DIR) -> int:
    sources = {s["id"]: s for s in curation["sources"]}
    claims = {c["evidence_id"]: c for c in curation["claims"]}
    per_source_quotes: dict[str, set[str]] = {}
    checked = 0
    for evidence in curation["evidence"]:
        claim = claims[evidence["id"]]
        source = sources[claim["source_id"]]
        folder = raw_dir / source["kind"]
        record = json.loads((folder / f"{source['id']}.json").read_text(encoding="utf-8"))
        text = (folder / f"{source['id']}.txt").read_text(encoding="utf-8")
        PublicFetcher.verify_record(record, (folder / f"{source['id']}.body").read_bytes(), text)
        locator = quote_locator(text, evidence["snippet"])
        citation_url = source.get("citation_url", record["source_url"])
        if evidence["source_url"] != citation_url or evidence["retrieved_at"] != record["retrieved_at"]:
            raise FetchError(f"Evidence URL/date differs from snapshot: {evidence['id']}")
        for key in ("body_sha256", "text_sha256"):
            if claim[key] != record[key]:
                raise FetchError(f"Curated {key} differs from snapshot: {evidence['id']}")
        if any(claim[key] != value for key, value in locator.items()):
            raise FetchError(f"Curated quote locator differs: {evidence['id']}")
        if text[claim["quote_start"]:claim["quote_end"]] != evidence["snippet"]:
            raise FetchError(f"Invalid quote offsets: {evidence['id']}")
        per_source_quotes.setdefault(source["url"], set()).add(evidence["snippet"])
        checked += 1
    for url, quotes in per_source_quotes.items():
        if sum(len(q.split()) for q in quotes) > 25:
            raise FetchError(f"Combined curated quotations exceed 25 words for {url}")
    return checked


def refresh_provenance(curation: dict, raw_dir: Path = RAW_DIR) -> dict:
    """Rebind an unchanged curated quote to a fresh snapshot after exact matching.

    A fresh retrieval changes the date/body hash. Never retain the old provenance
    merely because the same short quote still matches. Work on a copy, so a changed
    or missing quote fails without partially altering the curation file.
    """
    updated = json.loads(json.dumps(curation))
    sources = {source["id"]: source for source in updated["sources"]}
    claims = {claim["evidence_id"]: claim for claim in updated["claims"]}
    for evidence in updated["evidence"]:
        claim = claims[evidence["id"]]
        source = sources[claim["source_id"]]
        folder = raw_dir / source["kind"]
        record = json.loads((folder / f"{source['id']}.json").read_text(encoding="utf-8"))
        text = (folder / f"{source['id']}.txt").read_text(encoding="utf-8")
        PublicFetcher.verify_record(record, (folder / f"{source['id']}.body").read_bytes(), text)
        locator = quote_locator(text, evidence["snippet"])
        source["snapshot"] = record
        evidence.update(source_url=source.get("citation_url", record["source_url"]), retrieved_at=record["retrieved_at"])
        claim.update(body_sha256=record["body_sha256"], text_sha256=record["text_sha256"], **locator)
    validate_curation(updated, raw_dir)
    return updated


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--kind", choices=["groups", "mechanisms", "all"], default="groups")
    parser.add_argument("--backend", choices=["direct", "brightdata"], default="direct")
    parser.add_argument("--curation", type=Path, default=CURATION_FILE)
    parser.add_argument("--source-id", action="append", help="Fetch only this curated source ID; repeat for a bounded selection")
    parser.add_argument("--raw-dir", type=Path, default=RAW_DIR, help="Use a separate cache root for provider validation without replacing reviewed snapshots")
    parser.add_argument("--report", type=Path, help="Write an acquisition outcome inventory without credentials or provider bodies")
    parser.add_argument("--max-age-hours", type=float, default=24)
    parser.add_argument("--retries", type=int, default=2, help="Retries per HTTP request; use 0 for a single-attempt provider smoke check")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--offline", action="store_true", help="Require existing hash-verified caches, regardless of age; prohibit network fallback")
    parser.add_argument("--validate-curation", action="store_true", help="Offline exact quote, URL, date and hash checks")
    parser.add_argument("--refresh-provenance", action="store_true", help="Update snapshot metadata from local caches only after every unchanged quote matches")
    args = parser.parse_args()
    if args.retries < 0:
        parser.error("--retries must be nonnegative")
    if args.offline and args.force:
        parser.error("--offline cannot be combined with --force")
    curation = json.loads(args.curation.read_text(encoding="utf-8"))
    if args.source_id and (args.refresh_provenance or args.validate_curation):
        parser.error("--source-id selects acquisition only; provenance validation covers the complete curation")
    if args.refresh_provenance:
        updated = refresh_provenance(curation, args.raw_dir)
        save_json(args.curation, updated)
        print(f"Refreshed provenance for {len(updated['evidence'])} unchanged curated quotes")
        return
    if args.validate_curation:
        print(f"Verified {validate_curation(curation, args.raw_dir)} curated quotes against raw snapshots")
        return
    selected = [source for source in curation["sources"] if args.kind == "all" or source["kind"] == args.kind]
    if args.source_id:
        unknown = set(args.source_id) - {source["id"] for source in selected}
        if unknown:
            parser.error(f"Unknown source IDs for selected kind: {', '.join(sorted(unknown))}")
        selected = [source for source in selected if source["id"] in args.source_id]
    fetcher = PublicFetcher(raw_dir=args.raw_dir, backend=args.backend, max_age_hours=args.max_age_hours, retries=args.retries, offline=args.offline)
    failures = []
    outcomes = []
    for source in selected:
        try:
            result = fetcher.fetch(source, force=args.force)
            outcomes.append({"source_id": source["id"], "url": source["url"], "outcome": "cached",
                             "backend": result["backend"], "retrieved_at": result["retrieved_at"],
                             "body_sha256": result["body_sha256"], "text_sha256": result["text_sha256"]})
            print(f"Cached {source['id']} ({result['backend']}, {result.get('status_code', 'original API response')})")
        except FetchError as exc:
            failures.append(source["id"])
            outcomes.append({"source_id": source["id"], "url": source["url"], "outcome": "unavailable", "reason": str(exc)})
            print(f"Skipped {source['id']}: {exc}")
    if args.report:
        save_json(args.report, {"completed_at": utc_now(), "requested_backend": args.backend,
                              "force": args.force, "max_retries": args.retries, "sources": outcomes})
    if failures:
        raise SystemExit(f"Failed sources: {', '.join(failures)}")


if __name__ == "__main__":
    main()
