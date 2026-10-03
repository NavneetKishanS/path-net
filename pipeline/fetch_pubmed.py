"""Cache abstracts with P2's six-field interface; query metadata stays separate.

    python fetch_pubmed.py "STXBP1 AND hasabstract" --max 100 --until 2026/10/03

Article JSON goes to raw/pubmed; ESearch JSON, EFetch XML and query manifests go
to raw/pubmed_searches. Existing caches are reused unless --refresh is requested.
NCBI_EMAIL and NCBI_API_KEY are optional environment variables and are never logged.
Official reference: https://www.ncbi.nlm.nih.gov/books/NBK25501/
"""
import argparse
import hashlib
import json
import os
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests

from common import RAW_DIR, save_json

BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def request(session, method: str, url: str, *, interval=0.4, **kwargs):
    """Pace every attempt and retry transient failures, at most four attempts.

    Run only one process per provider to respect the provider's per-IP quota.
    """
    for attempt in range(4):
        time.sleep(interval)
        try:
            response = session.request(method, url, timeout=(15, 90), **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if attempt == 3 or (status is not None and status != 429 and status < 500):
                # E-utilities credentials travel as query parameters. Never echo
                # a prepared response URL (which may contain the optional key).
                safe_url = url.split("?", 1)[0]
                raise type(exc)(f"Public source request failed: {method} {safe_url} (HTTP {status or 'unavailable'})") from None
            retry_after = getattr(getattr(exc, "response", None), "headers", {}).get("Retry-After", "")
            delay = min(float(retry_after), 60) if retry_after.isdigit() else 2 ** (attempt + 1)
            time.sleep(delay)
    raise RuntimeError("request exhausted")


def ncbi_params() -> dict:
    params = {"tool": "pathnet-hackathon"}
    if os.environ.get("NCBI_EMAIL"):
        params["email"] = os.environ["NCBI_EMAIL"]
    if os.environ.get("NCBI_API_KEY"):
        params["api_key"] = os.environ["NCBI_API_KEY"]
    return params


def search(query: str, retmax: int) -> list[str]:
    with requests.Session() as session:
        r = request(session, "GET", f"{BASE}/esearch.fcgi", params={**ncbi_params(), "db": "pubmed", "term": query, "retmax": retmax, "retmode": "json"})
    return r.json()["esearchresult"]["idlist"]


def fetch(pmids: list[str]) -> list[dict]:
    with requests.Session() as session:
        r = request(session, "GET", f"{BASE}/efetch.fcgi", params={**ncbi_params(), "db": "pubmed", "id": ",".join(pmids), "retmode": "xml"})
    return parse_articles(r.content)


def parse_articles(xml: bytes, retrieved_at: str | None = None) -> list[dict]:
    """Preserve inline XML text and consortium authors without synthetic quotes."""
    root = ET.fromstring(xml)
    error = root.find(".//ERROR")
    if error is not None:
        raise ValueError(error.text or "PubMed EFetch error")
    out = []
    for art in list(root.findall(".//PubmedArticle")) + list(root.findall(".//PubmedBookArticle")):
        citation = art.find("MedlineCitation")
        body_path = "Article/"
        if citation is None:
            citation = art.find("BookDocument")
            body_path = ""
        if citation is None:
            continue
        pmid = citation.findtext("PMID", "").strip()
        if not pmid.isdigit():
            continue
        title_el = citation.find(f"{body_path}ArticleTitle")
        title = "".join(title_el.itertext()) if title_el is not None else ""
        abstract = " ".join("".join(el.itertext()) for el in citation.findall(f"{body_path}Abstract/AbstractText"))
        authors = []
        for author in citation.findall(f"{body_path}AuthorList/Author"):
            name = author.findtext("CollectiveName") or " ".join(filter(None, [
                author.findtext("ForeName") or author.findtext("Initials"),
                author.findtext("LastName"), author.findtext("Suffix"),
            ]))
            if name:
                authors.append(name)
        out.append({"pmid": pmid, "title": title, "abstract": abstract.strip(), "authors": authors,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", "retrieved_at": retrieved_at or utc_now()})
    return out


def collect(query: str, maximum: int = 50, until: str | None = None, refresh=False) -> dict:
    if not 1 <= maximum <= 2000:
        raise ValueError("--max must be between 1 and 2000")
    params = {"db": "pubmed", "term": query, "retmax": maximum, "retmode": "json", "sort": "relevance"}
    if until:
        datetime.strptime(until, "%Y/%m/%d")
        params.update({"datetype": "pdat", "mindate": "1800/01/01", "maxdate": until})
    key = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]
    query_dir = RAW_DIR / "pubmed_searches" / key
    manifest_file = query_dir / "manifest.json"
    if manifest_file.exists() and not refresh:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        if all((RAW_DIR / "pubmed" / f"{pmid}.json").exists() for pmid in manifest["cached_pmids"]):
            return manifest
    with requests.Session() as session:
        session.headers["User-Agent"] = "PathNet/0.1 (public-source research cache)"
        search_file = query_dir / "esearch.json"
        if search_file.exists() and not refresh:
            payload = json.loads(search_file.read_text(encoding="utf-8"))
        else:
            payload = request(session, "GET", f"{BASE}/esearch.fcgi", params={**params, **ncbi_params()}).json()
            save_json(search_file, payload)
        result = payload["esearchresult"]
        if "ERROR" in result or "error" in payload:
            raise ValueError("PubMed ESearch returned an API error")
        pmids = result["idlist"]
        missing = [pmid for pmid in pmids if refresh or not (RAW_DIR / "pubmed" / f"{pmid}.json").exists()]
        for offset in range(0, len(missing), 50):
            batch = missing[offset:offset + 50]
            fetched_at = utc_now()
            response = request(session, "GET", f"{BASE}/efetch.fcgi", params={
                **ncbi_params(), "db": "pubmed", "id": ",".join(batch), "retmode": "xml"})
            records = parse_articles(response.content, fetched_at)
            batch_key = hashlib.sha256(",".join(batch).encode()).hexdigest()[:16]
            xml_file = query_dir / f"efetch_{batch_key}.xml"
            xml_file.parent.mkdir(parents=True, exist_ok=True)
            xml_file.write_bytes(response.content)
            valid_ids = {record["pmid"] for record in records if record["abstract"]}
            if refresh:
                # Preserve obsolete source text outside P2's input directory. An
                # empty/omitted current abstract must not pass as the old cache.
                for pmid in set(batch) - valid_ids:
                    old_file = RAW_DIR / "pubmed" / f"{pmid}.json"
                    if old_file.exists():
                        stale = query_dir / "stale" / f"{pmid}.json"
                        stale.parent.mkdir(parents=True, exist_ok=True)
                        stale.write_bytes(old_file.read_bytes())
                        old_file.unlink()
            for record in records:
                if record["abstract"]:
                    save_json(RAW_DIR / "pubmed" / f"{record['pmid']}.json", record)
        cached, empty = [], []
        for pmid in pmids:
            article_file = RAW_DIR / "pubmed" / f"{pmid}.json"
            if article_file.exists() and json.loads(article_file.read_text(encoding="utf-8")).get("abstract"):
                cached.append(pmid)
            else:
                empty.append(pmid)
    manifest = {"source": "PubMed E-utilities", "endpoint": f"{BASE}/esearch.fcgi", "query": query,
                "request": params, "retrieved_at": utc_now(), "total_count": int(result["count"]),
                "returned_pmids": pmids, "cached_pmids": cached, "missing_abstract_pmids": empty,
                "note": "Ranked search snapshot; only nonempty abstracts enter the P2 input directory."}
    save_json(manifest_file, manifest)
    return manifest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--max", type=int, default=50)
    ap.add_argument("--until", help="Publication cutoff YYYY/MM/DD")
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    manifest = collect(args.query, args.max, args.until, args.refresh)
    print(f"{manifest['total_count']} hits; {len(manifest['cached_pmids'])} nonempty abstracts for: {args.query}")
    print(f"Cached in {RAW_DIR / 'pubmed'}")


if __name__ == "__main__":
    main()
