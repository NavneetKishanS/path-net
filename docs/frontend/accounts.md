# Accounts, onboarding and reading preferences

This additive local account adapter gives the existing frontend a verified identity and saved preferences. It uses the existing PostgreSQL database; it is separate from Supabase Auth and does not create `auth.users` records. The five graph tables, graph contract, existing `api.ts` methods and `loadGraph(): Promise<Graph>` signature remain unchanged.

## Local setup

Start with a database that already has migrations `0001_graph.sql` and `0002_roles_rls.sql`. Use [web/.env.example](../../web/.env.example) as the configuration reference, supplying the server-only `PATHNET_ACCOUNT_DATABASE_URL` privately. Keep `NEXT_PUBLIC_DATA_SOURCE=rest` and set `NEXT_PUBLIC_ACCOUNT_PROXY=true` to load the same graph tables through the session-aware, same-origin proxy. Restart or rebuild the frontend after changing these settings.

From `web/`:

```sh
npm run accounts:setup
```

This applies `0003_account_profiles.sql`, adding private accounts and sessions plus own-row profiles. Re-running it preserves existing accounts; graph counts are checked before and after the migration. It does not reseed the graph.

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
2. An authorized database operator opens the repository's `web/` folder and configures the server-only `PATHNET_ACCOUNT_DATABASE_URL` in `.env.local`, using [web/.env.example](../../web/.env.example) as the reference. If account storage has not been initialized, run `npm run accounts:setup` first.
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

From `web/`, run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. For a running local demo, set `PATHNET_TEST_URL` to its origin and run `npx playwright test -c playwright.account.config.ts`. Windows uses installed Microsoft Edge by default; `PATHNET_TEST_BROWSER_CHANNEL` can select another installed browser channel.

The account suite covers own-row database isolation, forged roles and sessions, cross-origin rejection, logout revocation, two-step onboarding, saved preferences, delayed session responses, mobile layout and the existing v2 research/action journeys. Integration tests create only marked temporary accounts and graph fixtures and remove their own records afterward; the five graph table counts must match their initial values.
