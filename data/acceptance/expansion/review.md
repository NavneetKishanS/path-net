# Expansion review and human peer acceptance

Review date: 2026-10-04 (Europe/Berlin). Reviewer: the current task assistant. This is an assisted review, not an independent human scientific assessment or acceptance by the P1/P2 role owners.

**Current P1 publication decision: passed.** Source-field checks were rerun against the final graph. The single-participant study wording was clarified within P1 fields. Historical browser findings and human M4 review remain separate owner gates; see [current P1 receipt](../p1-data-v2/verification.json).

The source and browser sections below record the earlier assisted review. The subsequent P1-only publication pass changed only new study descriptions and P1 delivery/reproduction artifacts. All original graph rows, raw sources, architecture and P2/P3/P4 implementations are preserved. The user authorized publication to p1/data_v2; shared database loading and merging remain separate operations.

Bound graph.json file SHA-256: `1dee1870b96dbaed1e32fa2cf55510661e4f6d5f2aa27966e9b3d5f8ae86ce4b`. Later data changes require updated review bindings and relevant checks.

## Completed source review

| Scope | Result and boundary |
| --- | --- |
| 62 new nodes, 66 new relationships, 85 new evidence rows | 853 identity, field, locator, date, raw-hash and preservation comparisons; zero errors. See [source-review.json](source-review.json). |
| 15 clinical records / 17 disease links | Titles/conditions explicitly support gene relevance; status and update fields match dated caches. Registration and gene relevance do not establish efficacy, functional direction or individual eligibility. |
| 7 NIH core projects / 8 PI links | Application IDs, core projects, fiscal years, funding fields and PI profiles match. Full abstracts were reviewed for mouse, iPSC/organoid and proposed-work scope. The graph has 11 distinct core projects; annual records or multiple PIs must not be counted as independent projects. |
| 53 Orphadata associations | Exact ORPHA 599373/STXBP1-DEE and 439218/KCNQ2-DEE mappings, HPO IDs, labels, original frequency strings and locators match. Disease-level frequency is not individual risk. See [phenotype-review.md](phenotype-review.md). |
| 10 original demo edges / 11 evidence rows | Complete original rows and source bindings are retained; original raw hashes were checked. Foundation, STARR, variant effects, contradiction and investigator-overlap scope follow the existing detailed [P1 M4 review](../../../context/P1-M4-PEER-REVIEW.md). This pass did not reread every original mechanism paper or reproduce experiments. |
| Live primary-source spot checks | Three official pages were opened read-only: a single-participant study, a terminated study and a mouse-model NIH project/PI record. See [live-source-checks.json](live-source-checks.json). Candidate caches and retrieval dates were not refreshed. |

All 451 original raw files and all original five-table records remain unchanged. Confidence remains null throughout; contradicting evidence was not converted to positive support. Orphadata record date is 2026-06-23 07:57:18 and retrieval date is 2026-10-03. This review did not certify the latest HPO release or validate each annotation against its underlying clinical paper.

## Clinical context review

Statuses below are the values cached on 2026-10-03, not comprehensive live recruitment certification.

| Official record | Genes | Cached status | Reviewed scope |
| --- | --- | --- | --- |
| [NCT01238250](https://clinicaltrials.gov/study/NCT01238250) | STXBP1, SCN2A | `RECRUITING` | Multi-gene observational registry; the conditions explicitly include STXBP1 and SCN2A. This is not a DEE-only treatment trial. |
| [NCT03934268](https://clinicaltrials.gov/study/NCT03934268) | KCNQ2 | `UNKNOWN` | Neonatal KCNQ2 cohort; UNKNOWN must not be interpreted as recruiting. |
| [NCT04639310](https://clinicaltrials.gov/study/NCT04639310) | KCNQ2 | `TERMINATED` | Randomized KCNQ2-DEE treatment study; cached status TERMINATED. No inference about termination reasons or efficacy. |
| [NCT04912856](https://clinicaltrials.gov/study/NCT04912856) | KCNQ2 | `TERMINATED` | Extension for previous XEN496 study participants; TERMINATED, not a new enrollment opportunity. |
| [NCT04937062](https://clinicaltrials.gov/study/NCT04937062) | STXBP1 | `ACTIVE_NOT_RECRUITING` | Monogenic DEEs including STXBP1/SLC6A1; planned safety and tolerability assessment, not established efficacy. |
| [NCT05161494](https://clinicaltrials.gov/study/NCT05161494) | STXBP1 | `COMPLETED` | Gait-analysis feasibility pilot including STXBP1 and tuberous sclerosis; COMPLETED. |
| [NCT05226780](https://clinicaltrials.gov/study/NCT05226780) | SCN8A | `TERMINATED` | SCN8A-DEE extension assessing safety and tolerability; TERMINATED. |
| [NCT05232630](https://clinicaltrials.gov/study/NCT05232630) | STXBP1 | `COMPLETED` | Non-controlled pilot across several DEEs, explicitly including STXBP1; COMPLETED does not establish treatment efficacy. |
| [NCT05407727](https://clinicaltrials.gov/study/NCT05407727) | SCN2A | `COMPLETED` | Observational disease-burden study in early-onset SCN2A-DEE. Discovery link to the broad parent condition does not generalize eligibility to all subtypes. |
| [NCT05462054](https://clinicaltrials.gov/study/NCT05462054) | STXBP1 | `WITHDRAWN` | Non-interventional STXBP1 natural-history study; WITHDRAWN with zero actual enrollment, not a completed cohort. |
| [NCT05818553](https://clinicaltrials.gov/study/NCT05818553) | SCN2A, SCN8A | `ACTIVE_NOT_RECRUITING` | Conditions explicitly include SCN2A-DEE and SCN8A-DEE. Two discovery links do not establish shared efficacy or mechanism. |
| [NCT06314490](https://clinicaltrials.gov/study/NCT06314490) | SCN2A | `ACTIVE_NOT_RECRUITING` | Individualized ASO study for one pediatric participant, actual enrollment=1. Detailed description specifies SCN2A GoF; ACTIVE_NOT_RECRUITING. |
| [NCT06356233](https://clinicaltrials.gov/study/NCT06356233) | STXBP1 | `NOT_YET_RECRUITING` | Observational STXBP1 phenotype/biomarker study; NOT_YET_RECRUITING is not a current enrollment opportunity. |
| [NCT06625112](https://clinicaltrials.gov/study/NCT06625112) | STXBP1 | `RECRUITING` | STXBP1 natural-history, endpoint and trial-readiness project; recruitment label is the status at retrieval. |
| [NCT07019922](https://clinicaltrials.gov/study/NCT07019922) | SCN2A | `RECRUITING` | Single-arm elsunersen study in early-onset SCN2A-DEE. Parent-condition discovery link does not imply suitability for all SCN2A subtypes. |

## NIH context review

| Official application | Core project | Gene | Reviewed scope |
| --- | --- | --- | --- |
| [11289342](https://reporter.nih.gov/project-details/11289342) | `R01MH136475` | SCN2A | SCN2A haploinsufficiency/ASD mouse CRISPRa project; preclinical rescue aims do not extend to GoF DEE. |
| [11594149](https://reporter.nih.gov/project-details/11594149) | `R56NS144233` | SCN2A | SCN2A deficiency and Dual-AAV; planned validation in mice and human iPSC brain organoids, not clinical treatment. |
| [11436758](https://reporter.nih.gov/project-details/11436758) | `K99NS151036` | SCN2A | SCN2A haploinsufficiency and sensory perception; K99/R00 mouse cortical/thalamic circuit research plan. |
| [11312585](https://reporter.nih.gov/project-details/11312585) | `F31NS135753` | KCNQ2 | KCNQ2 LoF/uORF; human iPSC neurons and ASO design, a cellular/preclinical research plan. |
| [11261040](https://reporter.nih.gov/project-details/11261040) | `R01NS034509` | SCN8A | SCN8A mutant mice, ASO/shRNA/CRISPR; prior results are preclinical and proposed work aims to improve them. |
| [11309107](https://reporter.nih.gov/project-details/11309107) | `F31NS143361` | SCN8A | SCN8A-DEE human iPSC thalamocortical organoids; model-based mechanism/intervention plan, not a patient trial. |
| [11285465](https://reporter.nih.gov/project-details/11285465) | `R01NS126392` | SCN8A | SCN8A R850Q/R1620L/N1768D mouse cell/circuit studies; findings must not be generalized to all variants. |

## Actual browser review

The unchanged P3 source was bundled in an isolated candidate runtime using the 120-node static graph. Existing dependencies were reused read-only; no package was installed and web/ was not edited. This browser session did not connect to a shared database. Prior isolated REST/database acceptance remains separate evidence.

All 62 new nodes were attempted through exact-name searches: **61 passed; one exact result was hidden by the six-match limit**. A further 22 state/evidence/demo/layout cases were recorded with 18 screenshots. No browser console error/warn was observed. Detailed browser receipts and screenshots are retained locally and excluded from this publication at the user's request. This is not unconditional UI acceptance.

The Foundation/STXBP1/STARR components, original STARR registry study, R853Q/R1882Q distinction, R853Q HEK/Xenopus exception, Contradicts badge and Helbig multi-disease links remain accessible. The current UI does not provide a full multi-step route explanation, so this review verifies the individual components and evidence views.

| Finding | Observed issue | Owner and proposed action |
| --- | --- | --- |
| R1 | The six-result limit hides an exact phenotype-name match; ext_ids are not searched. Searching Epileptic encephalopathy does not expose the existing new node hp_0200134. Searching HP:0100660 also fails to find Dyskinesia. | **P3; P1 supplies identifiers**: Prioritize exact names/aliases, include existing ext_ids, and expose remaining results through pagination or expansion. P1 may add stable-ID synonyms within the existing field as a compatibility aid; this does not replace a fix for result truncation. Location: `web/src/App.tsx:7; web/src/App.tsx:62`. |
| R2 | Inherited discovery-cluster memberships appear as unqualified functional assignments. Both the single-participant SCN2A GoF ASO study NCT06314490 and the SCN2A LoF mouse CRISPRa project 11289342 display both LoF and GoF clusters. | **P2 + P3**: Label these as provisional discovery groups and expose membership rationale. P2 should review whether research/PI memberships carry an unintended functional implication. Retain variant-specific assay evidence separately from broad-condition discovery links. Location: `web/src/Panels.tsx:39`. |
| R3 | Study nodes show recorded status but omit retrieval date, next_step and the single-participant restriction. NCT06314490 displays active not recruiting without showing its one-pediatric-participant scope or 2026-10-03 retrieval date. | **P1 + P3**: Use existing props.plain/next_step/scope_note or display these existing fields. Suggested wording for this new node: A dated research record (retrieved 2026-10-03) for one pediatric participant with SCN2A-associated DEE. Recorded status: active not recruiting. This is an individualized research protocol, not a general enrollment opportunity. Cluster membership is a provisional discovery grouping, not a functional assignment. Location: `web/src/Panels.tsx:32`. |
| R4 | A failed names/synonyms search is presented as an absence of papers, trials, registries or patient groups. HP:0100660 shows No supported route and a Missing claim even though the Dyskinesia node and its evidence exist. | **P3 + P4**: Only report no matching name/alias within the slice. Distinguish no match, unsearched data and evidence-backed coverage gaps. If P4 coverage is displayed, retain its scope and source dates. Location: `web/src/Panels.tsx:17; web/src/Panels.tsx:23`. |
| R5 | Structured field summaries and verbatim quotations share the same blockquote styling. The Dyskinesia frequency sentence combines Orphadata fields; NIH PI snippets may also combine fields. Provenance correctly records structured_record. | **P3**: Identify structured-record summaries explicitly; preserve raw fields and locators, and do not describe compositions as verbatim quotations. Location: `web/src/Panels.tsx:64`. |
| R6 | Long labels overlap substantially in the 120-node graph, including focused searches. The tested 1280x900 desktop layout and initial 697px-wide view both show crowding. Detail panels remain readable. | **P3**: Consider labels only for selected nodes/direct neighbors, with hover text for other nodes. Verify long study titles and densely connected regions. Location: `web/src/GraphView.tsx:61`. |

R1 reproduction: open the local preview, search `Epileptic encephalopathy`, and observe two partially matching assets plus four diseases. The exact phenotype `hp_0200134` is not listed. Its source and relationships are complete; this is a search-order/truncation issue.


R2/R3 reproduction: search `NCT06314490` and open the study. Recorded status is visible, but the one-participant limit/retrieval date is missing and both LoF and GoF are listed. The original detailed record describes an individualized GoF study; the candidate only adds a broad-condition discovery link.


Findings are also in [review-findings.json](review-findings.json). The P2/P3/P4 boundary remains preserved. R3's P1 wording correction is recorded in the findings; frontend behavior was not changed or reaccepted in the P1-only pass.

## Human P1/P2 review and gold-set ownership

The user confirmed that P2 extraction, gold and explanation artifacts have not yet been generated. This candidate has no data/extracted/ or data/gold/ directory, so reciprocal P1 review of those artifacts cannot yet be performed.

**P2 owns data/gold/.** The [P2 role brief](../../../context/roles/P2-ai-graph.md) requires five hand-labelled abstracts in M0 with claim, verbatim quote and correct edge, and extraction precision evaluation in M2. P1 supplies pinned abstracts/provenance, helps choose representative samples and checks P2 labels/outputs against their sources. An agent can prepare draft annotations; the final gold labels require human review.

Suggested initial coverage: STXBP1 mechanism, SCN2A GoF, SCN2A LoF/complex effects, KCNQ2 or SCN8A mechanism, and contradiction/neutral limitations. Five abstracts are a project minimum, not evidence of full-corpus accuracy. Keep frozen evaluation data separate from prompt-tuning examples.

Use [human-review.json](human-review.json) for real reviewer identities, dates, decisions and comments. Human fields remain pending/null. The separate P1 agent review is passed, but no M4 checkbox is closed by it.

- [ ] P1 accepts or returns the disease mappings, frequencies, study statuses and NIH/PI scope.
- [ ] P2 accepts or returns the discovery/mechanism/cluster distinctions, contradiction and demo-path interpretation.
- [ ] P2 supplies manually approved gold labels, extraction evaluation and explanation artifacts; P1 performs reciprocal source review.
- [ ] Owners record resolutions or explicit acceptance decisions for R1-R6 and rerun affected browser/data checks.
- [ ] Confirm that reviewer decisions bind to the final candidate hash before authorizing target integration or shared database loading.

## Reproduction and next action

The field checker is independent of the expansion builder and calls no network, model or database:

```powershell
Set-Location '<your-checkout>'
$p1ReviewPython = 'python'
& $p1ReviewPython data/acceptance/expansion/source-review-checker.py
& $p1ReviewPython pipeline/verify_expansion.py --data-only
& $p1ReviewPython pipeline/validate_graph.py --check-raw
```

Browser receipts describe this actual session; the retained local preview helps continue human inspection and can be stopped by its serving session. It uses static data and does not refresh official study status.

The P1-only review passed and authorizes the requested branch publication. P2/P3 issues remain owner handoffs. Before updating a shared database, follow [P1-EXPANSION.md](../../../context/P1-EXPANSION.md) for target comparison, backup and the existing P4 seed workflow. A push does not load or merge the data.
