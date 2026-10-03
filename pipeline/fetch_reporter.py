"""Cache complete NIH RePORTER v2 awards and separate query provenance.

    python fetch_reporter.py STXBP1 --max 30

Official reference: https://api.reporter.nih.gov/
Awards are searched across fiscal years. Multiple annual awards can share a core
project number; do not count them as independent projects or sum overlapping totals.
"""
import argparse
import hashlib
import json

import requests

from common import RAW_DIR, save_json
from fetch_pubmed import request, utc_now

BASE = "https://api.reporter.nih.gov/v2/projects/search"


def project_id(project: dict) -> str:
    identifier = str(project.get("appl_id", ""))
    if not identifier.isdigit():
        raise ValueError("RePORTER project has no valid appl_id")
    return identifier


def collect(query: str, maximum=30, refresh=False) -> dict:
    if not 1 <= maximum <= 1000:
        raise ValueError("--max must be between 1 and 1000")
    criteria = {"advanced_text_search": {"operator": "and", "search_field": "all", "search_text": query},
                "fiscal_years": [], "use_relevance": True}
    initial = {"criteria": criteria, "offset": 0, "limit": min(maximum, 500)}
    key = hashlib.sha256(json.dumps({"request": initial, "maximum": maximum}, sort_keys=True).encode()).hexdigest()[:16]
    query_dir = RAW_DIR / "reporter" / "searches" / key
    manifest_file = query_dir / "manifest.json"
    if manifest_file.exists() and not refresh:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        if all((RAW_DIR / "reporter" / "projects" / f"{identifier}.json").exists() for identifier in manifest["application_ids"]):
            return manifest
    identifiers, requests_log, total, offset = [], [], 0, 0
    with requests.Session() as session:
        session.headers["User-Agent"] = "PathNet/0.1 (public-source research cache)"
        while len(identifiers) < maximum:
            body = {**initial, "offset": offset, "limit": min(maximum - len(identifiers), 500)}
            page_file = query_dir / f"page_{len(requests_log):03d}.json"
            if page_file.exists() and not refresh:
                payload = json.loads(page_file.read_text(encoding="utf-8"))
            else:
                payload = request(session, "POST", BASE, interval=1.1, json=body).json()
                save_json(page_file, payload)
            requests_log.append(body)
            total = payload.get("meta", {}).get("total", total)
            projects = payload.get("results", [])
            for project in projects:
                identifier = project_id(project)
                if identifier not in identifiers:
                    identifiers.append(identifier)
                    save_json(RAW_DIR / "reporter" / "projects" / f"{identifier}.json", project)
            offset += len(projects)
            if not projects or offset >= total:
                break
    manifest = {"source": "NIH RePORTER API v2", "endpoint": BASE, "query": query,
                "retrieved_at": utc_now(), "requests": requests_log, "total_count": total,
                "application_ids": identifiers, "truncated": total > len(identifiers),
                "note": "Application IDs identify annual awards; core_project_num groups related award years."}
    save_json(manifest_file, manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query")
    parser.add_argument("--max", type=int, default=30)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    manifest = collect(args.query, args.max, args.refresh)
    print(f"{manifest['total_count']} hits; {len(manifest['application_ids'])} awards cached for: {args.query}")


if __name__ == "__main__":
    main()
