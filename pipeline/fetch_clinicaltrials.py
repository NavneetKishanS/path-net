"""Cache complete ClinicalTrials.gov v2 studies and separate query provenance.

    python fetch_clinicaltrials.py STXBP1 --max 50

Official reference: https://clinicaltrials.gov/data-api/api
Records are registry submissions, not proof of efficacy or current recruitment.
"""
import argparse
import hashlib
import json
import re

import requests

from common import RAW_DIR, save_json
from fetch_pubmed import request, utc_now

BASE = "https://clinicaltrials.gov/api/v2/studies"


def study_id(study: dict) -> str:
    identifier = study.get("protocolSection", {}).get("identificationModule", {}).get("nctId", "")
    if not re.fullmatch(r"NCT\d{8}", identifier):
        raise ValueError("ClinicalTrials study has no valid nctId")
    return identifier


def collect(query: str, maximum=50, refresh=False) -> dict:
    if not 1 <= maximum <= 1000:
        raise ValueError("--max must be between 1 and 1000")
    initial = {"query.term": query, "format": "json", "pageSize": min(maximum, 100), "countTotal": "true"}
    key = hashlib.sha256(json.dumps({"request": initial, "maximum": maximum}, sort_keys=True).encode()).hexdigest()[:16]
    query_dir = RAW_DIR / "clinicaltrials" / "searches" / key
    manifest_file = query_dir / "manifest.json"
    if manifest_file.exists() and not refresh:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        if all((RAW_DIR / "clinicaltrials" / "studies" / f"{identifier}.json").exists() for identifier in manifest["study_ids"]):
            return manifest
    identifiers, requests_log, token, total = [], [], None, 0
    with requests.Session() as session:
        session.headers["User-Agent"] = "PathNet/0.1 (public-source research cache)"
        while len(identifiers) < maximum:
            params = dict(initial)
            if token:
                params["pageToken"] = token
            page_file = query_dir / f"page_{len(requests_log):03d}.json"
            if page_file.exists() and not refresh:
                payload = json.loads(page_file.read_text(encoding="utf-8"))
            else:
                payload = request(session, "GET", BASE, interval=1.0, params=params).json()
                save_json(page_file, payload)
            requests_log.append(params)
            total = payload.get("totalCount", total)
            for study in payload.get("studies", []):
                identifier = study_id(study)
                if identifier not in identifiers:
                    identifiers.append(identifier)
                    save_json(RAW_DIR / "clinicaltrials" / "studies" / f"{identifier}.json", study)
                if len(identifiers) >= maximum:
                    break
            new_token = payload.get("nextPageToken")
            if not new_token:
                break
            if new_token == token:
                raise ValueError("ClinicalTrials repeated page token")
            token = new_token
    manifest = {"source": "ClinicalTrials.gov API v2", "endpoint": BASE, "query": query,
                "retrieved_at": utc_now(), "requests": requests_log, "total_count": total,
                "study_ids": identifiers, "truncated": total > len(identifiers)}
    save_json(manifest_file, manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query")
    parser.add_argument("--max", type=int, default=50)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    manifest = collect(args.query, args.max, args.refresh)
    print(f"{manifest['total_count']} hits; {len(manifest['study_ids'])} studies cached for: {args.query}")


if __name__ == "__main__":
    main()
