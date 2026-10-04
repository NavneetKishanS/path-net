# P1 M1 execution record

Recorded: **2026-10-04, Europe/Berlin**. Source/runtime timestamps use UTC, so the late October 3 requests below occurred on October 4 locally. P2's M0 slice agreement was confirmed by the user. M4 peer review is a separate gate.

Original native acceptance worktree: `D:\Hack_Nation\path-net-p1-m1`, branch `p1/data`. That original run did not edit the shared checkout. The M1 snapshot has since been integrated locally into `D:\Hack_Nation\path-net` on `p4/platform`; see [shared M1 integration record](P1-INTEGRATION.md). The accepted source/data snapshot is bundled in the user-authorized `p1/data` publication; see [P1-PUBLICATION.md](P1-PUBLICATION.md) for scope and separate publication checks.

## Result and acceptance boundary

P1 source acquisition and native database/app execution are complete. The final dataset contains **58 nodes, 69 edges, 77 evidence rows, four clusters and 70 memberships**. The graph has 49 tier A and 20 tier B edges; all are source-verified, with uncalibrated confidence left null.

The role brief names `bash run.sh seed`. Docker was unavailable during the original native acceptance recorded below, so the unchanged SQL migration and actual loader were run against native PostgreSQL 16.14 and PostgREST 12.2.3. The later shared-checkout integration separately passed the literal Docker seed command, live database/REST comparisons and browser checks. Native history is retained below; Supabase Auth, cloud deployment and a deployed gate tag remain separate gates.

| Role task | Execution evidence |
| --- | --- |
| Tier A HPO/MONDO/Orphadata/ClinVar input; no direct OMIM | Four genes, five MONDO terms, twelve HPO terms, 32 phenotype annotation rows and five ClinVar identities. Orphadata supplies assessed STXBP1/KCNQ2 associations; SCN2A/SCN8A use MONDO without assuming broad Orphanet equivalence. |
| 100-200 abstracts for P2 | 159 nonempty, exact six-field PubMed records; all pinned content digests verified. |
| Trials and NIH records | 32 complete unique NCT studies and 82 annual NIH application records, verified against pinned manifests. Annual applications are not independent project counts. |
| Bright Data patient-group acquisition | Eight real provider acquisitions; every target returned HTTP 200 and the reviewed quote matched verbatim. Restricted/denied sources have recorded outcomes. |
| At least 15 real nodes loaded and app inspected | Two original native loads of all 58 nodes; exact five-table SQL/REST comparisons, anon reads, actual `loadGraph(rest)` and production browser checks passed. Later Docker/shared-app acceptance is recorded separately in the shared integration record. |

## Corrections and new data

- Fixed `BRIGHTDATA_ZONE` in the P1 guide to **`BRIGHTDATA_UNLOCKER_ZONE`**, and added the correct field to the P1 environment template, matching P4's current template. Credentials remain only in ignored local `.env`.
- Fixed provider parsing for `status_code` and repeated HTTP-header arrays. An outer provider HTTP 200 is not treated as target success. Default direct-mode replay accepts the saved provider cache without credentials; an explicit Bright Data run cannot silently reuse a direct-method cache.
- Added bounded `--source-id`, `--raw-dir`, `--report` and `--retries` options for reproducible small probes without overwriting reviewed caches.
- Added one pinned ClinVar identity each for STXBP1, KCNQ2 and SCN8A, plus original discovery responses. Node/raw record hashes, accession, gene, clinical properties and functional-evidence bindings are checked, including nodes with no functional edges.
- Added `asset_stxbp1_rarex`, its existing-contract `asset_disease` edge and exact source evidence. It describes patient-owned data collection; it does not establish efficacy or unrestricted access to participant data.

| Gene | Added identity | Recorded classification / scope |
| --- | --- | --- |
| STXBP1 | [VCV004904548.1](https://www.ncbi.nlm.nih.gov/clinvar/variation/4904548/) | Likely pathogenic; single submitter; effect unknown |
| KCNQ2 | [VCV004945793.1](https://www.ncbi.nlm.nih.gov/clinvar/variation/4945793/) | Pathogenic; single submitter; effect unknown |
| SCN8A | [VCV004916868.1](https://www.ncbi.nlm.nih.gov/clinvar/variation/4916868/) | Likely pathogenic; single submitter; effect unknown |

The two original SCN2A identities retain their separately cited assay-specific LoF/GoF evidence and model limitations. Clinical classification or splice/frameshift consequence alone never sets functional direction. No new enum, top-level graph field, variant-gene relation or inferred bridge was added.

## Provider receipts and source limits

[Bright Data acquisition receipt](../data/raw/groups/brightdata_acquisition.json) records the eight source IDs, target statuses, UTC retrieval dates, hashes and evidence IDs. Requests ran between **2026-10-03T23:18:32Z and 23:19:49Z**. The initial probe exposed repeated-header parsing before reviewed snapshots were integrated; the corrected live acquisition passed. All 22 community/mechanism quotes validate, and mechanism snapshots are unchanged from the baseline.

[Supplementary coverage outcomes](../data/raw/groups/coverage_attempts.json) distinguish successful retrieval from permission to bundle it:

- Two official NORD pages were reviewed locally. Their full responses remain under `D:\Hack_Nation\tmp\p1-community-audit`, outside the repository, because the publisher's footer restricts reproduction. They are not graph evidence dependencies.
- Global Genes robots access returned HTTP 403; permission was not established. No target-page or proxy request was sent.
- Orphanet's directory robots rules deny this research bot. No page/proxy request was sent; its Orphadata API is a separate source.

The bundled raw snapshot has **451 files**: **449 data/cache/receipt files**, `.gitkeep` and the historical `curate_community.py` helper; **50,866,487 bytes**. Cached bodies preserve their exact source bytes. Source licences and attribution remain in [SOURCES.md](SOURCES.md).

## Verification

| Check | Result |
| --- | --- |
| Full offline test suite | 86 tests passed |
| Raw graph and identity audit | All 77 evidence records and all five ClinVar identities passed |
| Pinned source replay | 159 abstracts, 32 studies and 82 NIH records verified; complete source replay reused caches |
| Credential-free clean snapshot | Every one of 451 raw-file hashes matched; all four rebuilt JSON files were byte-identical; 86 tests passed with network connections blocked |
| Native PostgreSQL 16.14 | Unchanged migration and two unchanged `load_seed.py` runs; exact five-table SQL comparisons and anon reads passed |
| PostgREST 12.2.3 / frontend loader | Exact five-table REST comparisons and the actual `web/src/api.ts` `loadGraph(rest)` passed |
| Production app | Build passed; browser showed `data: rest`, STXBP1 disease connections, RARE-X verified evidence URL/quote/date and unknown-query state; zero error logs |
| Credential audit | No configured key or zone value found in nonignored delivery files; `.env` excluded |

[Native acceptance receipt](../data/acceptance/m1-native.json) binds the tested graph file to SHA-256 **`c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`**. The final native run records `checked_at: 2026-10-03T23:29:12Z` and status passed. [Browser evidence screenshot](../data/acceptance/m1-browser.png) records the REST-backed RARE-X panel. Temporary database/API/frontend processes were stopped after verification; the receipt's loopback URL is historical, not a deployed endpoint.

## Recheck offline

From this worktree, with Python and pipeline requirements installed:

```powershell
python pipeline/validate_graph.py --check-raw
python pipeline/restore_pubmed.py --check
python -m unittest discover -s pipeline/tests -p 'test_*.py' -q
```

For a build comparison that preserves later P2 merges:

```powershell
python pipeline/build_graph.py --output-dir ../tmp/p1-m1-rebuild
python pipeline/validate_graph.py --graph ../tmp/p1-m1-rebuild/graph.json --check-raw
```

On this host, the existing Python runtime is `D:\Hack_Nation\path-net\.venv\Scripts\python.exe`; substitute that executable for `python` if the worktree has no environment of its own.

## Repeat native loading acceptance

The optional harness creates its own fresh loopback-only cluster and never reads `.env`, uses `DATABASE_URL` or replaces an existing database. Supply native PostgreSQL and PostgREST binaries plus installed frontend modules. The locally verified binaries are outside the repository:

```powershell
& 'D:\Hack_Nation\path-net\.venv\Scripts\python.exe' pipeline/tests/check_native_postgres.py `
  --pg-bin 'D:\Hack_Nation\tmp\pathnet-native-postgres\16.14.0-beta.17\package\native\bin' `
  --postgrest 'D:\Hack_Nation\tmp\pathnet-native-postgrest\v12.2.3\artifacts\postgrest-windows-x64\postgrest.exe' `
  --web-modules 'D:\Hack_Nation\path-net-p1-m1\web\node_modules' `
  --work-dir 'D:\Hack_Nation\tmp\pathnet-p1-m1-acceptance' `
  --report-file 'D:\Hack_Nation\tmp\p1-native-recheck.json'
```

Add `--hold-seconds 900` to inspect the app. The harness prints a fresh API URL; in another terminal, set `VITE_DATA_SOURCE=rest` and `VITE_API_URL` to that URL before `npm.cmd run build` in `web`, then start `npm.cmd run preview -- --host 127.0.0.1 --port 5184 --strictPort`. Stop the preview afterward. PostgreSQL DLLs are added only to the PostgREST child PATH on Windows.

The shared Docker environment now uses `bash run.sh seed` with P4's migration/upsert operator, retaining the graph contract and platform records. P2 consumes the same six-field abstracts and stable IDs; P3 consumes the same five tables and action properties. The root README has been refreshed for this M1 snapshot. M3 funder relations, M4 peer acceptance and cloud/Auth deployment remain separately tracked in [P1-TASK-STATUS.md](P1-TASK-STATUS.md). Current continuous local runtime and receipts: [shared M1 integration record](P1-INTEGRATION.md).
