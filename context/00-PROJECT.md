# PathNet: shared project context

Full plan with diagram: https://claude.ai/artifact/Ghkj87JNRAr7BPLdURdR6G (private to the owner; this file is the working copy).

## The challenge in five lines
- Build an **AI Atlas for the World's Rare Diseases**: a knowledge graph of diseases, genes, variants, mechanisms, symptoms, patient groups, papers, studies and assets.
- Organize by **mechanism and phenotype, not disease name**. One gene can sit in two clusters; different genes can share one.
- Every edge needs **source, relationship type, confidence and contradicting evidence** beside it.
- Three questions drive it: Who shares our disease characteristics? What useful work exists? What should we do together next?
- Judges score: graph quality, evidence integrity, patient progress, 10x impact, product craft. Track prizes need **OpenAI models or tools**.

## Personas
| Persona | Role value | Needs |
|---|---|---|
| Devon, newly diagnosed caregiver | `family` | Plain language, find the exact group or the closest related one |
| Maria, patient-group leader | `group_leader` | Closest disease clusters, reusable asset, partner, next step |
| Priya, biotech scout | `scout` | Ranked clusters for one mechanism, with groups and assets |
| Dr. Osei, researcher | `researcher` | Who else works on my mechanism, and how to reach them |
| Curator | `admin` | Approve contributed edges |

## MVP bar (all seven must pass on the deployed URL)
1. One search box resolves a disease, gene, symptom, group or mechanism to one node, synonyms included.
2. The map clusters by mechanism and phenotype and shows the same-gene, different-mechanism counterexample.
3. Clicking an edge shows source link, quote, type, tier, confidence and contradicting evidence.
4. The action view shows a reusable asset, a partner or group, and one concrete next step.
5. A search with no supported link ends in an honest "no supported route" screen.
6. Four personas plus admin see different home views, enforced by row-level security.
7. README covers architecture and reproducing the dataset. A 1-minute walkthrough and a team video exist.

## Evidence tiers
A curated database · B extracted from a source with a verbatim quote · C inferred by the graph (hypothesis) · D user-contributed, pending review. An LLM claim is stored only if its quote appears verbatim in the fetched text.

## Repo map and owners
| Folder | Owner | Notes |
|---|---|---|
| `data/seed`, `data/raw`, source scripts | P1 | the real slice and the evidence |
| `pipeline/extract.py`, `cluster.py`, prompts | P2 | OpenAI extraction, clustering, explanations |
| `web/` | P3 | the app |
| `supabase/`, `contract/`, `docker-compose.yml`, `scripts/`, README, video | P4 | schema, roles, deploy, story |

## Working agreements
- `main` always runs. Work on a branch named `p1/...`, `p2/...`, and merge small and often. Tag a known-good build at every gate (`git tag gate-m1`).
- Change `contract/contract.json` only through P4, after telling the team.
- Data shape lives in `contract/README.md`. If you need a new field, ask P4.
- Hand off sleep swaps with a five-line note in `context/HANDOFF.md` (create it): what works, what is half-done, what to do next, what is broken.
- Cut order if time slips: Neo4j mirror, live abstract extraction, voice, extra personas. Never cut: evidence panel, no-route state, RBAC, the one complete journey.

## Milestones (assumed Sat 20:30 to Sun 15:00 CEST)
M0 lock contract (1h) · M1 walking skeleton, real data in the DB (to ~01:00) · M2 intelligence layer (to ~05:00) · M3 patient journey, then feature freeze at 10:00 · M4 prove and record (to 13:00) · M5 submit with at least one hour margin.
Sleep: P1 and P3 01:00 to 05:00. P2 and P4 05:00 to 09:00.

## Run it
`bash run.sh up` then http://localhost:5173. `bash run.sh web` runs the app alone on the seed file. See README.md.

## Current integration status (2026-10-04)
P1 has delivered and locally integrated the current 58-node, 69-edge graph with 77 evidence records, four provisional clusters, 70 memberships and offline source replay. The shared Docker PostgreSQL/PostgREST/app now serves that snapshot with persistent storage; literal seed, database/REST comparisons, browser checks and root README reproduction are recorded in [P1 integration](P1-INTEGRATION.md). P4 backend role policies, contribution review, API boundaries and operator checks are retained; see [platform notes](P4-PLATFORM.md) and [task status](P4-TASK-STATUS.md). The frontend role selector remains presentation-only and no-route coverage requires P3 wiring. Supabase/Auth, Edge Runtime/cloud deployment, browser logins, persona/action/admin UI, voice, videos and deployed acceptance remain outstanding. P2 owns final model evaluation, calibrated scoring and algorithmic clustering; P1/P2 M4 peer review and funder projection acceptance remain separate. Concurrent M2 work is not certified by this M1 integration.


P1 M3 follow-up (2026-10-04): completed M2 maintenance and the source-checked administrative funding report are now included in this branch snapshot. The report joins four NIH/NINDS applications and four distinct core projects through existing graph IDs under the current funding policy. See [M3 execution](P1-M3-EXECUTION.md) and [publication scope](P1-M0-M3-PUBLICATION.md). Funding API/UI wiring, human P1/P2 M4 reciprocal review and the platform/product gates above remain separate.
