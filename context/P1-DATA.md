# P1 data delivery and integration guide

**Current additive release:** `p1/data_v2` contains 120 nodes, 135 edges and 162 evidence records with four unchanged provisional groups. The P1-only source/raw/replay review passed; see [data_v2 scope and reproduction](P1-EXPANSION.md). Historical M0-M3 sections below describe the preserved 58-node baseline. P2/M4 human, product and shared-database gates remain separate.

Publication boundary: the 58-node M1 snapshot is published on `p1/data` at `0e1a04d`; the reviewed publication base is `3b38ca0` with P4 startup improvements. The completed M2 maintenance and M3 funding/report follow-ups are included in this publication. See [M3 execution](P1-M3-EXECUTION.md) for current acceptance and [M2 preparation](P1-M2-PUBLICATION.md) for historical clean-export verification.

Release: 2026-10-03; M1 execution update: 2026-10-04 (Europe/Berlin). Branch: `p1/data`. Primary slice: STXBP1, with SCN2A, KCNQ2 and SCN8A neighbours. SCN2A supplies the documented same-gene/different-function example; it is also the first backup slice. P2's M0 agreement was confirmed by the user on 2026-10-04. Source coverage is recorded in `SOURCES.md` and `data/curation/coverage_inventory.json`.

Current local M1 snapshot: **451 raw files**, comprising **449 data files**, `.gitkeep` and the `curate_community.py` helper, totalling **50,866,487 bytes**. It adds bounded ClinVar discovery and identity records, eight live Bright Data page snapshots, acquisition receipts and coverage restrictions. Retrieval timestamps are UTC, including 2026-10-03 evening requests recorded on October 4 locally. NORD's two new full-page responses remain outside the repository because of the publisher's reproduction restriction. Bundling does not change the source-specific copyrights, licences or terms in `SOURCES.md`.

Temporary signed redirect query parameters and fragments were removed from metadata for publication; the stable `source_url` and original response bytes and hashes are retained. `.gitattributes` disables line-ending conversion for `data/raw/**` to preserve exact provenance hashes across platforms. `curate_community.py` is a historical curation helper; supported replay and rebuilding use `pipeline/fetch_slice.py` and `pipeline/build_graph.py`.

The earlier `a1eba9d` packaging baseline had 500 project files and 425 raw files; its clean Git export passed 64 tests. The original M1 native clean-source snapshot passed **86 tests**, all **77 evidence rows and five ClinVar identities**, and the pinned 159-record abstract check. The shared integration later passed **99 pipeline tests** with the same pinned graph. See [M1 native history](P1-M1-EXECUTION.md) and [shared M1 integration record](P1-INTEGRATION.md). Concurrent M2 changes are not certified as a completed M2 milestone by this integration.

## Delivered baseline

- `data/seed/graph.json`: 58 real nodes, 69 edges, 77 evidence records, four provisional mechanism groups, 70 memberships. No placeholders; every edge has source evidence.
- `data/seed/provenance.json`: graph/input digests, evidence-to-source mappings, raw hashes, exact quote or structured-field locators, versions and attribution.
- `data/seed/demo_paths.json`: primary STXBP1 group/resource journey, SCN2A variant counterexample, shared-investigator path and unknown-query fixture.
- `data/seed/coverage.json`: dated query coverage, sample limits and graph counts. This file is a P4 input, not a sixth graph table.
- `data/seed/funding_overlap.json`: source-checked administrative funding report, joining four NIH/NINDS applications and four distinct core projects to existing asset/disease/edge/evidence IDs. See [funding interface](P1-FUNDING-INTERFACE.md); it does not change `Graph` or create an explanation route.
- `data/curation/`: compact reviewed inputs and pinned PMID/NCT/NIH-application manifests. The reviewed graph rebuilds without the full raw cache.
- `data/raw/`: published M1 snapshot containing 159 nonempty PubMed records, 32 complete studies, 82 annual NIH application records, pinned ontology/API sources and public organization/mechanism snapshots, plus ClinVar discovery responses and original/query metadata. M3 preserves every original raw file.

There are 49 tier A and 20 tier B edges; 68 support their scoped relationship and one contradicts assigning a single gain-of-function mechanism to the entire SCN2A disorder spectrum. There are no tier C/D claims. `verified` means checked against the source within the stated scope. Confidence is `null`; calibrated scoring belongs to P2.

## Rebuild and verify

Use Python 3.10+ (tested with 3.12). From the repository root:

```bash
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell instead:
# .\.venv\Scripts\Activate.ps1
python -m pip install -r pipeline/requirements.txt
python pipeline/build_graph.py
python pipeline/validate_graph.py
python -m unittest discover -s pipeline/tests -p 'test_*.py'
```

The last three commands work offline from the bundled local curation snapshots. Builds are byte-stable across Python hash seeds. The builder replaces the P1 baseline; use `--output-dir` to compare a rebuild without overwriting later P2 merges:

```bash
python pipeline/build_graph.py --output-dir /path/to/comparison
```

The current source caches are bundled in the integrated local working tree. Run these stronger checks offline against that snapshot:

```bash
python pipeline/validate_graph.py --check-raw
python pipeline/fetch_groups.py --validate-curation
python pipeline/restore_pubmed.py --check
```

Raw auditing checks the bundled original response/text hashes, exact quotes and source-record digests. The compact snapshot remains sufficient to rebuild independently of the raw cache, but neither an offline rebuild nor a hash check replaces reviewing the original source context during scientific review. See `P1-EVIDENCE-REVIEW.md`.

## Reuse, repair or refresh source caches

The published M1 and integrated local working tree contain the reviewed source caches; no source download is required for the offline checks above. The completed M2/M3 follow-ups are included in this branch snapshot. The commands below reuse complete caches and can restore missing records or acquire sources into an alternate data directory:

```bash
# All selected sources; complete bundled caches are reused:
python pipeline/fetch_slice.py

# P2 only needs the pinned abstract corpus:
python pipeline/restore_pubmed.py

# Or fetch selected source families:
python pipeline/fetch_slice.py --sources pubmed research
python pipeline/fetch_slice.py --sources ontologies community
```

`fetch_slice.py` reads simple `.env` entries without overriding process environment variables. NCBI email/key are optional; no OpenAI key is needed for P1. Direct source scripts use process environment variables. `DATA_DIR` must be set in the process environment before invoking Python if an alternate data directory is needed.

PubMed restoration pins 159 PMIDs and verifies title, abstract, authors and URL digests independently of retrieval time. Research restoration pins 32 NCT IDs and 82 annual NIH application IDs. An explicit `--refresh` requests current source records; changed, missing or empty records fail for review instead of silently passing as the saved release. Old PubMed records invalidated by refresh are retained under the query's `stale/` directory, outside P2's input directory.

Ontology and community retrieval use their saved source URLs and official releases. The community fetcher imports confirmed mechanism abstracts from the original PubMed XML, which is included in the bundled local snapshot. When restoring into an empty alternate data directory, run the PubMed step first. Changed page quotes fail rather than being rewritten automatically. After acquisition, inspect changed compact curation files, rebuild, and run the raw audit. Retrieval dates and upstream responses can change, so a new live snapshot is not guaranteed to have the original release's hashes.

The individual `fetch_pubmed.py`, `fetch_clinicaltrials.py`, `fetch_reporter.py` and `fetch_ontologies.py` commands remain available for new coverage searches. Query-based expansion is deliberately separate from pinned release replay. Refresh coverage inventory and source review when expanding the curated scope.

Bright Data is implemented as an explicit alternative:

```bash
# Configure BRIGHTDATA_API_KEY and BRIGHTDATA_UNLOCKER_ZONE in local .env first.
python pipeline/fetch_slice.py --sources community --group-backend brightdata --refresh
```

M1 used Bright Data for eight reviewed public group/resource pages. Every target returned HTTP 200 and its reviewed quote matched verbatim. See `data/raw/groups/brightdata_acquisition.json`. The client accepts documented target status fields and repeated HTTP headers; the provider's outer HTTP 200 alone is not success. Both modes respect target robots checks. Global Genes robots access returned 403 and Orphanet's directory rules denied this bot; neither was bypassed. NORD responses were reviewed locally without bundling them.

For a bounded live probe, load the local environment and select one existing source without replacing reviewed caches:

```powershell
python -c "import sys; from pathlib import Path; sys.path.insert(0, 'pipeline'); from fetch_slice import load_env; load_env(Path('.env')); import fetch_groups; fetch_groups.main()" --backend brightdata --kind groups --source-id stxbp1_foundation --raw-dir ../tmp/p1-brightdata-probe --report ../tmp/p1-brightdata-probe/result.json --retries 0 --force
```

This command sends a metered provider request. Normal direct-mode replay accepts the bundled Bright Data cache without credentials; explicit Bright Data selection cannot silently reuse a direct-method cache.

## P2: extraction, reconciliation and clustering

Read `data/raw/pubmed/<PMID>.json`. Every file has exactly `pmid`, `title`, `abstract`, `authors`, `url`, `retrieved_at`; metadata and original XML live under `data/raw/pubmed_searches/`. Article and book-chapter abstracts are nonempty. The existing `extract.py` can consume them without modification. Its quote checker was exercised against this corpus; no model extraction or precision result is claimed by P1.

Keep ontology namespaces in `ext_ids`; every value is a string. Only explicitly exact ontology aliases enter `synonyms`. Related, broad, narrow or untyped aliases are retained under `props.ontology_synonyms` with their source scope, and must not trigger automatic identity merges. Curated SCN2A subgroups have no invented MONDO ID; use `props.parent_disease` to relate them to `dis_scn2a`.

Preserve the reviewed seed while merging model-derived claims by stable ID. Never promote `stance: contradicts` or neutral limiting evidence to support. Five ClinVar identities cover all four genes. Only the two SCN2A variants have separately cited functional assays; the three new identity examples retain `effect: unknown` and no mechanism edges. Clinical classification alone does not imply gain/loss of function. Model/assay caveats are on each functional edge and variant `props.functional_scope`. Identity-only variants reference genes through `props.gene_id`; no new relation type or inferred mechanism membership was introduced.

P1's four visual groups are source-reviewed starting groups. The unchanged `cluster.py` currently returns three Louvain disease groups and merges several conditions through HPO overlap. It does not reproduce P1's four mechanism groups or gene multi-membership. Its separate `clusters.generated.json` output should be reviewed before integration; do not silently replace the supplied memberships. P2 still owns extraction, gold-set evaluation, scored inferences, explanations and final clustering.

## P3: graph, evidence and action views

Keep `loadGraph(): Promise<Graph>` and `web/src/types.ts` as documented. `graph.json` contains exactly `nodes`, `edges`, `evidence`, `clusters`, `node_cluster`; every row has only the existing table fields. No new enum or schema migration is required. The existing static copy/build path already loads the dataset.

Use `props.plain` for the initial summary. Asset records expose `props.kind`, `props.url`/`source_url`, `props.next_step`, and where relevant `reuse_status` and `access`. Award assets also expose actual `props.funder` rows, fiscal year, project ID and investigator IDs. These describe research resources, not proven interventions. Public trial records expose `props.status`, `last_update_posted` and `retrieved_at`; terminated, withdrawn, completed, unknown or non-recruiting statuses must not become enrollment calls to action.

Use `demo_paths.json` for stable example IDs. The primary path is STXBP1 Foundation → STXBP1 condition ← STARR asset; the study node retains the independent official registry record. The asset and study represent two views of the same resource, not two independent studies. They can be joined by their documented demo IDs until P4 approves a more general relation type.

Edge-level `stance` is already supported by the contract. The contract has no per-evidence stance field: `provenance.evidence[evidence_id].evidence_stance` and `qualifier` identify the two neutral scope limitations. Display these beside the relevant functional edge when adding the richer evidence panel. Keep the explicit edge notes visible even before sidecar integration.

The running v0 app was checked for search, disease connections, the STARR source panel and the unknown-query state, with no browser error logs. Its current canvas has overlapping labels at this graph size; P3's planned graph-readability work is still needed. Its no-route panel remains static until P3/P4 connect the helper below. No claim of completed persona/action UI or role enforcement is made.

Retain visible HPO, Mondo, Orphadata and NCBI attribution from `SOURCES.md` when the service is published.

## P4: loading, coverage and schema decisions

Run this section in the shared `D:/Hack_Nation/path-net` checkout, using P4's migration/upsert operator for the integrated database. The original `pipeline/load_seed.py` remains available for a deliberate five-table baseline replacement:

```bash
# Integrated Docker path:
bash run.sh seed
bash run.sh smoke

# Direct integrated PostgreSQL path; DATABASE_URL must point to the intended DB:
python scripts/platform.py migrate
python scripts/platform.py seed

# Deliberate five-table replacement only; removes approved contribution edges:
# python pipeline/load_seed.py
```

The shared Docker PostgreSQL 16.15 database now serves the 58-node M1 snapshot through PostgREST 12.2.3. The literal `bash run.sh seed` and smoke workflow passed; the operator validates and upserts graph/coverage rows while retaining platform records and any approved contributions. Database rows and REST output were compared against the pinned five-table seed, and the database-backed app was checked. The existing `pathnet_pgdata` volume persists the database; db/api/web use `restart: unless-stopped` while Docker is available. This does not configure Windows or Docker boot startup. Original native PostgreSQL 16.14 acceptance remains in `data/acceptance/m1-native.json`; current shared receipts and service commands are in [shared M1 integration record](P1-INTEGRATION.md). Supabase Auth, Edge Runtime and cloud deployment remain outstanding.

Optional repeatable local SQL test:

```bash
npm install --prefix .venv/p1-db-test --no-save --package-lock=false @electric-sql/pglite@0.5.8 @electric-sql/pglite-socket@0.2.11
node pipeline/tests/check_postgres.mjs
```

The test creates an isolated temporary in-memory database and never connects to `DATABASE_URL`. `P1_TEST_PYTHON` and `P1_TEST_NODE_MODULES` may point to alternate local runtimes.

For the coverage endpoint, import `coverage_report(query, graph, coverage)` from `pipeline/coverage_report.py`, or inspect:

```bash
python pipeline/coverage_report.py "STXBP1"
python pipeline/coverage_report.py "no supported match in this slice"
```

The response reports what was searched, matched IDs, direct supported A/B edges, missing coverage and next checks. It excludes contradictory/rejected/inferred edges as positive support. A missing match is a limitation of this slice, never evidence that a disease has no research.

Two schema boundaries are intentionally retained: (1) there is no funder node/edge type, so actual grant funding is represented in award-asset metadata and the existing `asset_disease` relation; (2) no personal email/phone fields are exported. Named public investigators have stable NIH profile IDs and source links; `award_recipient_organization` is explicitly not a personal affiliation. P4 owns dedicated funder relations and any restricted contact view if the team chooses to extend the contract.

The current `P1-README-SECTION.md` has been integrated into the shared root README, including M1 counts, live Bright Data acquisition, source attribution and verified reproduction commands. Platform/frontend/AI implementation remains with its respective owner.

## Acceptance and remaining integration

Recorded validation on 2026-10-03:

| Check | Result |
| --- | --- |
| Offline ingestion, contract, provenance, replay and release tests | 64 passed |
| All graph evidence against original raw caches | 76 evidence records passed |
| P2 input and unchanged quote checker | 159 exact-shape records; all 14 selected paper snippets accepted |
| Curation-only isolated rebuild, with raw caches deliberately omitted | All four generated JSON files matched byte-for-byte |
| Explicit-ID live replay into an isolated cache | 3 PubMed, 1 trial and 2 NIH records matched pinned content digests |
| Existing SQL migration and unchanged seed loader | Two exact round-trips; all 54 nodes/68 edges/76 evidence rows and cluster tables preserved; anon SELECT passed |
| Existing frontend | Production build passed; browser search, disease connections, STARR evidence and unknown-query view worked; no browser error logs observed |
| Existing P2 clustering | Executed unchanged in memory; three generated groups, documented separately from four P1 visual groups |

Completed P1 work: source/slice selection and backup; real seed; HPO/Mondo/Orphadata/ClinVar identity and annotation ingestion; pinned literature corpus; trial and grant caches; patient organizations and assets; investigator/funding representation; mechanism counterexample and contradictory evidence; reproducible build; strict contract/provenance validation; source-context audit; per-role handoff and README data section.

M1 additions are recorded in [P1-M1-EXECUTION.md](P1-M1-EXECUTION.md); shared database/README integration is complete and recorded in [shared M1 integration record](P1-INTEGRATION.md). Remaining work: P2 final extraction/gold-set work and M4 peer cross-review; P3 action/persona/label-layout and coverage wiring; P4 real Auth, Edge Runtime, Supabase/cloud deployment and deployed acceptance. Bright Data live verification is complete. M0 slice approval does not imply M4 source-context peer acceptance.
