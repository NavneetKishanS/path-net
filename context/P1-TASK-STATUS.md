# P1 task status by milestone

Status date: **2026-10-04 (Europe/Berlin)**. Checklist: [P1-data.md](roles/P1-data.md). M1 was published on `origin/p1/data` at `0e1a04d`; the reviewed publication base is `3b38ca0` with P4 startup improvements. The completed M2/M3 tools, data reports and receipts are included in this M0-M3 publication.

This status describes the P1 delivery worktree. Its 58-node data/source snapshot is integrated into the active shared `D:\Hack_Nation\path-net` checkout on `p4/platform` and the existing Docker database. Shared P4 work has been retained. M1 integration was published; this snapshot adds the completed M2/M3 updates. See [shared M1 integration record](P1-INTEGRATION.md).

M0 is complete: the user confirmed P2's agreement on the slice. P1's M1 source acquisition, native checks and shared Docker seed/app integration are complete. The literal `bash run.sh seed` command has passed separately from the historical native receipt. M4 peer review and full cloud/product acceptance remain separate gates.

## Stage summary

| Stage | Status | Completed | Remaining acceptance |
| --- | --- | --- | --- |
| M0 | Complete | Slice/backup, coverage inventory, sources/licences, real insurance seed; P2 agreement confirmed by user | None for M0; M4 peer review is separate |
| M1 | Acquisition and local intended-environment integration complete | Sources and 58-node native acceptance; shared Docker seed, exact database/REST reads, database-backed browser and root README reproduction verified | Supabase/Auth/cloud and deployed-product acceptance remain with P4 |
| M2 | Complete under the user-approved foreground adaptation | Actual four-step isolated offline replay, byte-identical rebuild, raw audit, organized cache and five-line handoff | None for P1 M2; nighttime/unattended execution waived on 2026-10-04 |
| M3 | P1 delivery complete | 58 nodes, nine assets, nine investigator links, source-checked funding report and verified demo relationships | P3/P4 may consume the report; a funding API/view is outside this P1 delivery |
| M4 | Documentation and machine-assisted source review complete; reciprocal peer gate pending | English provenance/reproduction docs, README integration and review of all 69 edges/77 evidence records; one demo wording issue corrected | Human P1/P2 reciprocal source-context acceptance and review of P2-produced artifacts; product/media gates remain separate |

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
| M2.1 | Keep raw caches tidy and execute source maintenance | Complete: actual foreground replay of all source families, graph rebuild, raw validation and audit of 451 files. Four steps passed; all 463 raw/curation/seed files stayed byte-identical. The user waived nighttime/unattended execution. |
| M2.2 | Write handoff | Complete: updated five-line [HANDOFF.md](HANDOFF.md) records execution, interfaces and remaining owners. The original sleep-time clause was replaced by the approved immediate foreground scope. |
| M3.1 | Grow to 40-60 nodes; assets with URLs | Complete: 58 nodes and nine assets with source URLs and qualified reuse/next-step metadata. |
| M3.2a | Investigator associations | Complete: nine `investigator_disease` edges across seven public investigators. |
| M3.2b | Funder associations | Complete as the existing P4 contract's award-metadata projection: `funding_overlap.json` links four FY2026 NIH/NINDS applications and four distinct core projects to existing assets, diseases, supporting edges and evidence. Source locators/hashes and count units are explicit; no new relation, API or biological inference. |
| M3.3 | Verify demo-path source relationships and status | P1 source verification complete: documented source/context review, all 69 edges verified and all 77 evidence rows raw-audited. This does not certify M4 human role-owner peer acceptance. |
| M4.1 | Swap with P2 for source-context review | Machine-assisted P2-perspective review recorded for all 69 edges/77 evidence records, with detailed review of ten demo edges. The same-application wording correction is resolved. Human P2 and reciprocal review of absent P2 extraction/gold artifacts remain pending; M0 confirmation does not satisfy this gate. |
| M4.2 | Write provenance and exact README commands | P1 output complete: current English guides, provenance, prepared M1 README section, clean-source checks and native acceptance receipts. |
| M4 integration | Root README and final checkout acceptance | Complete locally: shared README contains 58-node M1 counts, live Bright Data evidence, attribution and reproduction commands; integrated rebuild/raw audit, literal Docker seed and app checks are recorded in the shared integration record. |

## Current data and verification

- Graph: 58 nodes, 69 edges, 77 evidence rows, four reviewed starting clusters and 70 memberships. All edges are verified; confidence remains null. The five-table contract and stable IDs are unchanged.
- Raw snapshot: 451 files, comprising 449 data/cache/receipt files, `.gitkeep` and the historical `curate_community.py` helper; 50,866,487 bytes.
- Tests: current M3 P1 suite ran 125 (124 passed, one physical-symlink creation skipped due to Windows permissions). Historical M2 readiness ran 112, native clean-source history ran 86, and shared M1 regression ran 99. All 77 evidence rows and five ClinVar identities pass raw checks.
- M2 actual execution: `2026-10-04T00:21:07Z` to `00:21:44Z`, four steps passed, zero release/candidate changes. Audit: 421 references across 100 files, 22 quotes and pinned 159/32/82 source records. See [M2 execution guide](P1-M2-EXECUTION.md), [receipt](../data/acceptance/m2/receipt.json) and [cache audit](../data/acceptance/m2/cache-audit.json).
- Clean credential-free snapshot: all 451 raw file hashes matched; four outputs rebuilt byte-for-byte; 159 abstracts and 86 tests passed with network connections blocked.
- Native acceptance binds final graph SHA-256 `c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`.

## Remaining work and owners

1. **P4 with P1:** the local Docker seed/app gate is complete. Finish real Supabase/Auth/Edge Runtime and cloud/deployed acceptance when configuration is available.
2. **P3/P4:** consume the completed [funding report interface](P1-FUNDING-INTERFACE.md) using existing graph IDs, if adding a funding view. The existing contract already specifies award-metadata projection. A new HTTP endpoint, graph enum or SQL relation would be separate owner work. Do not infer shared biology from funding overlap.
3. **P1/P2:** perform and record M4 source-context peer review of the final merged demo paths. M0 slice agreement is not this review.
4. **P4:** keep the integrated README, runtime receipts and source attribution synchronized when data changes; current M1 README/reproduction integration is complete.
5. **P2/P3/P4:** complete final extraction/evaluation/clustering, action/persona views, conflict/coverage integration and deployed product checks according to their role briefs.

The Makefile/data entry point and current M1 README were verified in the integrated shared checkout. M3 now has a source-bound administrative funding projection under the existing contract; M4 human peer acceptance remains separate. P1 M2 is complete under the approved foreground adaptation. Historical receipts are retained; the shared Docker services continue with persistent data.

## M2 version-control readiness

M1 is published at `0e1a04d`; this snapshot adds the completed M2/M3 follow-ups. Historical M2 shared and ordinary/LF clean Git-export runs passed with all 463 files unchanged; 112 tests ran, 111 passed and one host-permission test was skipped. These receipts predate M3. See [M2 publication scope](P1-M2-PUBLICATION.md) and [historical readiness](../data/acceptance/m2/publication-readiness.json). Current M3 verification ran 125 tests and the five-step, 464-file maintenance pass.

## M3 execution update

See [M3 execution](P1-M3-EXECUTION.md) and [funding interface](P1-FUNDING-INTERFACE.md). The graph remains byte-identical at SHA-256 `c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`. The investigator demo now states that its two links cite one application; its curation/provenance sidecars were rebuilt. Raw inputs and coverage are unchanged. The new funding report is an additional sidecar, giving 464 raw/curation/seed files. Maintenance now rebuilds and audits the optional report in a fifth step. The preceding 112-test M2 readiness record is historical, not a hash manifest for these M3 additions.

The [machine-assisted review](P1-M4-PEER-REVIEW.md) and [full source audit](../data/acceptance/m4/source-audit.json) do not claim human role-owner sign-off.
