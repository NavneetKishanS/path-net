# Accounts, onboarding and reading preferences

This additive local account adapter gives the existing frontend a verified identity and saved preferences. It uses the existing PostgreSQL database; it is separate from Supabase Auth and does not create `auth.users` records. The five graph tables, graph contract, existing `api.ts` methods and `loadGraph(): Promise<Graph>` signature remain unchanged.

## Local setup

After cloning, choose either of these entry points:

```sh
# Complete stack in containers; requires Docker Desktop and Bash, no host Node.js.
bash run.sh up

# Frontend on your computer; requires Node.js and running Docker Desktop.
npm --prefix web ci
npm --prefix web run dev
```

The Docker stack applies the graph, role and account migrations before starting the frontend. The frontend container receives its server-only account connection for `db:5432/pathnet` directly from Compose, even when a local `web/.env.local` exists.

For direct development, when no explicit account database URL is configured, startup creates and starts the Compose database, imports the graph and caches, starts the REST API, and configures the same-origin account graph proxy. It creates ignored `web/.env.local` only if that file does not already exist. An existing file is preserved; if it lacks an account URL, startup uses the automatic Docker connection for the current process. The default host database is `127.0.0.1:54322/pathnet`; custom project and port settings come from the root `.env` and terminal environment through Compose. Registration is ready after startup without a separate account setup command. Host Python and cloud keys are unnecessary.

The generated file contains `PATHNET_ACCOUNT_LOCAL=true`. This marks its database as the managed Compose stack, allowing a later development start to restart the stack after it has been stopped and use its currently configured ports. An account URL supplied directly in the terminal takes precedence and is treated as an independently managed database, even if the file retains that marker.

Automatic startup uses the resolved Compose web port (`PATHNET_WEB_PORT`, default 5173) for the frontend running on your computer, unless `PORT` is already set. With an independently managed database, set `PORT` directly to choose the frontend port; Compose settings are not consulted.

PostgreSQL data and saved accounts persist in the Compose database volume. Restarting the app or running setup again preserves them. `bash run.sh down` stops the containers and keeps their data; `bash run.sh reset` deliberately deletes the volumes, including registered accounts.

Set `PATHNET_ACCOUNT_BOOTSTRAP=false` to disable automatic database preparation for a guest-only or independently managed workflow. For guest-only use, leave `PATHNET_ACCOUNT_DATABASE_URL` unset and set `NEXT_PUBLIC_ACCOUNT_PROXY=false`; use a mock or static graph adapter. The production build command does not provision or start a database.

### Use an existing database without Docker

Start with a reachable PostgreSQL database that already has migrations `0001_graph.sql` and `0002_roles_rls.sql`. Use [web/.env.example](../../web/.env.example) as the configuration reference: put its connection string in the server-only `PATHNET_ACCOUNT_DATABASE_URL` in `web/.env.local` or your terminal environment. If replacing an automatically generated configuration, set `PATHNET_ACCOUNT_LOCAL=false` in that file. Keep `NEXT_PUBLIC_DATA_SOURCE=rest` and `NEXT_PUBLIC_ACCOUNT_PROXY=true` to load the graph through the session-aware, same-origin proxy. Then run `npm --prefix web run dev`; startup checks or initializes account storage against that database and does not start Docker. Restart or rebuild the frontend after changing these settings.

For an explicit setup check, run from `web/`:

```sh
npm run accounts:setup
```

This applies `0003_account_profiles.sql` when needed, adding private accounts and sessions plus own-row profiles. Re-running it preserves existing accounts; graph counts are checked before and after the migration. It does not reseed the graph.

Account setup shares the platform migrator's lock, normalized SQL checksum and `pathnet_private.migrations` ledger. Account tables created by the earlier setup command without a ledger entry are verified and recorded without deleting saved users. A later platform migration then recognizes `0003` as already applied. Incomplete or inconsistent account storage fails the check instead of being reset automatically.

Database credentials must never use a `NEXT_PUBLIC_` variable. The local demo uses operator database access. A deployed installation should use a dedicated server-only database identity with the required private-schema/account access, role/profile provisioning permissions and permission to `SET ROLE anon` and `SET ROLE authenticated`. Browser roles must not receive private-schema access. This adapter does not replace an eventual Supabase Auth integration.

## Roles and permissions

The four onboarding choices select a presentation perspective: patient/caregiver, patient group leader, biotech scout or researcher. A URL `role` parameter and the profile's preferred perspective never grant protected permissions.

Every self-registered account starts with the database role `family`. Professional perspectives can browse public research while their protected role remains pending assignment. Administrator access is never offered during registration. An operator assigns a registered account's authoritative role from `web/`:

```sh
npm run accounts:role -- <registered-email> <family|group_leader|scout|researcher|admin>
```

The account can refresh its session or sign in again to pick up the assignment. The same-origin graph proxy verifies the opaque session, sets transaction-local database claims and switches to `anon` or `authenticated`; existing PostgreSQL RLS policies decide which records are visible. Administrator navigation and local curator tools require an assigned administrator role.

### Administrator access walkthrough

1. Register an ordinary account through the two-step setup. Choose any of the four offered perspectives; none grants administrator permission.
2. An authorized database operator opens the repository's `web/` folder. Direct development normally creates `.env.local` and initializes account storage automatically; for an existing database, configure the server-only `PATHNET_ACCOUNT_DATABASE_URL` there using [web/.env.example](../../web/.env.example) as the reference. Operator commands read that saved URL or a URL supplied in the terminal. If the file was preserved without an account URL, or the managed database's project/port settings changed afterward, supply the current connection explicitly before assigning roles. `npm run accounts:setup` can check storage explicitly.
3. From `web/`, assign the registered account's role:

   ```sh
   npm run accounts:role -- "registered-user@example.com" admin
   ```

   Replace the example address with the account's registered email. The command updates its database role; it does not create an account or change its password.

4. Refresh the browser, or sign out and sign in again. Select **Admin** in the **Viewing as** menu, or open `/admin?role=admin` on the running app.

There is no web interface for granting roles. Adding `role=admin` to a URL or changing a viewing preference does not grant permission; an unassigned account cannot enter the administration view. Administrator review decisions and synonym edits remain account-scoped local browser demonstrations and do not update the shared graph.

## User journey and saved data

On a first home-page visit, the two-step setup opens automatically. Step 1 chooses a role or continues as a guest into the existing pages. Step 2 creates an account and chooses reading depth, up to 20 followed diseases/genes/mechanisms, starting page, theme, graph/table view and the assistant when available for that perspective. Existing users can sign in instead. Setup completion is remembered in that browser.

The account menu provides sign-out and **Profile & preferences**. The database stores the display name and workspace preferences in a profile protected by own-row RLS. Email is the sign-in identifier and is read-only in the profile editor. Interests reference existing graph node IDs and are not diagnoses; they do not add patient records to the public graph. Graph refreshes do not delete saved preferences, and unavailable followed topics are identified in the interface.

Action progress, custom task notes and administrator review/synonym demonstrations retain their existing browser-only behavior, now separated by verified account. They do not sync across devices or update the shared graph. Existing guest action progress remains in the original guest store. Chat is session-only and is cleared, together with identity-dependent caches, when the account or assigned role changes. Old session/chat responses are guarded against restoring a previous identity after sign-out.

## Simple language

Patient views can switch between **Simple language** and **Academic language** in the header/account menu; the choice can also be set during setup or in preferences. Signed-in choices are saved to the profile; guest choices stay in that browser.

The simple mode is English presentation copy plus a small curated glossary in `web/src/lib/plain-language.ts`, covering selected symptom, gene, variant, mechanism and research-resource terms. It does not translate the entire database or overwrite source records. Original names, citations, contradictions and uncertainty remain available; terms without an explanation keep their original wording. Broader language coverage requires additional reviewed copy rather than automatic rewriting of evidence.

## Account API and current limits

New routes live under `/api/account`: `GET session`, `POST register`, `POST login`, `POST logout`, `PATCH profile`, and `GET graph?resource=...`. The graph route accepts only `nodes`, `edges`, `evidence`, `clusters` and `node_cluster`; it exposes no private account tables. Passwords are scrypt hashes and sessions are stored as token hashes. The browser receives an HttpOnly, SameSite cookie; HTTPS adds the Secure flag. Mutation requests reject a different origin.

This local adapter has no email-verification, password-recovery or email-change service. Professional verification/role assignment is an operator step. Saved preferences and browser-only workflow progress should be described separately when demonstrating the product.

## Verification

For the complete Docker stack, `bash run.sh smoke` checks graph/cache rows, the web response and that `/api/account/session` reports the account service configured. When using the frontend on your computer with its managed Docker backend, supply the actual frontend origin, for example `WEB_URL=http://localhost:5173 bash run.sh smoke`; retain the same Compose project and port settings in that terminal. This configuration check does not create an account or replace a registration/sign-in test.

From `web/`, run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. For a running local demo, set `PATHNET_TEST_URL` to its origin and run `npx playwright test -c playwright.account.config.ts`. Windows uses installed Microsoft Edge by default; `PATHNET_TEST_BROWSER_CHANNEL` can select another installed browser channel.

The automatic startup suite runs with the installed frontend dependencies and needs no additional runtime:

```sh
npm --prefix web run test:bootstrap
```

The account storage suite uses an isolated PGlite database. From the repository root, optionally install its test runtime, then run the suite:

```sh
npm install --prefix .venv/p4-db-test --no-save --package-lock=false @electric-sql/pglite@0.5.8
npm --prefix web run test:account-storage
```

Alternatively, set `P4_TEST_NODE_MODULES` to an existing runtime's `node_modules` directory containing PGlite. These two suites do not load real `.env` files or connect to a real database. They verify startup decisions and account storage independently; they do not establish that the Docker stack passes an end-to-end registration test.

The account suite covers own-row database isolation, forged roles and sessions, cross-origin rejection, logout revocation, two-step onboarding, saved preferences, delayed session responses, mobile layout and the existing v2 research/action journeys. Integration tests create only marked temporary accounts and graph fixtures and remove their own records afterward; the five graph table counts must match their initial values.
