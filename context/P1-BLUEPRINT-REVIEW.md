# P1 compliance review against PathNet Blueprint

## M1 follow-up, 2026-10-04

The findings below describe the historical `a1eba9d` review baseline. Subsequent bounded P1 work resolved F04/F05: correct Bright Data configuration/client handling, eight live acquisitions, five ClinVar identities across all four genes and user-confirmed P2 M0 agreement. The final 58-node snapshot passed native acceptance and has now been integrated into the shared Docker database/app. The literal seed command, root README/data entry point and reproduction checks passed; see [shared M1 integration record](P1-INTEGRATION.md). Historical findings remain below to preserve their reviewed baseline.

Current native history is in [P1-M1-EXECUTION.md](P1-M1-EXECUTION.md), with shared Docker acceptance recorded separately. P1/P2 M4 peer source review, funder representation, uniform process taxonomy, final algorithmic clustering, real Supabase/Auth and cloud/deployed acceptance remain open. M0 confirmation is not M4 sign-off; concurrent M2 work is not certified by this M1 integration.

Review date: 2026-10-04 (Europe/Berlin).

Reviewed repository baseline: `p1/data`, commit `a1eba9df4ed149629d7cc2251d95646135cd10cc`.

Reference document: `D:\Hack_Nation\task_docu\PathNet Blueprint.md`, SHA-256 `5651085905b16aa79f113b00e8759f235534dec7b6b3600ddfcb86e25fca9d44`. Blueprint line references below identify that local document; repository line references identify the reviewed commit. The Blueprint is an architecture/build plan, while `contract/contract.json` is the currently implemented interface.

## Verdict

The implementation substantially satisfies P1's core source, curated-data, asset and evidence duties. It is valid against the repository's current contract. It does **not** fully satisfy the Blueprint literally, and it is **not directly compatible with a consumer implemented only from the Blueprint's example schema or extraction JSON**.

Confirmed gaps include the documented Bright Data configuration error, the missing `make data` entry point, and the unrecorded P1/P2 peer sign-off. Acceptance of direct retrieval instead of a live Bright Data run, and of ClinVar coverage limited to SCN2A, requires an explicit team scope decision. Shared-funder graph relationships require an agreed contract extension or query/projection design with P4. The remaining deployed MVP, role security, action views, explanations and inferred bridges belong principally to P2/P3/P4.

This review adds an audit document only. It does not migrate the schema, modify the graph, expand source coverage, refresh sources or claim team/deployment acceptance.

## Checks performed

| Check | Result in this review |
| --- | --- |
| `python pipeline/validate_graph.py --check-raw` | Valid five-table graph; all 76 evidence records passed raw-source checks |
| `python pipeline/restore_pubmed.py --check` | All 159 pinned records matched their content digests |
| `python pipeline/fetch_groups.py --validate-curation` | All 21 curated quotations matched the source snapshots |
| Isolated `build_graph.py --output-dir` | All four generated JSON files matched the delivered files byte-for-byte |
| Existing `cluster(seed)` executed in memory | Three Louvain disease groups, distinct from the four supplied P1 groups |
| Counterexample membership | `gene_scn2a` belongs to `c_scn2a_lof` and `c_sodium_gof` |
| Asset checks | All eight assets have a URL and a concrete `next_step` |
| Unknown-query coverage helper | Returned `no_supported_route`; helper considers direct supported connections, not multi-hop journeys |
| Existing P2 quote-matcher probes | Accepted a case-changed quote and a title-only quote, both absent as literal substrings of the abstract |

The same baseline previously passed 64 tests and a clean Git-exported snapshot check, recorded in [P1-DATA.md](P1-DATA.md). Those broad tests were not repeated for this audit. No live Bright Data, OpenAI, Supabase, RLS or deployed-app test was performed during this review.

Current graph: **54 nodes, 68 edges, 76 evidence records, four clusters and 69 memberships**. Node types present: eight assets, seven diseases, four genes, six mechanisms, three patient groups, seven people, twelve phenotypes, five studies and two variants. There are 49 tier A and 19 tier B edges, 67 supporting and one contradicting edge; confidence remains uncalibrated (`null`). There are zero tier C edges.

## P1 requirement matrix

"Met" below refers to the P1 data deliverable, not to a deployed milestone gate.

| Blueprint requirement | Status | Evidence and boundary |
| --- | --- | --- |
| M0: choose a slice and backup using source coverage (lines 180-182) | Met for source selection | STXBP1 and neighbouring SCN2A/KCNQ2/SCN8A coverage are recorded in [coverage inventory](../data/curation/coverage_inventory.json); formal P2 slice approval is not recorded |
| M0: source URLs and licences (line 182) | Met | [SOURCES.md](SOURCES.md) records providers, versions, attribution, terms and bounded searches |
| M1: HPO/MONDO/Orphadata/ClinVar curated input (line 207) | Met with a coverage qualification | Four genes, five ontology disease terms, twelve HPO terms and two ClinVar variants; ClinVar variants cover SCN2A only |
| M1: 100-200 abstracts (line 208) | Met | 159 nonempty, six-field PubMed records, including indexed book chapters; P2 can consume the agreed input shape |
| M1: trials and RePORTER caches (line 208) | Met | 32 complete study records and 82 annual NIH application records; annual awards are not counted as independent projects |
| M1: patient-group acquisition using Bright Data (line 209) | Partial | Seven public organization/resource pages were retrieved directly; Bright Data implementation has fixture tests, without a live run |
| M3: 40-60 nodes (line 263) | Met | 54 real nodes; all edges have evidence |
| M3: assets and URLs (line 263) | Met at the data layer | Eight assets, five study records and three groups; URLs, next steps, reuse qualifications and dated trial statuses are supplied |
| M3: shared-investigator discovery (line 264) | Partial graph realization | Nine `investigator_disease` edges connect seven people; Ingo Helbig links three conditions. Explicit `shares_investigator` bridge edges remain P2 work |
| M3: shared-funder edges (line 264) | Partial; contract-dependent | Four award assets carry NINDS funding metadata, but there is no funder node or funding/overlap edge |
| M3: verify demo-path edges (line 265) | Met for recorded source audit | All 68 edges are `verified` within their stated source scope; machine-assisted source-context review is documented separately |
| M4: P1/P2 cross-review (line 292) | Pending | An independent source audit exists, but peer sign-off from the human/team role owners is not recorded |
| M4: provenance and `make data` (line 293) | Partial | Provenance and deterministic rebuild exist; the exact named entry point does not |
| M5: cold live-link check as Devon (line 319) | Not verified | Prior local static-browser checks do not establish the deployed family journey or role security |

The Blueprint's `seed_curated.json` filename is implemented through reviewed files in `data/curation/` and the five-table `data/seed/graph.json`. That is a documented functional replacement, not a missing dataset; consumers expecting the literal filename need an agreed mapping.

## Findings and ownership

### F01 — High: Blueprint and implemented contract are not interchangeable

Blueprint lines 66-80 use UUID primary/foreign keys, `nodes.canonical_name`, edge `org_id`/`created_by`, top-level cluster `method`/`version`, and `user_roles`. The implemented [SQL schema](../supabase/migrations/0001_graph.sql), lines 4-45, uses readable text IDs and `nodes.name`, five tables, no contribution ownership fields, and method information nested inside cluster `mechanism` JSON.

Blueprint lines 87-90 name `paper_claim_investigator`, `study_condition_intervention`, `funding_researcher_asset` and `org_disease_registry`; none is allowed by the current [contract](../contract/contract.json). Existing `study_disease`, `asset_disease`, `group_disease` and `investigator_disease` relations cover some discovery needs but do not encode every Blueprint relationship.

| Blueprint relationship | Current partial representation | Missing direct graph capability |
| --- | --- | --- |
| `paper_claim_investigator` | Evidence PMIDs/URLs, cached authors and separate NIH-backed person nodes | Paper/claim-to-investigator relation; there are no paper nodes in this slice |
| `study_condition_intervention` | Study-to-disease edges, conditions and dated study metadata | Intervention representation in the delivered graph; complete protocols remain available in raw caches |
| `funding_researcher_asset` | Award asset properties contain funders and investigator IDs | Traversable funding/person-to-award relationships |
| `org_disease_registry` | Group-to-disease and asset-to-disease edges | Direct organization-to-registry relation |

There is also an extraction incompatibility: the Blueprint's example at lines 121-130 uses a **gene** subject with `gene_variant_mechanism`, while the current contract, line 6, requires **variant → mechanism**. P1's two variant-mechanism edges obey the current contract. A gene-level claim must not be converted into a variant claim without explicit source identity.

The Blueprint extraction JSON nests subject/object structures and has a mechanism `process`; `pipeline/extract.py:34-44` instead emits flat subject/object strings and a separate effect. P2 needs an explicit conversion/validation step before these outputs can share an interface.

**Owner/action:** P4 must ratify one canonical schema and relation vocabulary with P1/P2/P3. Either revise the Blueprint to the accepted contract or provide a coordinated migration/adapter that updates identifiers, fields and all references, including evidence, memberships, demo paths and provenance. P1 should not independently add incompatible fields or enums.

### F02 — High: funding metadata is not a traversable funding graph

The four `asset_nih_*` records contain actual NINDS funder rows and `investigator_ids`. Those references live in `props`, without SQL foreign keys or rendered graph links. There is no person-to-award relation, funder node, or shared-funder edge. The current contract does not provide the required types. Thus the literal M3 shared-funder task is not complete even though the supporting records are present.

Investigator discovery is stronger: the existing person-to-disease paths are usable. However, there are zero derived `shares_investigator` or `shares_mechanism_with` edges. The Blueprint explicitly assigns tier C bridge generation/scoring to P2 at lines 241-243; P1's verified source facts are its input.

**Owner/action:** P1/P4 agree the funding representation or an approved projection/query; P1 supplies sourced candidates. P2 adds and labels any inferred disease bridges. A common funder or investigator must not imply common treatment response.

### F03 — Medium: the Blueprint's reproduction entry point is absent

No Makefile exists. `run.sh:15-20` only prints old fetch/extract/cluster instructions; it does not execute the reviewed builder. The documented `python pipeline/build_graph.py` rebuild is deterministic and works, but a unit following `make data` cannot use the promised interface.

**Owner/action:** P1/P4 add a real, portable entry point that rebuilds the reviewed baseline and validates it. Keep source refresh explicit and separate, so a normal data build remains offline and preserves the pinned release. Avoid overwriting later P2 merges unintentionally.

### F04 — Medium: Bright Data reproduction instructions are incorrect and live use is unverified

`context/P1-DATA.md:81` instructs `BRIGHTDATA_ZONE`; `pipeline/fetch_groups.py:119-121` actually requires `BRIGHTDATA_UNLOCKER_ZONE`. The root environment template also omits that zone. Following the delivered configuration fails before a request is sent.

The underlying patient-group data exists through direct retrieval, and the optional backend has fixture coverage. That satisfies much of the acquisition purpose but does not prove the Blueprint's specified live Bright Data operation.

**Owner/action:** P1 corrects its guide; P4 coordinates the environment template. A live backend check requires valid configured credentials and should preserve the source and quote audit. No live success should be claimed from fixture tests.

### F05 — Medium: ClinVar coverage is narrower than the four-gene slice

Both pinned variants, ClinVar 196039/R1882Q and 194555/R853Q, belong to SCN2A. STXBP1, KCNQ2 and SCN8A have no ClinVar variant records in the delivered slice. This supports the same-gene counterexample but is narrower than reading Blueprint line 207 as per-gene coverage from every listed provider.

**Owner/action:** P1 either documents and obtains acceptance of this deliberate source scope or adds reviewed source records for the other genes. Clinical classification alone must not be used to assign functional gain/loss. The review does not assume that every provider must have data for every gene.

### F06 — Medium: mechanism and cluster semantics need an explicit interchange mapping

All six mechanism nodes have a valid `props.effect`. Biological process/context is represented through names, scope and occasional pathway fields; none exposes a uniform `props.process`. Four source-reviewed P1 groups and SCN2A's two memberships are supplied, but they are not outputs of the Blueprint's Louvain workflow. The current P2 clustering uses mechanism/HPO weights only, omits shared trial/investigator weights, and returns three disease groups with a different output shape.

**Owner/action:** P1/P2 agree a process/effect taxonomy and mapping. P2 owns final weighted clustering, scores and generated bridges; P4 owns any top-level method/version changes. Preserve the variant-specific counterexample and avoid silently replacing reviewed memberships with a different algorithm output.

### F07 — Medium: contradiction and qualification data is only partly integrated

`scn2a_single_gof_assignment_refuted` is a real, first-class contradictory edge about the **broad** SCN2A gain-of-function assignment. It is not evidence against the specific R1882Q result. There is no general field associating a contradiction with the particular edge/claim it disputes, so showing conflicts beside any selected link is not implemented.

Two neutral scope limitations are identified in `provenance.evidence`, rather than the five-table evidence schema. The loader and frontend copy/load path omit that sidecar. The UI displays edge notes and quotations but cannot separately label those evidence rows using the sidecar. It also hides null confidence rather than presenting it as uncalibrated.

**Owner/action:** P1 retains the source-specific scopes already supplied. P2/P4 define conflict association; P3/P4 serve and join the qualifications and show an explicit uncalibrated state. Do not attach the broad contradictory claim to an unrelated, narrower variant assertion.

### F08 — Medium: peer acceptance and documentation integration remain open

[P1-EVIDENCE-REVIEW.md](P1-EVIDENCE-REVIEW.md) records a machine-assisted review of 37 edges/39 evidence rows. This is valuable but does not establish the P1/P2 role-owner swap/sign-off required at Blueprint line 292. No completed peer acceptance record was found.

The root `README.md:5` still calls the data placeholders, and `README.md:48` leaves reproduction unfinished. P1 supplied [P1-README-SECTION.md](P1-README-SECTION.md), but P4 has not integrated it. The guide's statement that no personal email/phone fields are exported should explicitly refer to the **graph export**: complete public trial snapshots include public professional contact fields. The Blueprint's restricted contact view remains unimplemented.

**Owner/action:** P1/P2 record an actual peer review; P1 narrows the contact-export wording; P4 integrates the README and any restricted contact schema/view. The presence of public registry contacts is not evidence of non-public patient data.

### F09 — Medium: the existing P2 quote checker is weaker than the literal Blueprint rule

Blueprint lines 60 and 118 require a quotation that appears verbatim in the abstract. `pipeline/extract.py:53-59` ignores case and whitespace, and lines 72-73 check the concatenated title plus abstract. Local probes confirmed that a case-changed quotation and a title-only quotation can pass even when neither is a literal abstract substring. The extractor also does not enforce relation endpoint types after matching a quote.

This does not invalidate P1's independently audited quotations, raw hashes or record bindings. It is a boundary risk for future model-derived claims. Likewise, SQL evidence fields permit null URLs/dates although the P1 validator requires valid values in the delivered dataset; future direct writes need equivalent integrity checks.

**Owner/action:** P2 ratifies the exact quotation policy, validates against the agreed source field, and enforces typed endpoints before merging model claims. P4 enforces the adopted source requirements on write paths. Reported extraction precision still requires a gold-set evaluation; passing P1 data checks is not that evaluation.

## MVP and architecture dependencies outside P1

| Blueprint target | Current state | Primary owner |
| --- | --- | --- |
| Live app reads authenticated Supabase with RLS | Static JSON and unauthenticated PostgREST modes exist; local preview uses static data. SQL grants anonymous SELECT and has no roles/RLS policies | P4/P3 |
| Four role homes plus admin | Role selection changes a label; role-specific views and enforcement are pending | P3/P4 |
| Action journey | Required asset/group/next-step metadata is supplied, but the dedicated view is absent | P3 |
| Honest supported-route failure | Coverage helper and inventory exist; UI only checks name/synonym matches, and helper is not a multi-hop path solver | P4/P3/P2 |
| Cited explanations, structured model extraction, evaluation and cached AI outputs | P1 provides source inputs; completed model extraction, gold-set precision, cite-or-drop explanations and Edge Functions are not established | P2/P4 |
| Mechanism/HPO/bridge visualization | Four reviewed starting groups exist; final algorithm, bridge generation and visual acceptance are pending | P2/P3 |
| Deployed five-login journey, walkthrough and videos | Not verified by this audit or by the prior local static preview | P4 with the whole team |

These are not reasons to invent missing P1 facts or relax evidence integrity. They prevent declaring the full Blueprint MVP complete.

## Recommended closure order

1. Ratify the schema/relation/extraction contract and assign the funding/conflict mappings before other roles implement against the Blueprint.
2. Correct the Bright Data configuration documentation; add the executable data entry point and integrate the prepared README.
3. Decide whether broader per-gene ClinVar coverage and a live Bright Data run are required for acceptance, then complete any agreed P1 acquisition work.
4. Record P1/P2 source-context sign-off; integrate qualifications, final clustering, inferred bridges, action metadata and supported-route checks.
5. Run the deployed role/RLS/persona gates, including the cold family journey, and record submission evidence.

Until those items close, report the status as **P1 reviewed data baseline delivered; Blueprint interface alignment and team integration pending**.
