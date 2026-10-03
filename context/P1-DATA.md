# P1 data delivery and integration guide

Release: 2026-10-03. Branch: `p1/data`. Primary slice: STXBP1, with SCN2A, KCNQ2 and SCN8A neighbours. SCN2A supplies the documented same-gene/different-function example; it is also the first backup slice. The source coverage behind this choice is recorded in `SOURCES.md` and `data/curation/coverage_inventory.json`.

## Delivered baseline

- `data/seed/graph.json`: 54 real nodes, 68 edges, 76 evidence records, four provisional mechanism groups, 69 memberships. No placeholders; every edge has source evidence.
- `data/seed/provenance.json`: graph/input digests, evidence-to-source mappings, raw hashes, exact quote or structured-field locators, versions and attribution.
- `data/seed/demo_paths.json`: primary STXBP1 group/resource journey, SCN2A variant counterexample, shared-investigator path and unknown-query fixture.
- `data/seed/coverage.json`: dated query coverage, sample limits and graph counts. This file is a P4 input, not a sixth graph table.
- `data/curation/`: compact reviewed inputs and pinned PMID/NCT/NIH-application manifests. The reviewed graph rebuilds without the full raw cache.
- `data/raw/`: 159 nonempty PubMed records, 32 complete study records, 82 NIH annual awards, 29 ontology/API sources and public organization/mechanism snapshots. This directory is intentionally ignored by Git.

There are 49 tier A and 19 tier B edges; 67 support their scoped relationship and one contradicts assigning a single gain-of-function mechanism to the entire SCN2A disorder spectrum. There are no tier C/D claims. `verified` means checked against the source within the stated scope. Confidence is `null`; calibrated scoring belongs to P2.

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

The last three commands work offline from committed curation snapshots. Builds are byte-stable across Python hash seeds. The builder replaces the P1 baseline; use `--output-dir` to compare a rebuild without overwriting later P2 merges:

```bash
python pipeline/build_graph.py --output-dir /path/to/comparison
```

When this release's raw caches are present:

```bash
python pipeline/validate_graph.py --check-raw
python pipeline/fetch_groups.py --validate-curation
python pipeline/restore_pubmed.py --check
```

Raw auditing checks original response/text hashes, exact quotes and source-record digests. The committed compact snapshot is sufficient to rebuild, but it does not replace rechecking the original source context during scientific review. See `P1-EVIDENCE-REVIEW.md`.

## Acquire source caches on another machine

```bash
# All selected sources; complete local caches are reused:
python pipeline/fetch_slice.py

# P2 only needs the pinned abstract corpus:
python pipeline/restore_pubmed.py

# Or fetch selected source families:
python pipeline/fetch_slice.py --sources pubmed research
python pipeline/fetch_slice.py --sources ontologies community
```

`fetch_slice.py` reads simple `.env` entries without overriding process environment variables. NCBI email/key are optional; no OpenAI key is needed for P1. Direct source scripts use process environment variables. `DATA_DIR` must be set in the process environment before invoking Python if an alternate data directory is needed.

PubMed restoration pins 159 PMIDs and verifies title, abstract, authors and URL digests independently of retrieval time. Research restoration pins 32 NCT IDs and 82 annual NIH application IDs. An explicit `--refresh` requests current source records; changed, missing or empty records fail for review instead of silently passing as the saved release. Old PubMed records invalidated by refresh are retained under the query's `stale/` directory, outside P2's input directory.

Ontology and community retrieval use their saved source URLs and official releases. The community fetcher imports confirmed mechanism abstracts from the original PubMed XML. Run the PubMed step first on a fresh checkout. Changed page quotes fail rather than being rewritten automatically. After acquisition, inspect changed compact curation files, rebuild, and run the raw audit. Retrieval dates and upstream responses can change, so a new live snapshot is not guaranteed to have the original release's hashes.

The individual `fetch_pubmed.py`, `fetch_clinicaltrials.py`, `fetch_reporter.py` and `fetch_ontologies.py` commands remain available for new coverage searches. Query-based expansion is deliberately separate from pinned release replay. Refresh coverage inventory and source review when expanding the curated scope.

Bright Data is implemented as an explicit alternative:

```bash
# Configure BRIGHTDATA_API_KEY and BRIGHTDATA_ZONE in local .env first.
python pipeline/fetch_slice.py --sources community --group-backend brightdata --refresh
```

This release used direct public-page retrieval. Bright Data requests were tested with fixtures, not live credentials. Both modes respect the fetcher's robots checks and only retrieve public landing pages.

## P2: extraction, reconciliation and clustering

Read `data/raw/pubmed/<PMID>.json`. Every file has exactly `pmid`, `title`, `abstract`, `authors`, `url`, `retrieved_at`; metadata and original XML live under `data/raw/pubmed_searches/`. Article and book-chapter abstracts are nonempty. The existing `extract.py` can consume them without modification. Its quote checker was exercised against this corpus; no model extraction or precision result is claimed by P1.

Keep ontology namespaces in `ext_ids`; every value is a string. Only explicitly exact ontology aliases enter `synonyms`. Related, broad, narrow or untyped aliases are retained under `props.ontology_synonyms` with their source scope, and must not trigger automatic identity merges. Curated SCN2A subgroups have no invented MONDO ID; use `props.parent_disease` to relate them to `dis_scn2a`.

Preserve the reviewed seed while merging model-derived claims by stable ID. Never promote `stance: contradicts` or neutral limiting evidence to support. The two SCN2A ClinVar identities are joined to separately cited functional assays; their clinical classification alone does not imply gain/loss of function. Model/assay caveats are on each edge and variant `props.functional_scope`.

P1's four visual groups are source-reviewed starting groups. The unchanged `cluster.py` currently returns three Louvain disease groups and merges several conditions through HPO overlap. It does not reproduce P1's four mechanism groups or gene multi-membership. Its separate `clusters.generated.json` output should be reviewed before integration; do not silently replace the supplied memberships. P2 still owns extraction, gold-set evaluation, scored inferences, explanations and final clustering.

## P3: graph, evidence and action views

Keep `loadGraph(): Promise<Graph>` and `web/src/types.ts` as documented. `graph.json` contains exactly `nodes`, `edges`, `evidence`, `clusters`, `node_cluster`; every row has only the existing table fields. No new enum or schema migration is required. The existing static copy/build path already loads the dataset.

Use `props.plain` for the initial summary. Asset records expose `props.kind`, `props.url`/`source_url`, `props.next_step`, and where relevant `reuse_status` and `access`. Award assets also expose actual `props.funder` rows, fiscal year, project ID and investigator IDs. These describe research resources, not proven interventions. Public trial records expose `props.status`, `last_update_posted` and `retrieved_at`; terminated, withdrawn, completed, unknown or non-recruiting statuses must not become enrollment calls to action.

Use `demo_paths.json` for stable example IDs. The primary path is STXBP1 Foundation → STXBP1 condition ← STARR asset; the study node retains the independent official registry record. The asset and study represent two views of the same resource, not two independent studies. They can be joined by their documented demo IDs until P4 approves a more general relation type.

Edge-level `stance` is already supported by the contract. The contract has no per-evidence stance field: `provenance.evidence[evidence_id].evidence_stance` and `qualifier` identify the two neutral scope limitations. Display these beside the relevant functional edge when adding the richer evidence panel. Keep the explicit edge notes visible even before sidecar integration.

The running v0 app was checked for search, disease connections, the STARR source panel and the unknown-query state, with no browser error logs. Its current canvas has overlapping labels at this graph size; P3's planned graph-readability work is still needed. Its no-route panel remains static until P3/P4 connect the helper below. No claim of completed persona/action UI or role enforcement is made.

Retain visible HPO, Mondo, Orphadata and NCBI attribution from `SOURCES.md` when the service is published.

## P4: loading, coverage and schema decisions

Use the unchanged SQL migration and `pipeline/load_seed.py`:

```bash
# Existing Docker path, when Docker Desktop is available:
bash run.sh seed
bash run.sh smoke

# Existing direct PostgreSQL path; DATABASE_URL must point to the intended DB:
python pipeline/load_seed.py
```

The loader replaces the five graph tables. Run it only against the intended prototype database. This machine lacks Docker; the exact migration and unmodified loader were exercised against an isolated PostgreSQL WASM instance with two full loads, exact data round-trips and `anon` SELECT. That verifies SQL/data compatibility but does not substitute for Docker/PostgREST, Supabase, RLS or deployment acceptance.

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

Merge the ready-to-paste data section in `P1-README-SECTION.md` into the P4-owned README. The root README and platform/frontend/AI files were not edited by P1.

## Acceptance and remaining integration

Recorded validation on 2026-10-03:

| Check | Result |
| --- | --- |
| Offline ingestion, contract, provenance, replay and release tests | 64 passed |
| All graph evidence against original raw caches | 76 evidence records passed |
| P2 input and unchanged quote checker | 159 exact-shape records; all 14 selected paper snippets accepted |
| Build in a fresh data directory containing only committed curation | All four generated JSON files matched byte-for-byte; no raw cache present |
| Explicit-ID live replay into an isolated cache | 3 PubMed, 1 trial and 2 NIH records matched pinned content digests |
| Existing SQL migration and unchanged seed loader | Two exact round-trips; all 54 nodes/68 edges/76 evidence rows and cluster tables preserved; anon SELECT passed |
| Existing frontend | Production build passed; browser search, disease connections, STARR evidence and unknown-query view worked; no browser error logs observed |
| Existing P2 clustering | Executed unchanged in memory; three generated groups, documented separately from four P1 visual groups |

Completed P1 work: source/slice selection and backup; real seed; HPO/Mondo/Orphadata/ClinVar identity and annotation ingestion; pinned literature corpus; trial and grant caches; patient organizations and assets; investigator/funding representation; mechanism counterexample and contradictory evidence; reproducible build; strict contract/provenance validation; source-context audit; per-role handoff and README data section.

External integration still needed: P2's final extraction/gold-set work and human team cross-review, P3's action/persona/label-layout work and coverage wiring, P4's live database/RLS/deployment checks and README integration. Bright Data live verification requires configured credentials. These are explicit integration dependencies; no source, API result, model evaluation or deployment success has been fabricated to fill them.
