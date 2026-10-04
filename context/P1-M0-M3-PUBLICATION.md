# P1 M0-M3 publication scope

Date: **2026-10-04 (Europe/Berlin)**. Target: the existing **p1/data** branch. Parent: `3b38ca0d40b33042f7a61c7bc04c5f632bd9cdcd`. The user authorized committing and pushing the completed M0-M3 updates.

This snapshot preserves the published M1 raw/graph data and P4 bootstrap, and adds completed M2 maintenance plus M3 administrative funding projection. Current validation is recorded in [publication receipt](../data/acceptance/m0-m3-publication/verification.json); historical execution-time publication fields in earlier receipts are unchanged. A remote push must be confirmed by the publication operation rather than inferred from a candidate receipt.

## Included

- M0 slice/source agreement and M1 58-node integration are retained from published history.
- M2 finite offline maintenance/audit tools, tests, runtime exclusion, execution guide and historical receipts.
- M3 source-bound funding report and builder/tests: one FY2026 NIH/NINDS group, four applications and four distinct core projects, joined through existing asset/disease/edge/evidence IDs.
- Corrected single-application investigator wording, regenerated demo/provenance, English role/status/handoff and portable source/reproduce links.
- Machine-assisted source-review records supporting the wording correction and current source verification. Human P1/P2 M4 reciprocal acceptance stays pending.

The raw snapshot remains **451 files / 50,866,487 bytes**; the graph remains **58 nodes / 69 edges / 77 evidence records / four provisional clusters / 70 memberships**. The new raw/curation/seed snapshot has **464 files**. The five-table graph, stable IDs, evidence scopes, unknown variant effects, contradictory stance and P2 six-field abstract input remain unchanged.

## Preserved boundaries

The published P4 README, bootstrap/runtime, environment template, contracts, SQL and exact-source `.gitattributes` are retained. Platform records and the running shared database are not modified by publication. No credentials, local runtime/staging directories, Python environments, node_modules, database volumes/backups or new downloads are included.

Funding is an administrative report, not a graph edge, biological inference, platform endpoint or completed P3 view. Current cloud/Auth/product/media and human M4 gates remain with their respective owners.

## Reproduce from this branch

```bash
python -m pip install -r pipeline/requirements.txt
python -m unittest discover -s pipeline/tests -p 'test_*.py'
python pipeline/validate_graph.py --check-raw
python pipeline/build_funding_projection.py
python pipeline/audit_cache.py --report data/acceptance/current-cache-audit.json
python pipeline/run_m2.py
```

The finite maintenance pass uses an isolated ignored stage, blocks network access, rebuilds the graph/funding report and audits sources, with no automatic replacement or database writes. For the existing local app, follow [P4 bootstrap](P4-BOOTSTRAP.md): with Docker Desktop and Bash, `bash run.sh up`; source checks above use Python, while the app bootstrap itself does not require host Python or AI/cloud keys.
