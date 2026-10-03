# P1 source inventory and provenance

Release and retrieval date: **2026-10-03 (UTC)**. Scope: STXBP1, with SCN2A, KCNQ2 and SCN8A as a deliberately selected neighbourhood. SCN2A is the mechanism counterexample; KCNQ2 and SCN8A provide additional public data coverage. This is a discovery prototype, not a complete rare-disease catalogue.

Packaging update: **2026-10-04**. The original `data/raw/` snapshot is now bundled and tracked: **425 files** (**423 data files**, `.gitkeep` and `curate_community.py`), **50,321,976 bytes**. The source dates and record versions below are unchanged. Bundling preserves the original source material for audit; it does not grant a blanket open-content licence or replace each source's copyright and terms.

Temporary signed redirect query parameters and fragments were removed from metadata for publication. The stable `source_url` and original response bytes and hashes are retained.

The delivered `data/seed/graph.json` contains **54 nodes, 68 edges, 76 evidence rows, 4 provisional clusters and 69 memberships**. There are 49 tier A and 19 tier B edges, 67 supporting and 1 contradicting edge. Every edge has evidence. All 68 edges have `status: "verified"` and `confidence: null`.

Here, **verified** means that the identifier, relation and quoted text or structured field were checked against the cited source within the edge's stated scope. It does not mean independent experimental replication, medical certainty, treatment efficacy, current recruitment or individual eligibility. No calibrated confidence score has been measured. P2 owns subsequent scoring, extraction evaluation and algorithmic clustering.

## Inventory

All rows below were retrieved on 2026-10-03. Original raw responses are included in the tracked `data/raw/` snapshot; compact reviewed records, source links and provenance are retained in `data/curation/` and `data/seed/provenance.json`.

| Source and access | Exact release or record version | Licence / terms and use in this slice |
| --- | --- | --- |
| [HGNC REST](https://rest.genenames.org/fetch/symbol/STXBP1), `fetch_ontologies.py` | STXBP1 and SCN2A record modification dates: `2025-04-24T00:00:00Z`; KCNQ2 and SCN8A: `2023-01-20T00:00:00Z` | [CC0](https://www.genenames.org/about/license/). Approved symbols, aliases and HGNC/NCBI Gene/Ensembl identifiers. These are record dates, not a claimed bulk release date. |
| [Mondo via EBI OLS](https://www.ebi.ac.uk/ols4/api/ontologies/mondo), `fetch_ontologies.py` | `2026-09-01` | [CC BY 4.0](https://github.com/monarch-initiative/mondo/blob/master/LICENSE), Monarch Initiative. Five active disease terms; only explicitly equivalent cross-references join external annotations. |
| [HPO via EBI OLS](https://www.ebi.ac.uk/ols4/api/ontologies/hp) and [phenotype.hpoa](https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa), `fetch_ontologies.py` | HPO `2026-09-01`; annotation release `2026-09-02` | [HPO licence](https://human-phenotype-ontology.github.io/license.html), with attribution, version and integrity requirements; [project licence file](https://github.com/obophenotype/human-phenotype-ontology/blob/master/LICENSE.md). Twelve selected terms and 32 annotation rows. Six duplicate semantic pairs are merged while preserving their separate evidence. |
| [Orphadata API](https://api.orphadata.com/openapi.json), `fetch_ontologies.py` | Associated-gene records: `2026-06-23 07:57:31`; phenotype records: `2026-06-23 07:57:18` | API responses declare CC BY 4.0. Credit Orphanet / INSERM. ORPHA `599373` (STXBP1) and `439218` (KCNQ2); assessed causal gene associations are checked against HGNC. Complete phenotype responses are retained for audit. |
| [ClinVar ESummary](https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=196039,194555&retmode=json), `fetch_ontologies.py` | `VCV000196039.26` and `VCV000194555.34` | [ClinVar data-use policy](https://www.ncbi.nlm.nih.gov/clinvar/docs/maintenance_use/). Attribute ClinVar and preserve submission provenance. Variant identity and clinical classification do not establish functional direction; separate assay evidence supplies that. |
| [PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/), `fetch_pubmed.py` | Dated search snapshot, publication cutoff `2026/10/03`; query manifests, PMIDs and original XML retained | [NCBI policies](https://www.ncbi.nlm.nih.gov/home/about/policies/). Abstracts and book chapters can retain author/publisher copyright; no blanket open licence is assigned. Full abstracts and original XML are bundled in the raw snapshot for audit; the graph uses short attributable quotations. |
| [ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api), `fetch_clinicaltrials.py` | Live registry snapshot on `2026-10-03`; full records retain their own update dates | Public registry data under the site's [terms and conditions](https://clinicaltrials.gov/about-site/terms-conditions). Link and attribute each record; no independent open-content licence is asserted here. Registration is not evidence of benefit. |
| [NIH RePORTER API v2](https://api.reporter.nih.gov/), `fetch_reporter.py` | Snapshot on `2026-10-03`; all-fiscal-year searches; six selected evidence records are FY 2026 | Public award records through the documented API; retain RePORTER attribution and official project URLs. The API recommends at most one request per second. An application ID identifies an annual award, not necessarily an independent project. |
| Public patient-group and registry pages below, `fetch_groups.py` | Page snapshots from `2026-10-03`; individual body/text hashes and retrieval times retained | Copyright remains with each organisation; no blanket open licence was verified. The graph uses short attributed excerpts and public resource descriptions; original page bodies and normalized text are bundled for source audit. Direct HTTPS retrieval checked robots policies; private registry contents were not accessed. |

**HPO acknowledgement:** This service uses the Human Phenotype Ontology project, ontology version **2026-09-01**, with HPO annotation release **2026-09-02**. We acknowledge the Human Phenotype Ontology Consortium. See the [HPO project](https://human-phenotype-ontology.github.io/) and [licence conditions](https://human-phenotype-ontology.github.io/license.html). P3/P4 should retain a visible acknowledgement and version information in the delivered service.

OMIM was not fetched directly. OMIM codes already present in public MONDO, HPO and ClinVar records are retained as identifiers and source references; the project does not claim an OMIM licence.

## Community and mechanism sources

| Organisation / resource | Reviewed source pages | Scope |
| --- | --- | --- |
| STXBP1 Foundation | [Foundation](https://www.stxbp1disorders.org/), [STARR](https://www.stxbp1disorders.org/starr) | Patient-group remit and natural-history resource. STARR is an observational study, not a drug-efficacy trial. |
| FamilieSCN2A / NORD | [Foundation](https://www.scn2a.org/), [DRAGONFLY registry](https://scn2a.iamrare.org/) | Public group and registry landing pages. Patient data are not downloaded or represented. |
| KCNQ2 Cure Alliance | [Our role](https://www.kcnq2cure.org/our-role/), [FAQ](https://www.kcnq2cure.org/faq/), [biorepository](https://www.kcnq2cure.org/2026/02/25/kcnq2-biorepository/) | Group, natural-history and biorepository descriptions. Availability and reuse require contacting the resource owner. |

Mechanism evidence comes from PubMed records [29538625](https://pubmed.ncbi.nlm.nih.gov/29538625/), [32073399](https://pubmed.ncbi.nlm.nih.gov/32073399/), [38651838](https://pubmed.ncbi.nlm.nih.gov/38651838/), [41642117](https://pubmed.ncbi.nlm.nih.gov/41642117/), [24318194](https://pubmed.ncbi.nlm.nih.gov/24318194/), [34431999](https://pubmed.ncbi.nlm.nih.gov/34431999/), [37578743](https://pubmed.ncbi.nlm.nih.gov/37578743/) and [31558572](https://pubmed.ncbi.nlm.nih.gov/31558572/). Publication-specific attribution is retained in `community.json`. Quotes are matched against the target abstract extracted from original EFetch XML; whitespace is normalised, while punctuation and case are preserved. Evidence from cellular or animal assays keeps its model context.

The Bright Data Web Unlocker backend is implemented and opt-in. This release used direct retrieval; a live Bright Data run was **not** performed. NORD's DRAGONFLY landing page and Orphadata were used, but broad NORD disease-page and Global Genes crawling was not performed.

## Search coverage and selection

Counts below describe the saved searches, not prevalence or exhaustive gene-specific coverage. Broad gene searches can match incidental mentions. Only separately reviewed records enter the graph.

| Gene | PubMed total / retrieved | ClinicalTrials total / retrieved | RePORTER total / retrieved |
| --- | ---: | ---: | ---: |
| STXBP1 | 599 / 100 | 12 / 12 | 64 / 30 |
| SCN2A | 1,005 / 20 | 11 / 11 | 292 / 20 |
| KCNQ2 | 1,189 / 20 | 9 / 9 | 169 / 20 |
| SCN8A | 729 / 20 | 6 / 6 | 303 / 20 |

PubMed searches use `GENE AND hasabstract`, relevance ordering and the publication cutoff above. Supplementary PMID lookups provide the mechanism sources. After deduplication, **159 nonempty abstracts**, including PubMed-indexed book chapters, are cached. An initially supplied candidate, PMID `36301686`, proved unrelated to the slice and was excluded; the original query response records the correction.

ClinicalTrials searches use `query.term=GENE`; the four query result sets contain **32 unique studies**. RePORTER searches use `advanced_text_search` across all fields and all fiscal years, capped at 30 STXBP1 and 20 per neighbour, yielding **82 unique application IDs**. All RePORTER searches and all broad PubMed searches are truncated; the ClinicalTrials query result sets were fully fetched at this snapshot date. This does not establish completeness beyond those query formulations.

The graph selects five studies and four award assets. Two additional grants establish source-supported investigator overlap: Ingo Helbig's RePORTER records `11301017` and `11310175` explicitly describe work across STXBP1/SCN2A and STXBP1/SCN8A. Shared investigator expertise does not establish shared therapeutic response.

At retrieval, STARR `NCT06555965` was `RECRUITING`; PRAX-222 `NCT05737784` was `ACTIVE_NOT_RECRUITING`; KCNQ2 `NCT05157737` was `UNKNOWN`; SCN8A `NCT04873869` and CAP-002 `NCT06983158` were `TERMINATED`. These are dated registry statuses, not current enrollment recommendations.

## Audit and consumer boundaries

`graph.json` retains exactly the five contract tables: `nodes`, `edges`, `evidence`, `clusters`, `node_cluster`. Hashes, raw paths, source versions, field/line locators and curation provenance are kept in `provenance.json`. P2 receives only six-field article JSON files in `data/raw/pubmed/`: `pmid`, `title`, `abstract`, `authors`, `url`, `retrieved_at`. Search metadata is stored elsewhere.

`python pipeline/build_graph.py` and `python pipeline/validate_graph.py` rebuild and validate the committed reviewed baseline without network or database access. A fresh checkout also includes the original caches, so `python pipeline/validate_graph.py --check-raw` verifies hashes and quoted content offline, and `python pipeline/restore_pubmed.py --check` verifies the pinned abstract corpus offline. Live refreshes may change records and hashes; they require renewed curation before replacing this release. Source-level commands, cache paths and flags are documented in the fetcher docstrings.

The four clusters are provisional source-reviewed P1 groupings. SCN2A functional subgroups are explicitly curated; they are not invented ontology terms. No tier C hypotheses or calibrated scores are included. This delivery does not claim completed P2 extraction evaluation, independent clinical review, full Docker deployment or deployed-app acceptance testing.
