# P4 platform API (additive, local implementation)

The graph contract remains `contract.json` and the five tables consumed by `loadGraph(): Promise<Graph>`. `platform.ts` adds endpoint types without changing those fields, enums, or P3 code. The handlers read their own graph through Supabase REST under the caller's JWT and anon key. A request cannot supply a graph, evidence, role, model, or privileged key.

## Endpoints

All three are JSON `POST /functions/v1/<name>` with `Content-Type: application/json`. For logged-in users send `Authorization: Bearer <access_token>`; gateway callers also send the project's public anon key as `apikey`. The `no-route` and `explain-path` handlers allow public graph reads. `extract-abstract` always verifies the session with Supabase Auth and requires the database role `group_leader`, `researcher`, or `admin`.

| Function | Body | Successful response |
| --- | --- | --- |
| `no-route` | `{ "query": "STXBP1" }` | The exact `CoverageReport` field names and semantics from `pipeline/coverage_report.py` |
| `explain-path` | `{ "edge_ids": ["group_stxbp1_disease", "asset_starr_disease"], "query": "STXBP1" }` | `ExplainedPath` or `UnsupportedPath` |
| `extract-abstract` | `{ "pmid": "<numeric PMID>", "abstract": "<pasted source text>" }` | `ExtractAbstractResponse`; never automatically saves claims |

`CoverageReport` fields are `query`, `status`, `matched_node_ids`, `supported_edge_ids`, `searched`, `missing`, `next_steps`, `limitations`, and `coverage`. Exact names, synonyms and external identifiers are checked before substring matches. Only direct verified A/B supporting edges with source URL and snippet count as coverage. An unknown query means a gap in the selected slice, never absence of research. `coverage` contains the dated P1 snapshot from `coverage_cache`; it is `{}` if the optional cache is unavailable. P1's wording is preserved. Runtime results only cover rows visible to the caller.

`ExplainedPath` has `status: "explained"`, `mode: "deterministic"`, `cache: "hit" | "miss"`, `sentences`, `contradictions`, and `limitations`. Each sentence has `text`, `edge_ids`, `evidence_ids`, `tier`, `kind`, and `note`. Show the original edge scope note and evidence alongside the sentence. Tier C is explicitly a hypothesis with “may” wording, never a published finding. Contradictory edges appear separately and cannot support a route. D claims and any unverified/rejected edge do not form explanation steps. A route must be an ordered connected walk, allowing traversal in either direction while preserving the original relationship direction in its explanation.

An empty, disconnected, hidden, unknown, unsupported or uncited path returns `{ "status": "no_supported_route", "reason": "empty_path" | "unsupported_path" | "disconnected_path", "coverage": <CoverageReport> }`. The nested report can still show supported direct connections for the query even when the requested path is unsupported; these are distinct statements. No edge existence is disclosed beyond the caller's RLS scope.

Extraction returns `status: "pending_review" | "unavailable"`, `claims`, `dropped`, `cache`, and `message`. Each draft preserves P2's subject/relation/object/effect/stance/quote shape and adds the supplied PMID, its canonical PubMed URL, `tier: "D"`, `status: "unverified"`, and `source_verified: false`. Graph confidence stays `null` because model scores are uncalibrated. The URL is derived from the user-supplied PMID and is **not** independently verified. Exact, case-sensitive quote containment in the pasted abstract and frozen relation endpoint types are checked server-side; unsupported claims are dropped. The curator must verify that text belongs to the PMID and review scientific scope and node reconciliation before submission/approval. This endpoint never writes evidence, contributions, nodes, or edges. P3 may map a reviewed, reconciled draft to the separate contribution RPC; it must not directly promote a draft into the graph.

Missing OpenAI configuration, refusals, incomplete output or model errors return `unavailable` with an empty list. Empty valid extraction returns `pending_review` with an empty list. P2 retains ownership of extraction evaluation, ontology reconciliation, inference and richer scientific explanations.

## Contribution RPCs and professional contacts

`platform.ts` is a set of typed interfaces, not an implemented P3 client adapter. P3 must wire requests and authenticated sessions in its own client. The database interfaces are separate from Edge Function requests:

| Database endpoint | Typed input/result | Authorization and behavior |
| --- | --- | --- |
| `POST /rest/v1/rpc/submit_contribution` | `SubmitContributionParams` → one `ContributionRow` | Group leader/researcher/admin; validates existing node IDs, directed endpoint types, source URL and quote; inserts tier D/unverified with server-assigned creator |
| `POST /rest/v1/rpc/review_contribution` | `ReviewContributionParams` → one updated `ContributionRow` | Admin only; `approve` creates a source-cited graph edge retaining tier D and null confidence; `reject` requires a review note; a second review is rejected |
| `GET /rest/v1/contributions?select=*` | `ContributionRow[]` | Admin sees the queue; researcher sees own contributions; group leader sees own and permitted organization contributions |
| `GET /rest/v1/professional_contacts?select=*` | `ProfessionalContactRow[]` | Authenticated group leader/scout/researcher/admin; family and anonymous callers cannot access contact routes |

RPC JSON keys are the exact PostgreSQL argument names (`p_src`, `p_dst`, `p_type`, `p_source_url`, `p_snippet`, optional `p_org_id`, `p_stance`, `p_note`, `p_source_type`, `p_pmid`; review uses `p_id`, `p_action`, optional `p_review_note`). Omitted optional fields use SQL defaults. Explicit null is only allowed where the TypeScript interface permits it. Researchers submit without an organization; a group leader must belong to a supplied organization; admin may select one. Draft names must first be reconciled to existing graph node IDs before submission.

Both SQL RPCs return one `public.contributions` record. For a single HTTP object, request `Accept: application/vnd.pgrst.object+json`; the default row representation is an array. See [PostgREST resource representation](https://postgrest.org/en/latest/references/api/resource_representation.html). RPC errors use native PostgREST `{code, message, details, hint}`, not the Edge Function error wrapper. Public investigator names and research attribution remain in P1 graph rows; professional contact routes are a distinct protected view. Approved D edges can be displayed with provenance but do not count as A/B no-route support or enter these deterministic explanations.

## Caches and configuration

`explanation_cache` stores `{ cache_key, edge_ids, audience, payload }`. The SHA-256 key covers version, role, ordered requested edge IDs and the current canonical caller-visible node/edge/evidence rows. The handler checks graph visibility and evidence first, then reads the persisted cache before falling back to a bounded in-memory cache or deterministic generation. Cached payloads must exactly match the current grounded deterministic output, including scope notes and citations. JSON object property order does not affect the key or validation. No model call is needed for explanations. Optional cache failure falls back to grounded output; a graph read failure returns an error.

`coverage_cache` uses key `p1-slice-v1`, audience `family`, and the unchanged `data/seed/coverage.json` object as payload. Cache tables are read-only to browser and edge callers. Operators load them through the database connection. A reload or changed RLS scope invalidates explanation keys automatically.

Build the four P1 demo paths for all five roles without keys:

```powershell
node scripts/build_platform_cache.mjs
# Optional output path:
node scripts/build_platform_cache.mjs --output .venv/p4-platform-cache.json
```

The bundle contains `explanation_cache` (20 rows for this P1 snapshot) and `coverage_cache` (one row). Load with `python scripts/platform.py cache --input .venv/p4-platform-cache.json` after configuring the local database and applying migrations. See the root README for the appropriate Python executable in your environment. The in-memory explanation cache is an availability fallback, not a persistent deployment cache.

Server environment:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project or local Supabase endpoint |
| `SUPABASE_ANON_KEY` | Public anon key used together with the forwarded caller JWT; never a service-role key |
| `ALLOWED_ORIGINS` | Comma-separated exact browser origins; defaults to localhost and 127.0.0.1 on port 5173 |
| `OPENAI_API_KEY` | Optional server-only key for live abstract extraction |
| `OPENAI_MODEL_EXTRACT` | Explicit model selection supporting Responses Structured Outputs; no guessed model default |

`supabase/config.toml` disables gateway JWT verification because the read endpoints are public and the handlers validate actual user sessions through Auth. Authentication and role checks remain mandatory in the extraction handler. CORS is an origin allowlist, not authentication. Configure deployed origins explicitly. Do not expose server secrets in `VITE_*` variables.

The extraction adapter uses OpenAI Responses with `text.format` JSON Schema, `strict: true`, and `store: false`, as documented in [official Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs). Model output receives independent local validation. No live model call has been exercised without credentials. Extraction reuse is isolated by user, role, model and input hash for five minutes; the prototype has a per-instance 10-second request interval and bounded caches, not a distributed quota system. Pasted source text is sent to OpenAI only by an authorized explicit extraction request when configured.

## Bounds, errors and verification

Queries are at most 300 characters; paths contain at most 12 unique IDs; abstracts at most 30,000 characters; request bodies at most 70,000 bytes; extraction outputs at most 50 draft claims. Graph reads paginate and fail beyond 10,000 rows per table rather than silently truncating. Upstream requests time out. Errors use `{ "error": { "code": "...", "message": "..." } }` with HTTP 400/401/403/405/413/415/429/503. Raw provider errors, source text and keys are not echoed.

```powershell
node --experimental-strip-types --test supabase/functions/tests/*.test.ts
node web/node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --lib ES2022,DOM supabase/functions/_shared/runtime.ts
```

The tests use real P1 fixtures, compare coverage with the unchanged Python helper, exercise the Auth/REST/Responses adapter with fixture responses, and verify quote/type rejection, role boundaries, citation scope, cache invalidation, RLS-scoped cache reuse, pagination, and failure cases. This local validation does not claim that Supabase Edge Runtime, Auth, PostgREST, a deployed browser journey or live OpenAI has run. With local Supabase installed separately, serve the functions using `supabase functions serve --env-file .env`; deployments remain deferred until a project/platform is chosen.
