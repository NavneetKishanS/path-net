# P4 one-minute walkthrough plan

Status: 2026-10-04 (Europe/Berlin). Script prepared from the delivered P1 release; no walkthrough, voiceover, team video or backup recording has been produced. The current app has search, graph and basic evidence inspection. Action, richer contradiction display, authenticated roles and platform-backed no-route screens need P3 integration before this can be recorded as a full product journey.

Source of truth: [`data/seed/demo_paths.json`](../data/seed/demo_paths.json), graph SHA-256 `508724167dc7c8af5241dbc7c6483f614653a36b90740df611d7d88cf8a593cf`. If the graph changes, revalidate every cited edge and update the recording plan. Do not substitute the Blueprint's illustrative inferred bridge for an actual P1 edge: this baseline has no tier C relationships.

## The 60-second sequence

| Time | Screen / evidence to show | Voiceover |
| --- | --- | --- |
| 0:00–0:10 | Search `STXBP1`; open `dis_stxbp1`. Show its mechanism group and dated snapshot. | “A patient-group leader starts with STXBP1. PathNet organises a small, source-backed research slice around mechanisms and symptoms.” |
| 0:10–0:22 | Show `group_stxbp1_disease` and `asset_starr_disease`, including real source links and excerpts. | “Here are the STXBP1 Foundation and the STARR natural-history resource. Each connection includes a source and quote, showing exactly what supports it.” |
| 0:22–0:35 | Open `scn2a_r1882q_gof`, `scn2a_r853q_lof`, and `scn2a_single_gof_assignment_refuted`. Keep variant and assay notes visible. | “One gene can have different mechanisms. These SCN2A variants have different functional evidence, with assay limitations and a counterexample to a single-mechanism label.” |
| 0:35–0:48 | Return to STARR's action card with the Foundation and fixture next step. | “Next, review STARR's protocol and outcome measures with the Foundation and study team. Confirm current status, eligibility and permissions before discussing participation or reuse.” |
| 0:48–1:00 | Search `no supported match in this slice`; show `no_supported_route`, searched scope, missing evidence and next checks. | “For an unknown query, PathNet says what this slice searched, what is missing and what to check next. Saved time remains a goal to measure.” |

The sequence targets one minute. Time the final narration and adjust pace during recording; no generated audio duration has been measured.

## Evidence and screen requirements

1. **Primary resource path:** ordered edges `group_stxbp1_disease`, `asset_starr_disease`. Discovery traverses the common disease in opposite directions; retain each edge's original source, target and type. Partner: `group_stxbp1_foundation`; asset: `asset_starr_natural_history`.
2. **Mechanism context:** supporting edges `stxbp1_haploinsufficiency` and `stxbp1_synaptic_release`. These do not prove a treatment or cross-disease therapeutic route.
3. **Official study:** `study_nct06555965` and `e_study_disease_study_nct06555965_dis_stxbp1`. STARR's asset and study are two views of the same resource, not independent studies.
4. **Counterexample:** gain variant `var_clinvar_196039`, loss variant `var_clinvar_194555`, groups `c_sodium_gof` and `c_scn2a_lof`. R853Q mainly showed loss of function in HEK cells and also a gating-pore current in Xenopus oocytes; retain those limitations. Contradicting evidence is never positive route support.
5. **Unknown query:** use the literal fixture, not an unsupported assertion about a named disease. State the source slice and next checks.

The existing interface can demonstrate implemented search and basic evidence features. Label locally inspected API responses as platform demonstrations. A data file, test or response is not a substitute for a completed screen in the final product walkthrough.

## Optional longer demonstration

For a collaborator segment, use fixture `network_overlap`: investigator `person_nih_15318049` and edges `e_investigator_disease_person_nih_15318049_dis_stxbp1`, `e_investigator_disease_person_nih_15318049_dis_scn2a`. These awards support finding shared expertise. They do not establish shared treatment response or biological mechanism.

Funding remains in NIH award assets' `props.funder`. Do not animate a new funder relationship unless the team extends and validates the shared contract.

## Recording gates

- P2 verifies final explanation sentences against their cited edges; preserve contradiction and assay caveats. Record the P1/P2 source-context peer sign-off.
- P3 connects action/no-route screens and completes legible evidence panels. Use real role sessions when demonstrating authorization; the current selector is not a login.
- P4 runs the full journey twice on the eventual deployed URL from a clean browser, checks all five roles and verifies source attribution.
- Record the walkthrough, a separately planned team video and a backup capture. Add output locations only after files exist; no ElevenLabs output currently exists.
- If a 10× slide is later added, name the milestone, cite a baseline, label assumed durations and define measurement. This script claims no measured speedup.

## Submission items still needed

The deployed URL, five working demo logins, recorded videos, judge-accessible repository and submission confirmation remain outstanding. The README and script can be prepared locally without those services; they do not close the deployed MVP gate.
