"""Restore P2's exact PMID selection without relying on mutable search ranking.

The committed manifest stores IDs and content digests, not copyrighted abstracts.
Changed upstream text is reported and must be re-reviewed; retrieval dates may differ.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from common import DATA_DIR, RAW_DIR, save_json
from fetch_pubmed import collect


def content_digest(record):
    content = {k: record[k] for k in ("pmid", "title", "abstract", "authors", "url")}
    return hashlib.sha256(json.dumps(content, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def restore(manifest: dict, check_only=False, refresh=False):
    ids = [row["pmid"] for row in manifest["records"]]
    if not check_only:
        for offset in range(0, len(ids), 40):
            batch = ids[offset:offset + 40]
            if not refresh and all((RAW_DIR / "pubmed" / f"{p}.json").is_file() for p in batch):
                continue
            # ESearch retrieves an explicit ID set; ranking cannot change membership.
            fetched = collect(" OR ".join(f"{p}[uid]" for p in batch), maximum=len(batch), refresh=refresh)
            omitted = set(batch) - set(fetched["cached_pmids"])
            if omitted:
                raise ValueError(f"Pinned PMIDs missing from the current nonempty response: {', '.join(sorted(omitted))}")
    missing, changed, empty = [], [], []
    for expected in manifest["records"]:
        path = RAW_DIR / "pubmed" / f"{expected['pmid']}.json"
        if not path.is_file():
            missing.append(expected["pmid"])
            continue
        record = json.loads(path.read_text(encoding="utf-8"))
        if not record.get("abstract"):
            empty.append(expected["pmid"])
        if content_digest(record) != expected["content_sha256"]:
            changed.append(expected["pmid"])
    report = {"expected_count": len(ids), "missing_pmids": missing, "changed_pmids": changed, "empty_pmids": empty,
              "note": "Content checks exclude retrieval time. Upstream revisions need source review before extraction."}
    if missing or changed or empty:
        raise ValueError(json.dumps(report, indent=2))
    print(f"Verified {len(ids)} pinned PubMed records for P2; all content digests match.")
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--manifest", type=Path, default=DATA_DIR / "curation/pubmed_manifest.json")
    ap.add_argument("--check", action="store_true", help="Only inspect local caches; no network")
    ap.add_argument("--refresh", action="store_true", help="Explicitly check current upstream records")
    args = ap.parse_args()
    try:
        restore(json.loads(args.manifest.read_text(encoding="utf-8")), args.check, args.refresh)
    except ValueError as exc:
        raise SystemExit(f"PubMed selection verification failed:\n{exc}") from exc


if __name__ == "__main__":
    main()
