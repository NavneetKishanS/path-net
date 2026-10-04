# P4 platform implementation and handoff

Status date: 2026-10-04 (Europe/Berlin). Scope: local implementation and verification, as requested. No Supabase project or deployment platform has been configured. This document follows the local `task_docu/PathNet Blueprint.md` architecture and [P4 role brief](roles/P4-platform-story.md), adapted to the reviewed P1 release. Full milestone acceptance is tracked in [P4-TASK-STATUS.md](P4-TASK-STATUS.md).

## Contract preserved

The five graph tables and `Graph` response stay unchanged: `nodes`, `edges`, `evidence`, `clusters`, `node_cluster`. Stable IDs are text slugs, node labels are `name`, and `confidence` may be `null`. The Blueprint's illustrative UUID/`canonical_name` schema is not substituted for the working P1/P3 interface. Enums remain in [`contract/contract.json`](../contract/contract.json).

P1's `provenance.json`, `coverage.json` and `demo_paths.json` are sidecars. The graph contains 58 nodes, 69 edges, 77 evidence records, four provisional clusters and 70 memberships. There are no tier C or D claims in this baseline. P4 does not reinterpret the provisional clusters as final P2 output.

Funding continues to use the actual NIH metadata in award-asset `props.funder` and the existing `asset_disease` relation. No funder enum or new relationship is added. Any future network projection needs an explicit, reviewed contract change; shared funding is not biological or therapeutic equivalence.

## Database and role boundary

[`0002_roles_rls.sql`](../supabase/migrations/0002_roles_rls.sql) adds user roles, organizations/memberships, contributions, restricted professional contacts, explanation/coverage caches and guarded RPCs. It applies after `0001_graph.sql`. It does not provision real Auth accounts or import personal contact details.

The policies use `auth.uid()` when Supabase Auth is available. The local compatibility helper reads the database request identity for isolated tests/PostgREST. A caller's submitted role string does not grant a role; `pathnet_role()` resolves the stored assignment. Test-injected identities prove policy behavior, not successful Auth sign-in.

| Capability | Anonymous / no role | Family | Group leader | Scout | Researcher | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Read public nodes, clusters, memberships | yes | yes | yes | yes | yes | yes |
| Read verified edges and their evidence | yes | yes | yes | yes | yes | yes |
| Read unverified/rejected graph edges | no | no | no | no | no | yes |
| Read restricted professional contacts | no | no | yes | yes | yes | yes |
| Submit source-backed contribution | no | no | yes | no | yes | yes |
| Read contributions | none | none | own / own organization | none | own | all |
| Approve/reject contribution | no | no | no | no | no | yes |
| Assign roles / organization memberships | no | no | no | no | no | yes |
| Direct graph writes from browser role | no | no | no | no | no | no |

Verified contradicting edges remain readable alongside supporting ones; explanation logic must not turn them into positive route support. Family evidence summary and richer persona home layouts are P3 presentation requirements. Public source quotations are readable by the backend's verified-graph policy; this implementation does not treat publicly sourced full quotes as role-confidential data. Restricted professional-contact rows are protected independently of UI visibility.

`professional_contacts` is a security-invoker view over protected `professional_contact_records`. The P1 graph already contains public investigator names and source IDs; those stay public research metadata. Separately curated professional contact rows support `public_email`, `public_url`, organization and source attribution; no telephone field is introduced. Tests use synthetic `example.test` rows only.

Platform records are not foreign-key dependent on the five reloadable graph tables. That preserves role assignments, contacts and review history during P1's legacy replacement loader, but a replacement still removes approved graph materializations. Use P4's upsert loader for an integrated database.

## Contributions and review

Use the authenticated user's token when calling PostgREST RPCs. No browser receives a service-role key.

- `submit_contribution(p_src, p_dst, p_type, p_source_url, p_snippet, p_org_id?, p_stance?, p_note?, p_source_type?, p_pmid?)` validates endpoint IDs/types against the shared graph contract and records server-assigned authorship. New contributions have tier `D` and status `unverified`; a group leader can submit for an organization only with the corresponding membership.
- `review_contribution(p_id, p_action, p_review_note?)` accepts `approve` or `reject` from an admin. Rejection requires a note. Approval creates the graph edge and evidence and records the review in one transaction. Tier remains `D`, while status becomes `verified`; admin review does not retroactively make the claim tier A or B.
- Direct contribution insertion/update/deletion is denied. Client-supplied author, role or review state cannot bypass the RPC. Role/organization administration has its own admin-only policies.

These are backend interfaces. P3 still needs the contribution form, review queue and role-aware feedback. See the [platform API contract](../contract/platform-api.md) and [typed interfaces](../contract/platform.ts) for endpoint details.

## Local verification

Use Node.js 24 for the TypeScript tests and Python 3.10+ for operator/pipeline scripts. Install the Python dependencies into the root `.venv` as in the README, then install the isolated PostgreSQL test runtime:

```bash
npm install --prefix .venv/p4-db-test --no-save --package-lock=false @electric-sql/pglite@0.5.8 @electric-sql/pglite-socket@0.2.11
```

Installation may need network access. The following checks then use an isolated local PostgreSQL/WASM instance and fixtures, without cloud services or API keys:

```bash
node scripts/tests/check_rls.mjs
node scripts/tests/check_platform.mjs
node --experimental-strip-types --test supabase/functions/tests/*.test.ts
node web/node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --lib ES2022,DOM supabase/functions/_shared/runtime.ts
python -m unittest discover -s scripts/tests -p 'test_*.py'
npm --prefix web run build
```

`make platform-test` or `bash run.sh platform-test` runs the two database scripts, endpoint tests and Python operator tests. Run the strict type check and web build separately. Both database scripts default to `.venv/p4-db-test/node_modules` and the root `.venv` Python executable. For an existing installation, set `P4_TEST_NODE_MODULES` to its `node_modules` directory and `P4_TEST_PYTHON` to its Python executable. These tests create an isolated database and do not use the operator's configured `DATABASE_URL`.

Earlier P4 baseline results, before the 58-node M1 refresh (historical 54-node run):

| Check | Evidence |
| --- | --- |
| RLS and unchanged P1 loader | 168 assertions passed, including all roles/anonymous/no-role reads, denied privilege escalation, organization visibility, guarded review, atomic rollback and exact graph equality after three legacy loads |
| Operator database integration | Passed upgrade from original `0001`, repeated migration, preserved approved edges/roles/audit on upsert, coverage cache loading and rejection of modified applied migrations |
| Endpoint behavior and types | 21 fixture-based endpoint/core tests passed; strict TypeScript checking passed |
| Offline response caches | Built 20 role-scoped explanation rows and one coverage snapshot; isolated database import passed |
| Operator unit tests | 5 tests passed |
| P1 regression and provenance | 64 tests passed; 76 evidence records audited against raw sources; 159 pinned PubMed records checked |
| Reproduction entry point | `bash run.sh data` rebuilt and audited the source snapshot with no resulting data changes |
| Existing frontend production build | Passed |
| Docker startup after Windows restart (2026-10-04) | Docker Desktop 4.93.0, Linux Engine 29.8.1; database healthy, seed exited 0, API and web running |
| Live PostgREST graph and caches | All rows matched the seed: 54 nodes, 68 edges, 76 evidence rows, 4 clusters and 69 memberships; 20 explanation rows and one coverage snapshot imported |
| Live anonymous access and web transport | Only 4 family explanations were readable; professional_contacts, contributions and user_roles each returned HTTP 401; web HTTP 200 and CORS checks passed |
| Local browser | Displayed `data: rest` and graph node details; browser error log was empty |

The endpoint tests use the real P1 graph and fixture Auth/REST/model responses; coverage is compared with P1's Python helper. The live Compose checks verify PostgreSQL, PostgREST and the web app after the one-shot seed service completed. Supabase Auth and the Edge runtime are not running. Five-role real sign-in, contribution/admin-review end-to-end acceptance, Deno deployment, real OpenAI extraction and browser role acceptance remain outstanding.

## Current M1 integration — 2026-10-04

The shared 58-node M1 source/data refresh and root README reproduction are now integrated locally. `bash run.sh seed` passed against the existing PostgreSQL 16.15 Docker database using the migration/upsert operator, and the db/api/web services remain running with `restart: unless-stopped` while Docker is available. The existing `pathnet_pgdata` volume persists data; no volume reset was needed.

Current verification and machine-readable evidence are in [P1-INTEGRATION.md](P1-INTEGRATION.md) and [m1-docker-integration.json](../data/acceptance/m1-docker-integration.json). The pinned graph remains 58 nodes, 69 edges, 77 evidence rows, four clusters and 70 memberships. The integrated P1 suite passed 99 tests. The earlier 64-test/54-node table above remains historical evidence; it is not the current dataset. Original native M1/credential-blocked checks retain their separate 86-test receipt. Concurrent M2 work is not certified as completed by this integration.

Local graph/REST/browser acceptance does not provision real Supabase Auth, run the Edge Runtime, wire P3 persona/admin UI, establish P2 model/clinical acceptance, complete P1/P2 peer review or deploy the product. Those gates and the M3 funder projection decision remain outstanding.

## Operator workflow

The default local path is `bash run.sh up` with Docker Desktop running and Bash available. Node.js 24 Alpine generates the deterministic bundle in `bootstrap_cache`; seed waits for database health and cache-build completion, then runs migrations, upsert and cache import from `/cache/platform.json`. API/web gate on seed success; web runs locked install, production build and Vite dev. `bash run.sh seed` repeats the cache build/import automatically. Host Python/Node.js and model/cloud credentials are unnecessary for this container workflow. Fresh staged-archive startup, exact graph/cache/frontend reads, automatic refresh and warm preservation checks passed; see [P4-BOOTSTRAP.md](P4-BOOTSTRAP.md) and [m1-bootstrap.json](../data/acceptance/m1-bootstrap.json).

The commands below are an optional direct operator workflow for a deliberately selected database. They require the stated host Python/Node.js prerequisites; they are not additional steps for normal Docker startup.

Copy `.env.example` to the ignored root `.env`. `scripts/platform.py` loads simple `KEY=value` entries; process environment variables take precedence. Run `python scripts/platform.py doctor` to report presence of configuration without printing values or contacting services.

After choosing an intended prototype database in `DATABASE_URL`:

```bash
python scripts/platform.py migrate
python scripts/platform.py seed
```

`migrate` applies numbered SQL once and records canonical-content checksums in `pathnet_private.migrations`. Change an applied schema by adding another migration; editing an already applied file fails the ledger check. `seed` validates and upserts P1 rows and coverage; rows absent from the seed, such as approved contributions, are retained. Deliberate deletion of obsolete seed rows is therefore a separate reviewed operation.

The Docker seed service runs migration, graph/coverage upsert and automatic cache import after its cache-build dependency succeeds. The original `pipeline/load_seed.py` remains unchanged for P1 compatibility and replaces the five graph tables. `bash run.sh reset` deletes the Docker volumes; it is unnecessary for applying migrations or refreshing graph/caches with the operator workflow.

For the optional direct operator workflow, offline explanation caches can be built and then loaded into the intended database:

```bash
node scripts/build_platform_cache.mjs
python scripts/platform.py cache --input .venv/p4-platform-cache.json
```

The builder uses the reviewed graph, demo paths and coverage. Cache import removes superseded responses for the supplied audience and exact ordered path, while retaining unrelated paths and audiences. This was verified with stale entries, an unrelated ordered path and a repeated import. This is preparation of local deterministic responses, not a completed P2 model-generation or evaluation run. Caches need rebuilding after graph changes and review before publication.

## Supabase and deployment gates

Cloud setup is deferred by the user's instruction to finish locally first. When a project is selected, configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and its operator `DATABASE_URL` in local secrets. Keep service-role/OpenAI keys out of every `VITE_` variable. Apply migrations and seed before provisioning identities.

Five demo emails and passwords use `DEMO_FAMILY_*`, `DEMO_GROUP_LEADER_*`, `DEMO_SCOUT_*`, `DEMO_RESEARCHER_*`, `DEMO_ADMIN_*`. Each email must be different and each password at least 12 characters. Then:

```bash
python scripts/platform.py demo-users
python scripts/platform.py smoke-auth
```

Provisioning uses the Auth admin API, sends no email, and refuses to adopt an existing identity unless its PathNet demo-role metadata matches. It never resets an existing password. Provisioning is an explicit operation on the selected project. `smoke-auth` signs in each identity and checks its stored role and access to a verified edge; it does not test every UI view or replace the clean-browser demo.

Before deployment acceptance: configure function secrets/origins; serve/deploy the Edge Functions in the actual Supabase runtime; exercise allowed and denied requests with real Auth tokens; connect P3's Auth/REST/function calls; verify all five personas and admin review in a clean browser; check source attribution, mobile layout and demo paths. Record the URL and evidence only after those actions succeed. Audio, videos and submission remain separate outputs.

## P2/P3 handoff

P2 owns extraction schemas, reviewed model output, gold-set scores and final explanations/clusters. The platform preserves quote validation, cited edge IDs, explicit hypotheses and the no-route coverage boundary; a pending extraction draft is not a verified graph edge. Explanation generation currently has a deterministic cited fallback. No live explain-model result is claimed.

P3 keeps `loadGraph(): Promise<Graph>` and implements client calls against the additive [typed API contract](../contract/platform.ts). No web adapter or UI wiring is included in this P4 delivery. Use the actual Auth token for protected requests. Connect contribution/review interfaces, restricted contacts and role-specific presentation to backend permissions; do not infer authorization from a dropdown. Use `demo_paths.json` for stable IDs and [the demo script](P4-DEMO-SCRIPT.md) for scoped narration. Family summary versus full evidence depth remains a UI decision over the readable public graph.
