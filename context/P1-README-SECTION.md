<!-- Ready-to-paste data section for P4. README.md remains under P4 ownership. -->

## Dataset and evidence

The 2026-10-03 P1 release covers STXBP1 and neighbouring SCN2A, KCNQ2 and SCN8A records. It contains **54 nodes, 68 edges, 76 evidence rows and 4 provisional mechanism clusters**. The unchanged graph interface is `{nodes, edges, evidence, clusters, node_cluster}`; additional audit metadata lives in `data/seed/provenance.json`.

The **2026-10-04 packaging update** includes the original tracked `data/raw/` snapshot: **425 files**, comprising **423 data files**, `.gitkeep` and the `curate_community.py` helper, totalling **50,321,976 bytes**. A fresh checkout supports offline source auditing; source retrieval dates remain 2026-10-03.

Every edge has evidence: 49 tier A database associations and 19 tier B source-backed claims. `verified` means checked against the cited source within the claim's scope. All confidence values are `null` because no calibrated probabilities were measured. SCN2A illustrates why variants in one gene can belong to different functional groups; assay context and evidence that limits a simple gain/loss classification remain visible.

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

Rebuild the graph from the committed compact curation snapshots and validate its contract and provenance:

```bash
python pipeline/build_graph.py
python pipeline/validate_graph.py
python -m unittest discover -s pipeline/tests -p 'test_*.py'
```

The graph build and validation require no network, API keys, model calls or running database. Expected baseline counts are 54 nodes, 68 edges, 76 evidence rows, 4 clusters and 69 memberships. Rebuilding replaces the P1 baseline; preserve any subsequent P2 merges before running it against an integrated dataset.

Original source responses are included under the tracked `data/raw/`. From a fresh checkout, run the stronger source audit and pinned PubMed check offline:

```bash
python pipeline/validate_graph.py --check-raw
python pipeline/restore_pubmed.py --check
```

These checks verify original raw-file hashes, quoted content and the pinned abstract corpus as well as the graph. A fresh checkout includes the original raw snapshot and needs no source download for these checks. Re-fetching a changing source is a new snapshot and may require renewed curation; it is not guaranteed to reproduce the original response hashes. Existing fetchers retain query metadata, respect provider pacing and reuse cached results. P2's article input directory contains only its agreed six-field JSON records; metadata remains separate.

The four clusters are reviewed P1 starting groups; P2 owns learned extraction, evaluation, scoring and algorithmic clustering. Recruitment statuses are dated observations: the selected CAP-002 and NBI-921352 studies were terminated, and the KCNQ2 phenotype study had unknown status. A registry or grant link does not establish treatment efficacy, eligibility or permission to reuse participant data. Direct patient-group retrieval was exercised; the optional Bright Data backend was not tested live. Full Docker deployment and deployed-app acceptance remain integration checks for P3/P4.
