# P1: Data lead

Owner: ______________ · Sleeps 01:00 to 05:00 · Read `context/00-PROJECT.md` first.

## Mission
Turn public sources into a small, correct, well-sourced graph slice. The judges score evidence integrity, so a short graph you can defend beats a big one you cannot.

## You own
`data/seed/graph.json`, `data/raw/` (cache, not committed), source fetch scripts in `pipeline/` (add new `fetch_*.py` files; `fetch_pubmed.py` exists), the BrightData scrape, asset records, and verifying every edge on the demo path.

## Start in 5 minutes
```bash
cp .env.example .env            # add NCBI_EMAIL and BRIGHTDATA_API_KEY
cd pipeline && pip install -r requirements.txt
python fetch_pubmed.py "STXBP1 AND epilepsy" --max 50   # try it; files land in data/raw/pubmed/
```
Look at `data/seed/graph.json`. It is placeholder data (Gene A, Disease 1). Your job is to replace it with the real slice, same shape (see `contract/README.md`).

## Checklist
**M0 (Sat 20:30)**
- [ ] Pick the slice with P2. Default guess: STXBP1 and neighbours. Check coverage first: PubMed hit count, ClinicalTrials.gov studies, patient-group pages, HPO annotations. Pick a backup.
- [ ] Source inventory: URL, licence, how to fetch, for each source. Put it in `context/SOURCES.md`.
- [ ] Hand-write 10 to 15 real nodes and edges with real source URLs into `graph.json`. This is the insurance build.

**M1 (to 01:00)**
- [ ] Tier A edges from HPO annotations, MONDO, Orphadata, ClinVar for the slice genes. OMIM needs a licence: skip it.
- [ ] 100 to 200 PubMed abstracts cached for P2's extraction.
- [ ] ClinicalTrials.gov studies and NIH RePORTER records for the slice.
- [ ] BrightData scrape of patient-group pages (NORD, Global Genes, Orphanet, group sites).
- [ ] At least 15 real nodes loaded: `bash run.sh seed`, then check the app.

**M2 (01:00 to 05:00, asleep)** Leave scrapers running and `data/raw/` tidy. Write your handoff note before sleeping.

**M3 (05:00 to 10:00)**
- [ ] Grow to 40 to 60 nodes. Add asset records (registries, natural history studies, trials) with URLs.
- [ ] Add investigator and funder edges for the network-overlap view.
- [ ] Hand-verify every edge on the demo path. Set `status: "verified"`.

**M4 (10:00 to 13:00)**
- [ ] Swap with P2: fact-check each other's demo-path edges against the source pages.
- [ ] Write the data provenance section and the exact reproduce commands for the README.

## Rules
- Never invent a URL, quote, PMID or ontology id. Unknown means empty or `source_type: "placeholder"`.
- Prefer stable ids in `ext_ids` (MONDO, HGNC, HPO, PMID). Node `id` is a readable slug.
- Contact details: public, professional information only. Never private individuals.
- Respect each site's terms. Cache what you fetch; do not hammer.

## You produce / consume
Produce: `data/seed/graph.json` (P3 and P4 load it), raw caches (P2 reads `data/raw/pubmed`). Consume: slice decision from P2, schema from P4.

## Done means
`bash run.sh seed` loads without errors, the demo path edges have real sources and `verified` status, the README reproduce steps work from a clean checkout.

## Prompt to paste into Claude Code
"I am P1 (data) on PathNet. Read context/00-PROJECT.md and context/roles/P1-data.md. Help me write fetchers for ClinicalTrials.gov v2, NIH RePORTER and HPO annotations into data/raw, then convert them into graph.json edges with real source URLs. Do not invent any identifiers."
