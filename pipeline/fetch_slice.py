"""Acquire/replay the selected P1 sources, leaving graph construction explicit.

Use build_graph.py alone to reproduce the committed release without a network.
This command populates raw source caches and refreshes the compact source inputs;
source changes must be reviewed before publishing a rebuilt graph.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import requests

from common import DATA_DIR, RAW_DIR, save_json
from fetch_pubmed import request, utc_now
from restore_pubmed import restore

ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path):
    """Read simple KEY=VALUE entries, never execute shell substitutions or log values."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def record_digest(record):
    return hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def restore_research(manifest, refresh=False):
    """Pin NCT/application IDs; refuse silent upstream changes to the release."""
    with requests.Session() as session:
        session.headers["User-Agent"] = "PathNet/0.1 (public-source research cache)"
        for source, folder, id_key in (("clinicaltrials", "studies", "study_ids"), ("reporter", "projects", "application_ids")):
            expected = manifest[source]
            missing = [r["id"] for r in expected if refresh or not (RAW_DIR / source / folder / f"{r['id']}.json").is_file()]
            if missing:
                retrieved_at = utc_now()
                if source == "clinicaltrials":
                    records = []
                    for nct in missing:
                        response = request(session, "GET", f"https://clinicaltrials.gov/api/v2/studies/{nct}", interval=1.0, params={"format": "json"})
                        record = response.json()
                        if record["protocolSection"]["identificationModule"]["nctId"] != nct:
                            raise ValueError(f"ClinicalTrials returned the wrong ID for {nct}")
                        save_json(RAW_DIR / source / folder / f"{nct}.json", record)
                        records.append(nct)
                else:
                    payload = {"criteria": {"appl_ids": [int(x) for x in missing], "fiscal_years": []}, "offset": 0, "limit": 500}
                    response = request(session, "POST", "https://api.reporter.nih.gov/v2/projects/search", interval=1.1, json=payload)
                    original = response.json()
                    save_json(RAW_DIR / source / "searches/pinned_release/response.json", original)
                    records = []
                    for record in original.get("results", []):
                        appl = str(record["appl_id"])
                        if appl not in missing:
                            raise ValueError(f"NIH RePORTER returned an unrequested application {appl}")
                        save_json(RAW_DIR / source / folder / f"{appl}.json", record)
                        records.append(appl)
                    omitted = set(missing) - set(records)
                    if omitted:
                        raise ValueError(f"NIH RePORTER omitted requested current records: {', '.join(sorted(omitted))}")
                # A pinned retrieval is not a new broad coverage search.
                save_json(RAW_DIR / source / "searches/pinned_release/manifest.json", {"source": source, "query": "Explicit release identifiers (not a coverage search)", "retrieved_at": retrieved_at, id_key: records, "truncated": False})
            changed = []
            for row in expected:
                path = RAW_DIR / source / folder / f"{row['id']}.json"
                if not path.exists() or record_digest(read(path)) != row["content_sha256"]:
                    changed.append(row["id"])
            if changed:
                raise ValueError(f"{source}: missing or changed upstream records require review: {', '.join(changed)}")
            print(f"Verified {len(expected)} pinned {source} records.")


def run(script, *args):
    subprocess.run([sys.executable, str(ROOT / "pipeline" / script), *args], check=True, cwd=ROOT)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sources", nargs="+", choices=["pubmed", "research", "ontologies", "community"], default=["pubmed", "research", "ontologies", "community"])
    ap.add_argument("--refresh", action="store_true", help="Explicitly refetch public sources; changed pinned records fail for review")
    ap.add_argument("--group-backend", choices=["direct", "brightdata"], default="direct")
    args = ap.parse_args()
    load_env(ROOT / ".env")
    if "pubmed" in args.sources:
        restore(read(DATA_DIR / "curation/pubmed_manifest.json"), refresh=args.refresh)
    if "research" in args.sources:
        restore_research(read(DATA_DIR / "curation/research_cache_manifest.json"), args.refresh)
        run("curate_research.py")
    if "ontologies" in args.sources:
        run("fetch_ontologies.py", *(["--refresh"] if args.refresh else []))
    if "community" in args.sources:
        run("fetch_groups.py", "--kind", "all", "--backend", args.group_backend, *(["--force"] if args.refresh else []))
        run("fetch_groups.py", "--refresh-provenance")
        run("fetch_groups.py", "--validate-curation")
    print("Selected source acquisition complete. Review changed curation files, then run build_graph.py and validate_graph.py --check-raw.")


if __name__ == "__main__":
    main()
