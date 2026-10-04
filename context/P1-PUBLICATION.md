# P1 M1 publication scope

Publication branch: **`p1/data`**, on `origin` at `https://github.com/NavneetKishanS/path-net.git`. This is the existing branch requested by the user. Base: `a1eba9df4ed149629d7cc2251d95646135cd10cc`. The user authorized committing and pushing the completed M1 integration. This scope record does not invent a commit hash or certify a remote push; those must be confirmed by the publication operation.

## Bundled delivery

- The pinned M1 graph: 58 nodes, 69 edges, 77 evidence rows, four provisional clusters and 70 memberships. Graph file SHA-256: `c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`.
- Reviewed raw source and curation snapshots, all four seed outputs, bounded source fetch/replay and provenance validators, M1 pipeline tests and native/app probes.
- English source, role, handoff, reproduction and acceptance documentation; the historical native and shared Docker receipts and browser evidence.
- Platform dependencies used by the accepted integrated runtime: persistent Compose services, migration/upsert operator, scoped cache replacement, role policies, operator tests and the linked platform contracts/functions/tests. The publication adds a complete one-command bootstrap: Node.js 24 Alpine `cache-build`, a dedicated `bootstrap_cache` volume, seed migration/upsert/cache import, startup gates, locked frontend install/build and cache-aware smoke. These files make local startup reproducible with Docker Desktop and Bash, without host Python/Node.js or AI/cloud keys.

The [shared M1 integration record](P1-INTEGRATION.md) and [receipt](../data/acceptance/m1-docker-integration.json) document local PostgreSQL/PostgREST/application acceptance, exact five-table reads and successful persistence after service restart. They are historical local evidence, not cloud deployment or fresh-clone acceptance. The historical 99-test shared suite included concurrent M2 work; the original clean M1 native snapshot passed 86 tests.

## Publication snapshot verification

The isolated publication snapshot separately passed **87 pipeline tests**, **77 raw evidence checks** and verification of **159 pinned PubMed records**. The [publication receipt](../data/acceptance/m1-publication.json) records the branch, graph hash and credential-free snapshot checks. A clean staged Git archive retained the exact bytes of all **455 raw/seed files** and passed the 87-test suite again. Git line-ending conversion is disabled for the pinned raw and seed files to preserve their recorded hashes. These results apply to the code and source files bundled here; they preserve the historical 86-test native and 99-test shared integration counts as separate evidence. The remote commit is confirmed by the actual push operation.

## New one-command bootstrap acceptance

`bash run.sh up` starts the database, generates the 20-explanation/one-coverage bundle, applies migrations, upserts the graph, imports caches and then starts API/web. `bash run.sh seed` also refreshes the bundle automatically. Optional project/port settings permit an isolated parallel stack; see [P4-BOOTSTRAP.md](P4-BOOTSTRAP.md).

Fresh bootstrap acceptance **passed** from a clean staged Git archive: all 455 raw/seed files retained their exact bytes, with no `.env`, `.venv` or `node_modules` initially present, and unique empty database/cache/frontend-module volumes. The literal `bash run.sh up` created `.env`, built the 20-explanation/one-coverage bundle, migrated/seeded/imported successfully and started REST/API/web. All five SQL/REST tables, cache contents and the actual frontend loader matched the baseline; smoke and seed rerun passed. The snapshot passed 87 pipeline tests and 77 raw evidence checks.

The bootstrap receipt records its checked base as `0e1a04d8e7da222892b06595e014ffb388e77aaf`, separately from the original M1 publication base above. Existing container image build cache was allowed; application environment/dependency files and database/cache volumes started empty.

Warm down/up retained volumes and succeeded with project/ports supplied solely through `.env`. Populated role, approved-contribution and unrelated ordered-path fixtures were preserved in the isolated test database; stale cache keys were removed and repeated seed stayed stable. The two-migration ledger remained unchanged. [m1-bootstrap.json](../data/acceptance/m1-bootstrap.json) records these scoped results. The native/shared/publication receipts and their original counts above remain historical evidence for their stated snapshots. This is a staged-archive/local Docker acceptance, not proof of remote publication, real Auth, the Edge Runtime or cloud deployment.

## Excluded separate work and runtime artifacts

The M2 foreground maintenance runner `pipeline/run_m2.py`, its `pipeline/tests/test_m2_runner.py` tests and separate source-worktree M2 documents/receipts are excluded. Their completion is reported separately in the source delivery worktree and is not certified by this branch. Active source and shared worktrees remain independent of this publication snapshot.

Local `.env` files, credentials, dependency environments, generated caches, database runtimes/volumes/backups and temporary audit/download artifacts are excluded. Source snapshots that were restricted to local-only review remain outside the repository.

## Remaining acceptance

Real Supabase Auth, Edge Runtime/cloud deployment, deployed product acceptance, P3 persona/action/admin/coverage wiring, P2 final model evaluation/clustering, P1/P2 M4 source-context peer review, P1/P4 funder relation/projection agreement, media and submission remain separate gates. Publishing this branch does not close them.
