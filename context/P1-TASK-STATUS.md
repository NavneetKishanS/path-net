# P1 task status by milestone — shared integration

Status date: **2026-10-04 (Europe/Berlin)**. Checklist: [P1-data.md](roles/P1-data.md). The previous published baseline is `a1eba9d`. This `p1/data` publication bundles the accepted M1 source/data snapshot and required platform dependencies; [P1-PUBLICATION.md](P1-PUBLICATION.md) defines the publication boundary.

This status describes the M1 publication and distinguishes work reported separately in the source delivery worktree. Its pinned 58-node M1 data/source snapshot has been integrated into the active shared `D:\Hack_Nation\path-net` checkout on `p4/platform` and the existing Docker database. Shared P4 platform work has been retained. Historical local acceptance is recorded in [shared M1 integration record](P1-INTEGRATION.md).

M0 is complete: the user confirmed P2's agreement on the slice. P1's M1 source acquisition, native checks and shared Docker seed/app integration are complete. The literal `bash run.sh seed` command has passed separately from the historical native receipt. M4 peer review and full cloud/product acceptance remain separate gates.

## Stage summary

| Stage | Status | Completed | Remaining acceptance |
| --- | --- | --- | --- |
| M0 | Complete | Slice/backup, coverage inventory, sources/licences, real insurance seed; P2 agreement confirmed by user | None for M0; M4 peer review is separate |
| M1 | Acquisition and local intended-environment integration complete | Sources and 58-node native acceptance; shared Docker seed, exact database/REST reads, database-backed browser and root README reproduction verified | Supabase/Auth/cloud and deployed-product acceptance remain with P4 |
| M2 | Reported complete in the separate source worktree; outside this publication | Foreground replay/build/audit and handoff were performed separately under the user-approved adaptation | Runner, tests and receipts are not bundled or certified by `p1/data` |
| M3 | Partially complete | 58 nodes, nine assets with URLs, nine investigator links and verified demo relationships | Funder relation/projection agreement with P4 |
| M4 | P1 documentation and local README integration complete; peer gate pending | Current English provenance/reproduction docs, native receipts and shared Docker integration record | P1/P2 final source-context peer review; deployed product/media gates remain separate |

## M1 item-by-item execution

| ID | Task | Result |
| --- | --- | --- |
| M1.1 | HPO/MONDO/Orphadata/ClinVar input; no direct OMIM | Complete within recorded provider scope: four genes, five MONDO terms, twelve HPO terms, 32 annotation rows and five ClinVar identities across all four genes. Orphadata assessed associations cover STXBP1/KCNQ2; SCN2A/SCN8A use MONDO without broad Orphanet identity assumptions. New variants remain function unknown. |
| M1.2 | 100-200 abstracts | Complete: 159 nonempty pinned records, exact six-field P2 input shape and original search/XML caches. |
| M1.3 | Trials and NIH records | Complete: 32 unique full NCT studies and 82 annual NIH application records. Annual applications are not independent projects. |
| M1.4 | Bright Data patient-group pages | Complete bounded acquisition: eight verified target-page snapshots, target HTTP 200, unchanged reviewed quotes, body/text hashes and receipt. NORD full responses remain local-only; Global Genes and Orphanet permission limits are recorded. No denied site was bypassed. |
| M1.5 | At least 15 nodes loaded, then inspect app | Complete locally: native two-load acceptance is retained; literal `bash run.sh seed` and smoke passed in the shared Docker environment with PostgreSQL 16.15/PostgREST 12.2.3. Exact five-table database/REST output and the database-backed browser were verified against the 58-node seed. |

See [P1-M1-EXECUTION.md](P1-M1-EXECUTION.md), [native receipt](../data/acceptance/m1-native.json), [browser screenshot](../data/acceptance/m1-browser.png), [provider receipt](../data/raw/groups/brightdata_acquisition.json) and [source restrictions](../data/raw/groups/coverage_attempts.json).

## M2-M4 item status

| ID | Task | Current status and evidence |
| --- | --- | --- |
| M2.1 | Keep raw caches tidy and execute source maintenance | Reported complete in the separate P1 source worktree under the foreground adaptation. Its runner and execution receipts are outside this publication and are not certified here. |
| M2.2 | Write handoff | Reported complete in the separate source worktree. This branch bundles its own [M1 integration handoff](HANDOFF.md), without claiming to bundle the M2 handoff or acceptance receipts. |
| M3.1 | Grow to 40-60 nodes; assets with URLs | Complete: 58 nodes and nine assets with source URLs and qualified reuse/next-step metadata. |
| M3.2a | Investigator associations | Complete: nine `investigator_disease` edges across seven public investigators. |
| M3.2b | Funder associations | Partial: four award assets retain actual funding metadata. P4 has not approved a funder node/edge or query projection; the combined original investigator/funder item remains incomplete. |
| M3.3 | Verify demo-path source relationships and status | P1 source verification complete: documented source/context review, all 69 edges verified and all 77 evidence rows raw-audited. This does not certify M4 human role-owner peer acceptance. |
| M4.1 | Swap with P2 for source-context review | Pending: no recorded P1/P2 final demo-path cross-review. M0 slice confirmation does not satisfy this item. |
| M4.2 | Write provenance and exact README commands | P1 output complete: current English guides, provenance, prepared M1 README section, clean-source checks and native acceptance receipts. |
| M4 integration | Root README and final checkout acceptance | Complete locally: shared README contains 58-node M1 counts, live Bright Data evidence, attribution and reproduction commands; integrated rebuild/raw audit, literal Docker seed and app checks are recorded in the shared integration record. |

## Current data and verification

- Graph: 58 nodes, 69 edges, 77 evidence rows, four reviewed starting clusters and 70 memberships. All edges are verified; confidence remains null. The five-table contract and stable IDs are unchanged.
- Raw snapshot: 451 files, comprising 449 data/cache/receipt files, `.gitkeep` and the historical `curate_community.py` helper; 50,866,487 bytes.
- Tests: original native clean-source snapshot passed 86; the shared integrated pipeline regression passed 99 with the pinned M1 graph unchanged. All 77 evidence rows and five ClinVar identity checks passed. The 99-test count is historical and includes concurrent M2 code; the current publication snapshot separately passed 87 pipeline tests.
- Clean credential-free snapshot: all 451 raw file hashes matched; four outputs rebuilt byte-for-byte; 159 abstracts and 86 tests passed with network connections blocked.
- Native acceptance binds final graph SHA-256 `c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`.

## Remaining work and owners

1. **P4 with P1:** the local Docker seed/app gate is complete. Finish real Supabase/Auth/Edge Runtime and cloud/deployed acceptance when configuration is available.
2. **P1/P4:** choose an approved funder relationship or projection for M3. Four award assets already retain actual funding metadata; the current contract has no funder node/edge type. Do not infer shared biology from funding overlap.
3. **P1/P2:** perform and record M4 source-context peer review of the final merged demo paths. M0 slice agreement is not this review.
4. **P4:** keep the integrated README, runtime receipts and source attribution synchronized when data changes; current M1 README/reproduction integration is complete.
5. **P2/P3/P4:** complete final extraction/evaluation/clustering, action/persona views, conflict/coverage integration and deployed product checks according to their role briefs.

The Makefile/data entry point and current M1 README were verified in the integrated shared checkout. Funding relations are M3 and peer acceptance is M4; neither is marked complete merely by M0 approval. P1 M2 completion is reported separately in the source worktree under the foreground adaptation; its runner, tests and receipts are not bundled or certified here. The source/native temporary processes were stopped after their original acceptance; the shared Docker db/api/web are continuous local services with persistent data.

## Separate source-worktree M2 scope

The user waived nighttime/unattended execution on 2026-10-04. The separate P1 source delivery reports a four-step foreground replay, rebuild, raw validation and cache audit at `2026-10-04T00:21:07Z` to `00:21:44Z`, with the reviewed release files unchanged. That worktree retains its own execution documents, runner tests and receipts. They are outside this publication and are not acceptance evidence for `p1/data`. This branch does not claim unattended maintenance or configure an M2 schedule.
