"""Fetch PubMed abstracts for a query and cache them as JSON in data/raw/pubmed/.

    python fetch_pubmed.py "STXBP1 AND epilepsy" --max 50

Uses NCBI E-utilities (free, no key). Set NCBI_EMAIL in .env to be a good citizen.
"""
import argparse
import os
import time
import xml.etree.ElementTree as ET

import requests

from common import RAW_DIR, save_json

BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
COMMON = {"tool": "pathnet-hackathon", "email": os.environ.get("NCBI_EMAIL", "")}


def search(query: str, retmax: int) -> list[str]:
    r = requests.get(f"{BASE}/esearch.fcgi", params={**COMMON, "db": "pubmed", "term": query, "retmax": retmax, "retmode": "json"}, timeout=30)
    r.raise_for_status()
    return r.json()["esearchresult"]["idlist"]


def fetch(pmids: list[str]) -> list[dict]:
    r = requests.get(f"{BASE}/efetch.fcgi", params={**COMMON, "db": "pubmed", "id": ",".join(pmids), "retmode": "xml"}, timeout=60)
    r.raise_for_status()
    out = []
    for art in ET.fromstring(r.content).findall(".//PubmedArticle"):
        pmid = art.findtext(".//MedlineCitation/PMID")
        title = "".join(art.find(".//ArticleTitle").itertext()) if art.find(".//ArticleTitle") is not None else ""
        abstract = " ".join("".join(a.itertext()) for a in art.findall(".//Abstract/AbstractText"))
        authors = [
            f"{a.findtext('ForeName', '')} {a.findtext('LastName', '')}".strip()
            for a in art.findall(".//AuthorList/Author")
        ]
        out.append({
            "pmid": pmid, "title": title, "abstract": abstract, "authors": authors,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "retrieved_at": time.strftime("%Y-%m-%d"),
        })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--max", type=int, default=50)
    args = ap.parse_args()
    pmids = search(args.query, args.max)
    print(f"{len(pmids)} PMIDs for: {args.query}")
    for i in range(0, len(pmids), 50):
        for rec in fetch(pmids[i : i + 50]):
            save_json(RAW_DIR / "pubmed" / f"{rec['pmid']}.json", rec)
        time.sleep(0.4)  # stay under the E-utilities rate limit
    print(f"Cached in {RAW_DIR / 'pubmed'}")


if __name__ == "__main__":
    main()
