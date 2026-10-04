# P4 task status by milestone

Status date: 2026-10-04 (Europe/Berlin). Scope agreed by the user: **complete local implementation and validation first; no Supabase project or deployment platform is configured**. Reviewed against [P4's role checklist](roles/P4-platform-story.md) and the local `task_docu/PathNet Blueprint.md`. This document does not certify the original overnight schedule or the full product MVP.

## Delivered locally

- Migration `0002_roles_rls.sql`: stored role assignments, organization membership, verified-graph visibility, restricted professional contacts, contribution visibility and transactional admin review.
- Additive Edge Functions and typed API contracts for path explanation, no-route coverage and abstract-extraction drafts; P1's five-table graph and enums remain intact. P3 client implementation is still required.
- Operator workflow for migration checksums, graph upsert, cache loading, future demo identity provisioning and real-session smoke checks. Docker startup through the migration/upsert path was verified locally after the Windows restart on 2026-10-04.
- Root README integrates P1 provenance, source attribution, exact offline reproduction and a Mermaid architecture diagram.
- A one-minute recording plan uses the actual STXBP1/STARR path, SCN2A functional counterexample and unknown-query fixture. No tier C bridge, measured 10× effect or recorded video is invented.

## Milestone acceptance

| Stage | Local result | Remaining gate |
| --- | --- | --- |
| M0 — foundation | Schema/roles and preserved shared contract; demo provisioning command prepared | Create selected Supabase project, run migrations there, provision and verify actual accounts; team contract acceptance, repo access/branch rules/task board remain unrecorded |
| M1 — walking skeleton | Docker/PostgREST startup and exact P1 graph reads passed; web serves REST mode; cited fallback and README/demo draft ready | Execute cloud seed path, deploy preview, complete deployed browser journey and tag only when requested |
| M2 — intelligence platform | Role policies, contribution/review RPCs, extraction-draft and no-route interfaces supplied; isolated checks available | Run functions in Supabase/Deno with real sessions; P2 review/merge/evaluation; P3 UI wiring |
| M3 — complete journey | Backend boundaries for all roles and admin review | Contribution/admin UI, Auth sessions, persona homes, production deployment and five-login end-to-end test |
| M4 — proof and story | README and fixture-grounded one-minute script delivered | Final P1/P2 peer acceptance; deployed path twice in a clean browser; walkthrough, voiceover, team and backup videos |
| M5 — submission | Submission requirements recorded | Deployed URL, videos, judge access and submission confirmation |

## Verification evidence

Earlier P4 root integration results, before the 58-node M1 refresh (historical 54-node run):

| Check | Result |
| --- | --- |
| P1 pipeline regression | 64 tests passed |
| Source replay integrity | 76 evidence records passed raw-source audit; 159 pinned PubMed records verified |
| Role and legacy loader checks | 168 assertions passed in isolated PostgreSQL/WASM, including exact seed equality after three legacy loads |
| Operator database integration | Legacy upgrade and repeated migration passed; upsert preserved approved contributions, audit and roles; applied-file checksum drift was rejected |
| Operator unit tests | 5 passed |
| Endpoint behavior / types | 21 fixture-based endpoint/core tests passed; strict TypeScript check passed |
| Offline caches | 20 role-scoped explanations and one coverage snapshot built and imported into the isolated test database |
| Reproduction command | `bash run.sh data` passed with no data changes |
| Frontend production build | Passed |
| Docker startup after Windows restart (2026-10-04) | Docker Desktop 4.93.0, Linux Engine 29.8.1; database healthy, seed exited 0, API and web running |
| Live PostgREST graph | 54 nodes, 68 edges, 76 evidence rows, 4 clusters and 69 node-cluster memberships; every row matched the seed |
| Live caches and anonymous access | Imported 20 explanation rows and one coverage snapshot; anonymous reads returned only the 4 family explanations; professional_contacts, contributions and user_roles each returned HTTP 401 |
| Local web and browser | HTTP 200 and CORS checks passed; browser displayed `data: rest` and graph node details; browser error log was empty |

Endpoint tests use real P1 data with fixture Auth/REST/model responses. The live Compose stack runs PostgreSQL, PostgREST and the web app, with a completed one-shot seed service; Supabase Auth and the Edge runtime are not running. Docker checks establish local graph serving and anonymous access boundaries. Five-role real sign-in, contribution/admin-review end-to-end acceptance, cloud deployment, live model calls and a completed deployed browser journey remain outstanding.

## Current M1 integration — 2026-10-04

The shared 58-node M1 source/data refresh and root README reproduction are now integrated locally. `bash run.sh seed` passed against the existing PostgreSQL 16.15 Docker database using the migration/upsert operator, and the db/api/web services remain running with `restart: unless-stopped` while Docker is available. The existing `pathnet_pgdata` volume persists data; no volume reset was needed.

Current verification and machine-readable evidence are in [P1-INTEGRATION.md](P1-INTEGRATION.md) and [m1-docker-integration.json](../data/acceptance/m1-docker-integration.json). The pinned graph remains 58 nodes, 69 edges, 77 evidence rows, four clusters and 70 memberships. The integrated P1 suite passed 99 tests. The earlier 64-test/54-node table above remains historical evidence; it is not the current dataset. Original native M1/credential-blocked checks retain their separate 86-test receipt. Concurrent M2 work is not certified as completed by this integration.

Local graph/REST/browser acceptance does not provision real Supabase Auth, run the Edge Runtime, wire P3 persona/admin UI, establish P2 model/clinical acceptance, complete P1/P2 peer review or deploy the product. Those gates and the M3 funder projection decision remain outstanding.

## Interface decisions and remaining owners

The graph retains `name`, stable string IDs, nullable confidence and `{nodes, edges, evidence, clusters, node_cluster}`. Coverage and provenance stay sidecars. NIH funders remain in award assets' `props.funder` and existing `asset_disease` links; no new funder relation is approved by this work.

P2 must own the final model prompts, extraction evaluation, calibrated scoring, inferred bridges and clustering. The P1 release's four reviewed groups remain provisional; its 69 verified edges do not imply measured probabilities or treatment equivalence.

P3 must connect actual Auth sessions, persona/action screens, API explanations/coverage, contribution form and admin queue. The current role selector is presentation only, and its no-route panel has not yet been replaced by the new platform response. Public investigator names remain graph metadata; restricted professional contacts require the protected view and an allowed role.

P4 must finish real Supabase/runtime and deployed-browser checks once configuration is available, then record and submit the requested media. Neither login credentials nor service keys are supplied in this repository. The historical P4 local task did not publish or deploy the product. The M1 snapshot and required platform dependencies are bundled in the separately user-authorized `p1/data` publication; see [P1-PUBLICATION.md](P1-PUBLICATION.md). Cloud deployment and submission remain outstanding.
