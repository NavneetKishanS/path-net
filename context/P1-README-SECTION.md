<!-- Ready-to-paste data section for P4. README.md remains under P4 ownership. -->

M2 maintenance update (2026-10-04): `python pipeline/run_m2.py` performs one offline source replay, rebuild and audit in isolated staging, preserving the released files and any later P2 work. The executed P1 run passed with no byte changes; 108 tests ran (107 passed, one Windows symlink-permission skip). See [M2 execution and repeat commands](context/P1-M2-EXECUTION.md). The helpers and receipts are now synchronized locally; current M3 acceptance ran 125 tests and five maintenance steps. Historical M2 receipts remain unchanged.

Publication boundary: M1 is published on `p1/data` at `0e1a04d`; the reviewed publication base is `3b38ca0`. The completed M2/M3 follow-ups are included in this publication. Historical M2 clean exports and the current M3 125-test/five-step verification are recorded separately.

## Dataset and evidence

The local P1 M1 snapshot, updated on 2026-10-04 (Europe/Berlin), covers STXBP1 and neighbouring SCN2A, KCNQ2 and SCN8A records. It contains **58 nodes, 69 edges, 77 evidence rows and 4 provisional mechanism clusters**. The unchanged graph interface is `{nodes, edges, evidence, clusters, node_cluster}`; additional audit metadata lives in `data/seed/provenance.json`.

The current bundled local `data/raw/` snapshot has **451 files**, comprising **449 data files**, `.gitkeep` and the `curate_community.py` helper, totalling **50,866,487 bytes**. The integrated local working tree supports offline source auditing. Retrieval timestamps are UTC; M1's late October 3 requests were recorded on October 4 locally. NORD full-page responses are local audit material outside the repository, because of the publisher's reproduction restriction.

Every edge has evidence: 49 tier A database associations and 20 tier B source-backed claims. `verified` means checked against the cited source within the claim's scope. All confidence values are `null` because no calibrated probabilities were measured. Five ClinVar identities cover all four genes; the three new identity-only examples have unknown functional effect. SCN2A's separately cited assays illustrate why variants in one gene can belong to different functional groups.

Sources include HGNC, Mondo, HPO, Orphadata, ClinVar, PubMed, ClinicalTrials.gov, NIH RePORTER and three patient organisations. The bundled extraction corpus contains 159 nonempty PubMed abstracts; raw caches also contain 32 studies and 82 annual NIH award records. Searches and graph selections are deliberately bounded. See [source inventory, licences and limitations](context/SOURCES.md).

This service uses the **Human Phenotype Ontology project, version 2026-09-01**, with **HPO annotation release 2026-09-02**. We acknowledge the Human Phenotype Ontology Consortium and retain its [licence conditions](https://human-phenotype-ontology.github.io/license.html). Mondo is credited to the Monarch Initiative under CC BY 4.0; Orphadata to Orphanet / INSERM under CC BY 4.0; HGNC provides CC0 nomenclature data. NCBI/NLM resources are used under their [disclaimer and copyright policies](https://www.ncbi.nlm.nih.gov/home/about/policies/); some abstracts retain author or publisher copyright. Full abstracts and original public page bodies are bundled for source audit; the graph retains short attributable excerpts. Bundling does not change each source's copyright, licence or terms, and no blanket open licence is assigned to these materials. OMIM was not queried directly.

## Reproduce the reviewed baseline

Run from the repository root with Python 3.10 or later. Create and activate an environment, then install the pipeline dependencies:

```bash
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
python -m pip install -r pipeline/requirements.txt
```

On Windows PowerShell, replace the activation command with:

```powershell
.\.venv\Scripts\Activate.ps1
```

Rebuild the graph from the bundled local compact curation snapshots and validate its contract and provenance:

```bash
python pipeline/build_graph.py
python pipeline/validate_graph.py
python -m unittest discover -s pipeline/tests -p 'test_*.py'
```

The graph build and validation require no network, API keys, model calls or running database. Expected baseline counts are 58 nodes, 69 edges, 77 evidence rows, 4 clusters and 70 memberships. Rebuilding replaces the P1 baseline; preserve any subsequent P2 merges before running it against an integrated dataset.

Current source responses are bundled under `data/raw/` in the local working tree. Run the stronger source audit and pinned PubMed check offline against that snapshot:

```bash
python pipeline/validate_graph.py --check-raw
python pipeline/restore_pubmed.py --check
```

These checks verify original raw-file hashes, quoted content and the pinned abstract corpus as well as the graph. The integrated local snapshot needs no source download for these checks. This branch contains the published M1 caches and the completed M2/M3 follow-ups. Re-fetching a changing source is a new snapshot and may require renewed curation; it is not guaranteed to reproduce the original response hashes. Existing fetchers retain query metadata, respect provider pacing and reuse cached results. P2's article input directory contains only its agreed six-field JSON records; metadata remains separate.

The four clusters are reviewed P1 starting groups; P2 owns learned extraction, evaluation, scoring and algorithmic clustering. Recruitment statuses are dated observations: CAP-002 and NBI-921352 were terminated, and the KCNQ2 phenotype study had unknown status. A registry or grant link does not establish treatment efficacy, eligibility or permission to reuse participant data. Eight public pages were verified through live Bright Data requests. Original native PostgreSQL/PostgREST acceptance is retained in [P1-M1-EXECUTION.md](context/P1-M1-EXECUTION.md). The shared Docker database now serves the 58-node snapshot continuously, using the persistent `pathnet_pgdata` volume and `restart: unless-stopped` for db/api/web while Docker is available. The literal seed command, live rows, REST reads and database-backed browser were verified; current evidence is in [P1-INTEGRATION.md](context/P1-INTEGRATION.md). Supabase Auth, cloud deployment and deployed-app acceptance remain separate gates.


## M3 administrative funding report

`python pipeline/build_funding_projection.py` writes `data/seed/funding_overlap.json`: one recorded FY2026 NIH/NINDS group, four memberships, four applications and four distinct core projects. Each member joins existing asset/disease/edge/evidence IDs to source hashes and funding-array locators. Shared funding is an administrative association, not evidence of biological or treatment equivalence. This sidecar leaves the five-table graph unchanged; see [funding interface](context/P1-FUNDING-INTERFACE.md). Maintenance rebuilds/audits the report in an optional fifth step. Current M3 verification: 125 tests, 124 passed and one Windows permission skip; all 464 snapshot files unchanged during maintenance. Human reciprocal P1/P2 M4 acceptance remains pending.
