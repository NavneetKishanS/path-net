# P1 source review from a P2 perspective

Reviewed on 2026-10-04. The separate, independently delegated machine-assisted review pass found one demo-wording error, now corrected, and no remaining required graph correction in the reviewed snapshot. This supports P1 source verification; it does **not** complete the reciprocal P1/P2 M4 sign-off.

The reviewer was the delegated `literature_trials` agent acting from P2's interpretation/extraction perspective. The reviewer previously contributed to P1 source collectors and community curation. This is therefore not an independent human scientific assessment or approval by the human P2 role owner. The review used the pinned official API responses and source-page snapshots; no new source acquisition was performed.

## Snapshot and exact scope

The graph contains 58 nodes, 69 edges, 77 evidence records, four provisional clusters and 70 memberships. Its complete file SHA-256 is `c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`.

All 69 edge identities, directions, types, stances and source associations were inspected. All 77 evidence records passed graph/provenance checks, including 99 evidence-level raw checks over 49 distinct files. All 22 community/literature quotations passed exact-text, offset, date and hash checks. Source-context inspection covered the eight cached mechanism abstracts, eight organization/resource pages, five selected study records, six NIH award records, and the retained ontology/annotation records. The 10 explicitly selected demo edges and their 11 evidence records received detailed interpretation review. The receipt lists the exact edge and evidence IDs: [peer-review.json](../data/acceptance/m4/peer-review.json).

This did not re-establish every HPO annotation from its underlying clinical paper, reproduce electrophysiology experiments, validate current recruitment, run P2 model extraction, or test a deployed route engine.

## Finding and resolution

**R1 — Incorrect count of supporting awards; resolved.** `network_overlap.scope` originally said “Both awards” although both selected Helbig associations cite the same NIH application, [11301017](https://reporter.nih.gov/project-details/11301017). Its PI field identifies profile `15318049`; its abstract describes the team's prior work on both SCN2A and STXBP1. The source supports shared expertise, not two independent awards or a shared treatment effect. The root agent corrected the description in [demo_spec.json](../data/curation/demo_spec.json) and regenerated [demo_paths.json](../data/seed/demo_paths.json) and provenance. The graph's full file hash stayed unchanged. The corrected wording and final hashes were checked by this reviewer.

## Interpretation checks

| Reviewed area | Result and boundary |
| --- | --- |
| STXBP1 mechanisms | [PMID 29538625](https://pubmed.ncbi.nlm.nih.gov/29538625/) supports the tested-variant protein-stability/haploinsufficiency interpretation; the record retains seven variants, four mouse models and model limitations. [PMID 32073399](https://pubmed.ncbi.nlm.nih.gov/32073399/) supports reduced cortical inhibitory transmission in haploinsufficient mice. Neither establishes a universal mechanism for every variant or clinical efficacy. |
| Foundation → disease → STARR | The foundation mission supports the organization association. The [STARR page](https://www.stxbp1disorders.org/starr) explicitly describes an observational natural-history study and names `NCT06555965`. Its [registry record](https://clinicaltrials.gov/study/NCT06555965) is observational and also covers SYNGAP1. The asset and study nodes represent the resource and its registry record, not two independent studies. Recorded recruitment is dated; eligibility/current availability must be confirmed. |
| Opposite SCN2A variants | Cached ClinVar records bind `196039` to R1882Q and `194555` to R853Q. Functional direction comes separately from [PMID 31558572](https://pubmed.ncbi.nlm.nih.gov/31558572/): HEK-cell findings support R1882Q GoF and primarily R853Q LoF. The retained R853Q caveat correctly describes a gating-pore current in Xenopus oocytes. ClinVar pathogenicity is not used as functional proof. The two variant nodes occupy the intended distinct provisional clusters. |
| Contradiction and subgroups | [PMID 37578743](https://pubmed.ncbi.nlm.nih.gov/37578743/) supports rejecting a single universal GoF/binary assignment, while preserving variant-specific findings. The contradictory edge has `stance: contradicts` and must never supply positive route support. The neonatal/autism associations from [PMID 38651838](https://pubmed.ncbi.nlm.nih.gov/38651838/) remain cohort associations; [PMID 41642117](https://pubmed.ncbi.nlm.nih.gov/41642117/) is correctly retained as a limitation on predicting detailed LoF mechanisms from phenotype. |
| Investigator overlap | The same stable NIH PI profile, not a name-only merge, connects both selected diseases through application `11301017`. The description of prior gene-specific work supports expertise discovery. It does not promise collaboration, clinical availability, or treatment equivalence. |
| No-route case | The fixture is an unknown query, explicitly limited to the selected slice. It supports neither a claim that a named disease has no research nor proof of exhaustive database coverage. Route direction and contradiction constraints are stated in the demo specification. Runtime behavior was not exercised in this source review. |

Additional context checks found no required correction: KCNQ2 functional claims are limited to seven tested variants, including five with dominant-negative effects; the SCN8A GoF association retains the studied subset and acknowledges LoF heterogeneity. KCNQ2's Harvard/Boston Children's natural-history resource is not conflated with Fudan's `NCT05157737`. DRAGONFLY, the biorepository and RARE-X records describe public resources without accessing participant data or asserting unrestricted reuse. Registry statuses distinguish recruiting, active-not-recruiting, unknown and terminated records. NIH awards describe funded/planned research, not demonstrated therapy outcomes. MONDO/Orphadata mappings and HPO rows retain disease-level scope; HPO frequency observations are not population prevalence or universal patient features.

**Source-status caveat:** NIH application `11322512` supplies `is_active: true` despite a recorded project end date of 2026-05-22, before retrieval. The graph preserves this as `source_is_active` alongside the actual end date and asks users to verify availability. Consumers must not turn that field into an independently verified current availability claim. This is an upstream inconsistency, not a fabricated graph value.

## P2 handoff and remaining review

Preserve source/model qualifiers in explanations. Treat structured NIH display snippets as compositions of identified source fields, not contiguous quotations. Preserve neutral caveats from provenance; a neutral assay limitation must not become a positive supporting claim. Do not infer treatment equivalence from shared investigators, phenotypes, clusters or funders. Confidence remains null and clusters are expressly provisional P1 groupings.

`data/extracted/` and `data/gold/` are absent in this checkout. There are no P2 model outputs, gold labels, extraction precision results or cached explanation sentences here for reciprocal fact-checking. Human P2 role-owner review, the return review of P2 artifacts, and runtime explanation acceptance remain pending. M4 is not marked complete by this report.

Final full-file SHA-256 bindings:

- Provenance: `7ccff345a76633c6c8ac1bf3f687ba94f1727de3c3e9b0a1e9ee5602e19883bd`.
- Demo paths: `e5de79e4b72888d61db353a63d9009b1d4cea72846846a949a21b21255cc8095`.
- Demo specification: `830d108d0faab25b3bd2394f5df5a87972570842095483c94d47b7fb9320905c`.
