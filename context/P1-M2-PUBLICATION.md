# P1 M2 version-control preparation

Date: **2026-10-04 (Europe/Berlin)**. Historical M2 preparation: **local; not committed or pushed**. Its reviewed base was published M1 commit `0e1a04d8e7da222892b06595e014ffb388e77aaf`. The branch subsequently advanced to `3b38ca0`, and M3 adds a funding sidecar, reviewed wording and optional maintenance/audit integration. The receipts and manifest below describe the earlier M2-only preparation; they are not a current hash manifest for M3. See [M3 execution](P1-M3-EXECUTION.md). Do not publish either older checkout's entire working tree as an M2-only change.

## Coherent publication scope

- `pipeline/run_m2.py` and `pipeline/audit_cache.py`.
- `pipeline/tests/test_m2_runner.py` and `pipeline/tests/test_audit_cache.py`.
- `.gitignore` addition for `.runtime/`.
- The M2 execution/publication guides and P1 status, checklist and five-line handoff updates.
- The bounded `data/acceptance/m2/` receipts, inventories, audits and logs.

The published M1 already contains the required offline fetch/build/validation dependencies and 58-node source snapshot. Keep its `data/raw/** -text` and `data/seed/*.json -text` attributes. No graph, source record, schema or P4 runtime change is required by this M2 follow-up. Exclude `.env`, `.runtime/`, Python environments, `node_modules`, database backups and unrelated platform work.

## Integration and validation

All four tools/test files, the guide and acceptance bundle are now synchronized into the local shared checkout. The actual shared source-maintenance run finished at 02:48:09, with four passed steps and no source/curation/seed changes. It runs offline and leaves the current database and services in place.

Clean exports from the published M1 were overlaid with only the intended M2 tools/tests and runtime exclusion. Both ordinary Windows conversion and disabled-conversion/LF curation exports completed all four steps with all 463 snapshot files unchanged. The LF run recorded three staged JSON newline restorations. Only physical CRLF/LF differences are restored to the exact baseline bytes; changed content, other formatting and source `.body`/`.txt` changes remain subject to failure/review.

The final shared and clean-export suites ran **112 tests: 111 passed, one Windows physical-symlink-permission skip, zero failed**. The original M2 108-test receipt remains historical evidence; the four additional portability regressions belong to this preparation.

See [publication readiness](../data/acceptance/m2/publication-readiness.json), [shared run](../data/acceptance/m2/shared-checkout/receipt.json), [LF clean-export run](../data/acceptance/m2/clean-export-lf/receipt.json), [current test log](../data/acceptance/m2/publication-tests.log) and [M2 execution guide](P1-M2-EXECUTION.md). The source audit still records 451 raw files, including 449 data files, and the graph remains 58 nodes / 69 edges / 77 evidence rows.

Commit/push publication is a separate action. This preparation changes local P1-owned tooling and documentation without advancing Git history or claiming that GitHub already includes M2.


## M0-M3 publication follow-up

The completed M2 tools and historical acceptance bundle are included with M3 in the current branch snapshot. The earlier M2-only manifests remain historical; current candidate validation and scope are recorded in [P1-M0-M3-PUBLICATION.md](P1-M0-M3-PUBLICATION.md).
