# P1 M3 execution and acceptance

Date: **2026-10-04 (Europe/Berlin)**. Result: **P1 M3 delivery complete**. M0-M2 evidence was checked first; the remaining funding association was implemented under the existing P4 award-metadata policy. This completed follow-up is included in the M0-M3 branch publication. M1 is published; the reviewed `p1/data` publication base is `3b38ca0`.

## Delivered result

- The 58-node graph contains nine assets with source URLs and nine investigator-disease links across seven public investigators. All 69 edges retain verified status and qualified source scope.
- `data/seed/funding_overlap.json` adds one recorded FY2026 NIH/NINDS funding group, four application/asset/disease memberships, four distinct applications and four distinct core projects.
- The report joins existing IDs to original funding-array locators, URLs, retrieval dates and raw hashes. See [P1-FUNDING-INTERFACE.md](P1-FUNDING-INTERFACE.md).
- `build_funding_projection.py` generates the report offline. `audit_cache.py` checks its source-bound rebuild; `run_m2.py` rebuilds it in an additional fifth step when present.

The existing contract prescribes award metadata joined through `asset_disease`. No graph enum, node, edge, SQL table, `Graph` field or platform endpoint was introduced. Shared funding describes administrative overlap; it does not imply shared biology, treatment response, current award availability or trial eligibility. P3/P4 consumer wiring is separate work.

## Source-context correction

The investigator demo had said that two awards named the investigator, although both selected edges cite application `11301017`. `curation/demo_spec.json` now states that the cited award describes prior SCN2A- and STXBP1-specific work. `demo_paths.json` and `provenance.json` were rebuilt. No graph row, raw record or coverage output changed.

The exact graph file SHA-256 remains `c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`; its canonical digest remains `6f5f4e162cd621271e87c0ac849c527b5dc35e624ce486c8421b8daf928bac3b`. The funding report distinguishes canonical digests from exact file hashes.

## Actual verification

- **125 pipeline tests: 124 passed, one skipped** because the Windows host disallows unprivileged physical symlink creation. Twelve funding tests check raw/metadata/provenance failures, excluded edges, deduplication, deterministic output and corrupted saved-report rejection. See [test log](../data/acceptance/m3/tests.log).
- An isolated maintenance run completed at `2026-10-04T01:18:22Z` to `01:18:59Z`: source replay, graph rebuild, raw validation, funding rebuild and cache audit all passed. All **464 raw/curation/seed files** remained byte-identical to the new M3 snapshot. No network, credentials, automatic merge or database write was used. See [receipt](../data/acceptance/m3/maintenance/receipt.json).
- The audit verified 451 raw files, 425 references across 100 files, 77 evidence records, 22 quotations and pinned 159/32/82 source-record memberships, with no errors.
- A fresh read-only REST comparison found exact equality for 58 nodes, 69 edges, 77 evidence rows, four clusters and 70 memberships in the running database. The report derives from the graph currently served; no seed reload was needed. See [database comparison](../data/acceptance/m3/database-recheck.json).
- All original raw files are unchanged. Historical M1/M2 receipts are retained. There is one new sidecar and three reviewed wording/provenance changes. [Verification](../data/acceptance/m3/verification.json) records their hashes and shared-checkout correspondence.

## Run and inspect

From either checkout, use a Python environment with the pipeline requirements installed:

```powershell
python pipeline/build_funding_projection.py
python pipeline/audit_cache.py --report data/acceptance/current-cache-audit.json
python -m unittest discover -s pipeline/tests -p 'test_funding_projection.py' -v
```

Open `data/seed/funding_overlap.json`. Its `summary` should show one funding group, four memberships, four applications and four core projects. Each member's `asset_id`/`disease_id` joins to the existing graph; `edge_ids`/`evidence_ids` preserve the source-supported relationship. P3/P4's five-table graph and P2's six-field PubMed inputs remain compatible.

## M4 boundary

Supporting machine-assisted reviews covered all 69 edges and 77 evidence records, with detailed context for ten demo edges. The single-application wording correction was resolved and rechecked. See [review](P1-M4-PEER-REVIEW.md) and [source audit](../data/acceptance/m4/source-audit.json).

Human P2 acceptance and reciprocal review of P2-produced extraction/gold artifacts remain pending; those directories are absent in the inspected checkout. P1 documentation and README integration are complete, but the original M4 reciprocal peer gate remains open. P2/P3/P4 model, UI, Auth, cloud and media milestones are not claimed by this delivery.
