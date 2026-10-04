# P1 M1 integration into the shared database

Accepted locally: **2026-10-04, 02:25:40 Europe/Berlin** (`2026-10-04T00:25:40Z`). Shared checkout: `D:\Hack_Nation\path-net`, branch `p4/platform`. The source delivery remains at `D:\Hack_Nation\path-net-p1-m1` on `p1/data`. This is the historical local acceptance record. The accepted 58-node source/data snapshot and required platform dependencies are now bundled in the user-authorized `p1/data` publication; see [publication scope and checks](P1-PUBLICATION.md). The local receipt does not certify a Git push, cloud deployment or submission.

The current P1 M1 snapshot is integrated into the shared source tree and existing `pathnet` PostgreSQL database. The literal `bash run.sh seed` command passed using P4's migration/upsert operator, retaining its migration ledger and platform implementation. The database-backed app now reads **58 nodes, 69 edges, 77 evidence rows, four provisional clusters and 70 memberships**. The root README, source inventory, P1/P4 status and role/handoff documents have been synchronized in English.

## Runtime and persistence

| Component | Verified local state |
| --- | --- |
| Database | PostgreSQL 16.15, database `pathnet`, loopback port 54322 |
| REST API | PostgREST 12.2.3, [local API](http://127.0.0.1:3001) |
| Application | [local app](http://127.0.0.1:5173), configured for `data: rest` |
| Storage | Existing named Docker volume `pathnet_pgdata` |
| Continuing services | `pathnet-db-1`, `pathnet-api-1`, `pathnet-web-1` running with `restart: unless-stopped` |
| Seed task | Completed one-shot migration/upsert; a continuously running seed process is unnecessary |

The db/api/web services were explicitly restarted, then SQL rows, REST responses, the actual frontend loader and the RARE-X browser evidence were rechecked. The same persistent volume and dataset remained available. Docker must be available for these restart policies to operate; this work does not configure Windows or Docker boot startup. The earlier temporary native acceptance processes were stopped after their own test; they are separate from this continuing shared Docker runtime.

The pre-update database was backed up under `D:\Hack_Nation\tmp\p1-shared-integration-backup\database-before.dump`, with a JSON comparison snapshot alongside it. Its graph had 54 nodes, 68 edges, 76 evidence rows, four clusters and 69 memberships. All prior graph identities were retained. Live role, organization, membership, professional-contact and contribution tables were empty before and after the update; their equality was checked. Separate populated operator/RLS regressions verified preservation of roles, approved contributions and audit state. No database volume reset was used.

## Acceptance evidence

The [machine-readable receipt](../data/acceptance/m1-docker-integration.json) has `status: passed` and binds the tested graph file to SHA-256:

`c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`

| Check | Result |
| --- | --- |
| Literal entry points | `bash run.sh seed` and `bash run.sh smoke` passed |
| Migration ledger | Two migrations retained; no applied-file drift |
| Five graph tables | Every SQL row and every anonymous REST row exactly matched the pinned seed |
| Actual frontend adapter | `web/src/api.ts` `loadGraph(rest)` exactly matched all five tables, including after service restart |
| Source regression | 99 pipeline tests, 77 raw evidence checks and 159 pinned PubMed records passed |
| Integrated rebuild | `build_graph.py --output-dir` produced graph, coverage, demo paths and provenance byte-for-byte identical to the integrated seed |
| Platform regression | 168 RLS assertions, 21 endpoint tests, five operator unit tests and operator database integration passed |
| Current caches | 20 role-scoped explanations and one coverage snapshot matched the rebuilt bundle; anonymous readers saw only four family explanations |
| Cache replacement regression | Superseded keys for the same audience and exact ordered path were removed; unrelated paths/audiences were preserved; repeated import remained stable |
| Protected anonymous reads | Professional contacts, contributions and user roles were denied |
| Web transport/build | HTTP, REST configuration, CORS and Docker frontend production build passed |
| Browser | REST mode, STXBP1 search, new RARE-X asset and verified tier B source URL/quote/retrieval date checked; zero browser error logs |
| Unknown query | `No supported route` shown for the unknown-query fixture |
| Persistence | SQL/REST/frontend loader and RARE-X evidence rechecked after explicit db/api/web restart |

The cache refresh initially exposed older explanation keys surviving beside current keys. The operator now supersedes prior entries only for the supplied audience and exact ordered path. The refreshed live database contains 20 current explanations rather than duplicate old/new sets. The isolated regression retained an unrelated ordered path while reducing 41 entries to the expected 21, and a repeated import stayed at 21.

[Post-restart browser screenshot](../data/acceptance/m1-docker-browser.jpg) shows the REST-backed RARE-X evidence panel. The unknown-query state was checked before the restart; the RARE-X evidence was checked again afterward. Historical source/native acceptance remains in [P1-M1-EXECUTION.md](P1-M1-EXECUTION.md), [m1-native.json](../data/acceptance/m1-native.json) and [m1-browser.png](../data/acceptance/m1-browser.png). Its original 86-test credential-free run remains a distinct receipt; the current 99-test suite includes concurrent M2 work and does not certify the whole M2 milestone.

## Repeat the integrated workflow

Run from the shared repository root with Docker Desktop and Bash available:

```bash
bash run.sh seed
docker compose up -d db api web
bash run.sh smoke
```

The seed command applies pending migrations and upserts the reviewed graph and coverage. It retains graph rows absent from the seed, including approved contributions. It uses the existing database volume. Use the [root README](../README.md) for Python environment setup and offline source rebuilding/auditing.

After a graph change, rebuild and load the deterministic explanation bundle using Node.js 24 and the configured operator Python environment:

```bash
node scripts/build_platform_cache.mjs
python scripts/platform.py cache --input .venv/p4-platform-cache.json
```

`DATABASE_URL` must select the intended database for a direct operator command. Alternatively, use the Docker seed service's already configured local connection:

```bash
docker compose run --rm seed python scripts/platform.py cache --input .venv/p4-platform-cache.json
```

`bash run.sh down` stops services and retains the database volume. Starting db/api/web again resumes that data. Use ordinary seeding and cache import for updates; a volume reset is unnecessary. The original `pipeline/load_seed.py` intentionally replaces all five graph tables and can remove approved graph contributions, so it is retained for deliberate baseline replacement rather than integrated refresh.

## Remaining gates

This acceptance closes the local M1 shared-database, app-read and current README integration gap. It does not certify Supabase Auth, the Edge Runtime, cloud/deployed acceptance, five browser logins, P3 action/persona/admin/coverage integration, P2 model evaluation/final clustering, media or submission. P1/P2 M4 human source-context peer review and P1/P4 M3 funder relation/projection agreement remain open. M0 slice approval does not substitute for M4 peer sign-off. Source scope, unknown variant effects, contradictory evidence, nullable confidence and the five-table contract remain preserved.
