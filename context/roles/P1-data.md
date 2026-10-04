# P1: Data lead

**Current additive release:** `p1/data_v2` contains 120 nodes, 135 edges and 162 evidence records with four unchanged provisional groups. The P1-only source/raw/replay review passed; see [data_v2 scope and reproduction](../P1-EXPANSION.md). Historical M0-M3 sections below describe the preserved 58-node baseline. P2/M4 human, product and shared-database gates remain separate.

Owner: ______________ · Sleeps 01:00 to 05:00 · Read `context/00-PROJECT.md` first.

Status updated: **2026-10-04 (Europe/Berlin)**. Checked boxes have recorded evidence. M1 is published on `p1/data`; The completed M2/M3 follow-ups are included in this branch snapshot. The 58-node graph is integrated into the shared checkout and running Docker database. See [milestone status](../P1-TASK-STATUS.md), [M3 execution](../P1-M3-EXECUTION.md) and [shared M1 integration record](../P1-INTEGRATION.md).

## Mission
Turn public sources into a small, correct, well-sourced graph slice. The judges score evidence integrity, so a short graph you can defend beats a big one you cannot.

## You own
`data/seed/graph.json`, `data/raw/` (the M1 snapshot was published at the user's request), P1 source scripts in `pipeline/`, the BrightData scrape, asset records, administrative funding sidecar and verification of every demo-path edge.

## Start in 5 minutes
```bash
cp .env.example .env            # add NCBI_EMAIL, BRIGHTDATA_API_KEY and BRIGHTDATA_UNLOCKER_ZONE
cd pipeline && pip install -r requirements.txt
python fetch_pubmed.py "STXBP1 AND epilepsy" --max 50   # try it; files land in data/raw/pubmed/
```
The real P1 slice is in `data/seed/graph.json`, using the same five-table shape (see `contract/README.md`). Current execution evidence and integration limits are recorded in `context/P1-TASK-STATUS.md`.

## Checklist
**M0 (Sat 20:30)**
- [x] Pick the slice with P2. STXBP1 with SCN2A/KCNQ2/SCN8A neighbours; SCN2A is the first backup. Coverage is recorded; P2 agreement was confirmed by the user on 2026-10-04.
- [x] Source inventory: URL, licence, how to fetch, for each source. See `context/SOURCES.md`.
- [x] Supply at least 10 to 15 real nodes and edges with real source URLs in `graph.json`. The reviewed seed exceeds this insurance-build threshold.

**M1 (to 01:00)**
- [x] Tier A input from HPO annotations, MONDO, Orphadata and ClinVar. Five ClinVar identities cover all four genes; provider-specific scope is documented. No direct OMIM retrieval.
- [x] 100 to 200 PubMed abstracts cached for P2's extraction: 159 nonempty pinned records.
- [x] ClinicalTrials.gov studies and NIH RePORTER records for the slice: 32 studies and 82 annual application records.
- [x] Bright Data scrape of patient-group/resource pages: eight live verified acquisitions. NORD local-only responses and Global Genes/Orphanet access restrictions are explicitly recorded.
- [x] Functional seed-and-app check: 58 real nodes loaded twice into native PostgreSQL 16.14/PostgREST 12.2.3; five-table SQL/REST comparisons and the database-backed browser checks passed.
- [x] Exact Docker entry point: `bash run.sh seed`, then check the app. The literal command and smoke check passed in the shared checkout; PostgreSQL 16.15/PostgREST 12.2.3, exact five-table reads and the database-backed browser were verified. See [shared M1 integration record](../P1-INTEGRATION.md).

**M2 (original schedule: 01:00 to 05:00, asleep; adapted to foreground execution)** The user waived nighttime/unattended execution on 2026-10-04 and requested immediate execution. Complete one source-maintenance pass, leave `data/raw/` tidy and write the handoff.

- [x] Foreground maintenance: `pipeline/run_m2.py` actually replayed all source families offline, rebuilt the graph, validated raw evidence and audited the cache. Four steps passed, with no candidate or release changes; see [M2 execution](../P1-M2-EXECUTION.md).
- [x] Organized source caches: 451 raw files, including 449 data/cache/receipt files, `.gitkeep` and the historical helper. Exact hashes, pinned 159/32/82-record membership and 421 references passed the read-only audit.
- [x] Five-line handoff: `context/HANDOFF.md` records M2 completion, outputs, interfaces and next owners.

M2 is complete within the user-approved foreground scope. Its original run was `2026-10-04T00:21:07Z` to `00:21:44Z`, without credentials/network requests; all four seed outputs stayed byte-identical. Historical M2 clean-export readiness ran 112 tests (111 passed, one skip). M3 adds optional funding maintenance: the actual five-step, 464-file pass and 125-test suite passed. This branch snapshot includes completed M0-M3 delivery. See [M3 execution](../P1-M3-EXECUTION.md) and [historical M2 publication scope](../P1-M2-PUBLICATION.md).

**M3 (05:00 to 10:00)**
- [x] Grow to 40 to 60 nodes and add assets with URLs: 58 nodes and nine assets, including STARR, DRAGONFLY, a biorepository, NIH resources and RARE-X.
- [x] Add investigator associations: nine `investigator_disease` edges across seven public investigators.
- [x] Complete funder associations through the existing contract's award-metadata projection. `funding_overlap.json` joins four FY2026 NIH/NINDS applications and four distinct core projects to existing assets/diseases/edges/evidence, with original hashes and funding locators. No graph enum, SQL or API change. See [funding interface](../P1-FUNDING-INTERFACE.md).
- [x] Source-check every demo-path relationship and set verified status. Source/context review is documented, all 69 edges are verified, and all 77 evidence rows pass raw-source checks. M4 role-owner peer acceptance remains separate.

**M4 (10:00 to 13:00)**
- [ ] Swap with P2: fact-check each other's demo-path edges against the source pages. A machine-assisted P2-perspective review of all 69 edges/77 evidence records is recorded, including ten detailed demo-edge contexts and one resolved wording correction. Human P2 and reciprocal P2-artifact review remain pending; see [review](../P1-M4-PEER-REVIEW.md).
- [x] Write the data provenance section and exact reproduce commands: `context/P1-DATA.md`, `context/P1-M1-EXECUTION.md` and the ready-to-paste `context/P1-README-SECTION.md`. Clean-source reproduction and native acceptance are recorded.
- [x] P4 integration acceptance: the shared root README now documents the 58-node M1 snapshot, live Bright Data acquisition and exact reproduction commands; rebuilding/auditing and database-backed app reads were verified in the integrated checkout. See [shared M1 integration record](../P1-INTEGRATION.md).

## Rules
- Never invent a URL, quote, PMID or ontology id. Unknown means empty or `source_type: "placeholder"`.
- Prefer stable ids in `ext_ids` (MONDO, HGNC, HPO, PMID). Node `id` is a readable slug.
- Contact details: public, professional information only. Never private individuals.
- Respect each site's terms. Cache what you fetch; do not hammer.

## You produce / consume
Produce: `data/seed/graph.json` (P3 and P4 load it), raw caches (P2 reads `data/raw/pubmed`). Consume: slice decision from P2, schema from P4.

## Done means
`bash run.sh seed` loads without errors, the demo path edges have real sources and `verified` status, the README reproduce steps work from a clean checkout.

Current P1 acceptance: M0-M3 delivery is complete, including source-checked administrative funding projection under the existing contract. Provenance/README and machine-assisted M4 review are recorded. Human P1/P2 M4 reciprocal acceptance remains open. Cloud/Auth/deployed-product gates remain with P4/P3; M0 approval is not M4 peer sign-off.

## Prompt to paste into Claude Code
"I am P1 (data) on PathNet. Read context/00-PROJECT.md and context/roles/P1-data.md. Help me write fetchers for ClinicalTrials.gov v2, NIH RePORTER and HPO annotations into data/raw, then convert them into graph.json edges with real source URLs. Do not invent any identifiers."
