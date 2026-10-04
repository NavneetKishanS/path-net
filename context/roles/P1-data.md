# P1: Data lead

Shared integration: this checkout contains the current 58-node M1 snapshot and serves it from the existing persistent Docker database. The accepted M1 snapshot and required platform dependencies are bundled in publication branch `p1/data`; historical local acceptance is recorded in [P1-INTEGRATION.md](../P1-INTEGRATION.md).

Owner: ______________ · Sleeps 01:00 to 05:00 · Read `context/00-PROJECT.md` first.

Status updated: **2026-10-04 (Europe/Berlin)**. Checked boxes have recorded evidence. This `p1/data` publication bundles the pinned 58-node snapshot that was accepted in the shared `p4/platform` checkout and persistent Docker database. [Publication scope](../P1-PUBLICATION.md) separates the bundled M1 work from external M2 completion. See [milestone status](../P1-TASK-STATUS.md), [native M1 history](../P1-M1-EXECUTION.md) and [shared M1 integration record](../P1-INTEGRATION.md).

## Mission
Turn public sources into a small, correct, well-sourced graph slice. The judges score evidence integrity, so a short graph you can defend beats a big one you cannot.

## You own
`data/seed/graph.json`, `data/raw/` (the reviewed M1 refresh is bundled in publication branch `p1/data`), source fetch scripts in `pipeline/` (add new `fetch_*.py` files; `fetch_pubmed.py` exists), the BrightData scrape, asset records, and verifying every edge on the demo path.

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

**M2 (original schedule: 01:00 to 05:00; separate foreground source-worktree scope)** The user waived nighttime/unattended execution on 2026-10-04. The separate P1 source delivery reports completed replay/build/raw validation/cache audit and a five-line handoff. Its runner, tests and execution receipts are not bundled or certified by this M1 publication. The source snapshot remains organized here, and this branch's [handoff](../HANDOFF.md) describes M1 integration and remaining owners. No M2 background scraper or schedule is configured by this publication.

**M3 (05:00 to 10:00)**
- [x] Grow to 40 to 60 nodes and add assets with URLs: 58 nodes and nine assets, including STARR, DRAGONFLY, a biorepository, NIH resources and RARE-X.
- [x] Add investigator associations: nine `investigator_disease` edges across seven public investigators.
- [ ] Complete the funder association portion of the original investigator/funder task. Four award assets retain actual `props.funder` metadata; a traversable funder relation or approved projection still requires P4 agreement.
- [x] Source-check every demo-path relationship and set verified status. Source/context review is documented, all 69 edges are verified, and all 77 evidence rows pass raw-source checks. M4 role-owner peer acceptance remains separate.

**M4 (10:00 to 13:00)**
- [ ] Swap with P2: fact-check each other's demo-path edges against the source pages.
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

Current acceptance: sourced/verified demo edges, credential-free reproduction, native acceptance, the literal Docker seed/app check and current root README integration are recorded. Approved funder representation, P1/P2 M4 peer review and cloud/Auth/deployed-product acceptance remain open. M0 approval is not M4 peer sign-off; The separate source-worktree M2 completion is outside this publication and is not certified here.

## Prompt to paste into Claude Code
"I am P1 (data) on PathNet. Read context/00-PROJECT.md and context/roles/P1-data.md. Help me write fetchers for ClinicalTrials.gov v2, NIH RePORTER and HPO annotations into data/raw, then convert them into graph.json edges with real source URLs. Do not invent any identifiers."
