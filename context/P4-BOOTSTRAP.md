# P4 one-command local bootstrap

Status: **fresh staged-archive bootstrap and warm preservation acceptance passed**. Scope: the `p1/data` publication checkout, 2026-10-04 (Europe/Berlin). This workflow includes the reviewed graph, platform migrations and deterministic response caches. Its scoped result is recorded in [m1-bootstrap.json](../data/acceptance/m1-bootstrap.json). Historical native, shared Docker and publication checks retain their own unchanged receipts.

## Fresh startup

The host needs Bash and a running Docker Desktop with Compose. No host Python/Node.js, AI key or cloud account is needed for the local path. First startup needs access to container images and npm dependencies. From the repository root:

```bash
bash run.sh up
```

This foreground command creates an ignored `.env` if needed and shows startup logs. Once ready, open [localhost:5173](http://localhost:5173), search `STXBP1`, and inspect the RARE-X asset's verified source evidence. In a second terminal, from the same repository root:

```bash
bash run.sh smoke
```

Smoke checks the graph tables, anonymous family explanation cache, current coverage snapshot and web response. The browser should display `data: rest`. An unknown-query fixture should display `No supported route`.

## Startup ordering and expected data

| Stage | Runtime and result |
| --- | --- |
| Database | PostgreSQL in the persistent `pgdata` Docker volume; seed waits for database health |
| Cache build | One-shot `cache-build` uses Node.js 24 Alpine; `/cache/platform.json` is shared through the dedicated `bootstrap_cache` volume |
| Seed | Waits for healthy db and successful cache-build; applies migrations, upserts graph/coverage and imports the bundle |
| API | PostgREST starts after the seed succeeds |
| Web | Starts after the seed/API gates; `npm ci`, production build, then Vite development server in REST mode |

The verified fresh baseline has **58 nodes, 69 edges, 77 evidence rows, four provisional clusters and 70 memberships**. The deterministic bundle contains **20 role-scoped explanations and one coverage snapshot**. Anonymous reads expose **four family explanations** and one coverage snapshot; protected contacts, contributions and user-role tables remain denied. Preserved approved contributions or independently stored cache paths may add rows to a reused database. These cache/role checks do not create real Auth accounts.

## Safe rerun and parallel stacks

After changing a reviewed graph, use:

```bash
bash run.sh seed
bash run.sh smoke
```

The seed command rebuilds and imports the current caches automatically. Migration checksums remain enforced; graph upsert preserves platform records and rows absent from the seed, including approved contributions. Cache import replaces superseded responses for the same audience and exact ordered path while retaining unrelated paths/audiences. A normal refresh needs no database-volume reset.

Stop foreground services with Ctrl+C, or use `bash run.sh down`; both retain persistent data. The db/api/web services use `restart: unless-stopped` while Docker is available. Windows/Docker boot startup is outside this configuration. `bash run.sh reset` deliberately removes local volumes, including the database; it is not a refresh step.

Optional settings: `COMPOSE_PROJECT_NAME` defaults to `pathnet`; `PATHNET_DB_PORT`, `PATHNET_API_PORT`, `PATHNET_WEB_PORT` default to 54322, 3001, 5173. For a parallel stack:

```bash
export COMPOSE_PROJECT_NAME=pathnet-p4
export PATHNET_DB_PORT=54323
export PATHNET_API_PORT=3002
export PATHNET_WEB_PORT=5174
bash run.sh up
```

Use the same exports in the second terminal for smoke and later seed/down operations. These settings can also be placed in the ignored `.env`; warm startup with project/ports supplied solely through that file was verified. Different project names isolate volumes; different ports avoid conflicts. The browser and smoke use the chosen API/web ports.

## Acceptance and remaining P4 work

The [bootstrap receipt](../data/acceptance/m1-bootstrap.json) records these passed checks:

| Check | Scoped result |
| --- | --- |
| Clean staged archive | All 455 raw/seed files byte-identical; no initial `.env`, `.venv` or `node_modules` |
| Fresh volumes and literal `up` | Unique empty pgdata/bootstrap_cache/web_node_modules volumes; `.env` created; cache-build and seed exited 0; API/web running |
| Frontend startup | Locked `npm ci`, production build of 1064 modules, then REST-backed Vite dev |
| Baseline graph | Every row of all five SQL/REST tables and actual frontend `loadGraph(rest)` matched 58/69/77/4/70 |
| Baseline cache and anonymous access | 20 explanations and one coverage snapshot matched an independent rebuild; four family explanations visible; protected tables denied |
| Literal entry points | `bash run.sh smoke` and `bash run.sh seed` passed |
| Warm startup | `down` retained volumes; literal `up` succeeded with project/ports solely from `.env` |
| Populated preservation | Isolated test-db admin role, approved contribution and unrelated reversed ordered-path cache retained |
| Cache supersession and rerun | 20 stale keys removed, 41 entries reduced to 21 including the unrelated path; repeated seed remained stable |
| Regression | 87 pipeline tests and 77 raw evidence checks passed; two-migration ledger stable |

Temporary populated fixtures were confined to the isolated acceptance database. This acceptance proves the staged snapshot's local Docker workflow; it does not certify a remote Git push or a deployed product. Existing [native](../data/acceptance/m1-native.json), [shared Docker](../data/acceptance/m1-docker-integration.json) and [publication](../data/acceptance/m1-publication.json) receipts retain their original scope and test counts.

The same runtime workflow was synchronized to the existing shared project and verified with literal startup and smoke: its original `pathnet_pgdata` volume and all source/protected rows were retained, the 20-explanation/one-coverage bundle matched an independent rebuild, and the actual frontend REST loader passed. The bootstrap receipt records this separately under `shared_project_sync`.

Supabase Auth and the Edge Runtime are separate P4 work. Configure a selected project and its server-side secrets, apply migrations, provision five distinct demo identities, verify real sessions and deployed function boundaries, then complete the five-login browser journey with P3. Current local role tests and the presentation-only role selector do not certify those steps. Cloud/deployed acceptance, P2 model evaluation/final clustering, P1/P2 peer review, funder representation, media and submission remain open. Follow [P4 task status](P4-TASK-STATUS.md) and [platform operator notes](P4-PLATFORM.md).
