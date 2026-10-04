# P1 data_v2: additive expansion and release review

Date: 2026-10-04. **P1-only review passed.** Publication target: `p1/data_v2`, based on the published P1 M0-M3 commit `b856a547dcc211c1f4e6692e349855f965ef353d`. The user authorized committing and pushing this P1 delivery and excluded graph-view screenshots. Push success must be confirmed by the publication operation.

## Data delivered

| Table | M0-M3 baseline | data_v2 | Added |
| --- | ---: | ---: | ---: |
| nodes | 58 | 120 | 62 |
| edges | 69 | 135 | 66 |
| evidence | 77 | 162 | 85 |
| clusters | 4 | 4 | 0 |
| node_cluster | 70 | 147 | 77 |

New nodes comprise 32 phenotypes, 15 registered studies, seven distinct NIH core-project assets and eight public investigators. All original rows, IDs, four provisional groups, null confidence and contradiction records are preserved. Administrative funding reports contain 11 annual applications and 11 distinct core projects across two FY2026 institute groups; funding associations are not biological mechanisms.

The 451 raw files (50,866,487 bytes) remain exactly unchanged. Public source snapshots were acquired on 2026-10-03. No source acquisition, model call or paid service was used in this publication review. Study statuses are dated source values, not current recruitment certification.

The P1 review clarified `props.plain` for the 15 added studies using existing fields: retrieval date, recorded status and provisional discovery scope. NCT06314490 explicitly describes an individualized protocol for one pediatric participant and is not a general enrollment opportunity. Original nodes were not edited.

## Review and boundaries

See [P1 verification](../data/acceptance/p1-data-v2/verification.json), [source checks](../data/acceptance/expansion/source-review.json), [data integrity](../data/acceptance/expansion/published-data-integrity.json) and [review report](../data/acceptance/expansion/review.md).

- 853 source identity/field/context/hash checks passed, including 53 exact Orphadata associations, 15 clinical records, seven NIH projects and ten original demo edges.
- All 162 evidence rows passed raw/provenance checks; the cache audit checked 654 references without errors.
- 135 pipeline tests ran: 134 passed, one physical-symlink test skipped because Windows denied its creation.
- The five-step isolated offline replay passed with network sockets blocked and no released data or candidate differences.
- Contract, P2 extraction/clustering/prompts, P3 web code, P4 schema/RLS/startup/platform scripts, dependencies and unchanged raw sources are outside the commit changes.
- No new graph table, relation enum, shared API or dependency was introduced. The P1 verifier adds an optional `--data-only` mode for portable graph/provenance/raw verification; full frozen-working-tree checks remain available for the original candidate.

Historical browser findings are retained as owner handoffs in [review-findings.json](../data/acceptance/expansion/review-findings.json). P1's R3 text correction is complete; P3 rendering/search/visual acceptance and P2 grouping evaluation were not performed by this pass. No graph screenshots, browser state dumps, delivery ZIPs, environments, credentials or runtime databases are added by this publication.

## Reproduce from a clean checkout

```bash
python -m pip install -r pipeline/requirements.txt
python pipeline/expand_slice.py
python pipeline/build_graph.py
python pipeline/build_funding_projection.py
python pipeline/validate_graph.py --check-raw
python pipeline/verify_expansion.py --data-only
python data/acceptance/expansion/source-review-checker.py
python -m unittest discover -s pipeline/tests -p 'test_*.py'
python pipeline/audit_cache.py --report data/acceptance/p1-data-v2/cache-audit.json
python pipeline/run_m2.py
```

`verify_expansion.py` without `--data-only` checks the historical frozen candidate working-tree layout and is not a clean-clone publication check. Source replay and P1 verification do not write to a shared database.

## Next operations

1. P2 prepares and manually approves the five-abstract `data/gold/` set, then supplies extraction/evaluation outputs. P1 performs reciprocal source review when those outputs exist. Human M4 sign-off remains pending and is not fabricated by this P1 publication.
2. P3 reviews the retained search, group-label, source-formatting and graph-density findings. P1 supplies source identifiers and the corrected descriptions.
3. Before loading a selected shared database, compare the target baseline and migration state, review the P1 changes and back up graph and platform records, contributions, contacts, roles, caches and migration history. Record restoration steps.
4. Use the existing P4 `bash run.sh seed` entry point in the accepted target checkout. This data update adds no migration. Avoid the truncating legacy loader and database-volume deletion.
5. Compare candidate rows and complete REST reads; confirm existing platform/contribution records survive, update coverage/explanation caches as needed, and check old/new user journeys. Shared data may contain additional contributed rows, so total counts alone are insufficient.
6. Merge, shared database writes and deployment are separate actions. A pushed branch does not perform them. Restoring an old seed through upsert does not remove new rows; rollback needs matching database and file snapshots.

graph.json file SHA-256: `670ed3d4cb63dc8a69ee99e2aeb0fd666310037385863d9028b35ddc2aa75e70`.
Canonical graph digest: `3dc7bce4e274f39041e7f61451f79ae65f7b47226b3e08acedcc60df9219e9c2`.
