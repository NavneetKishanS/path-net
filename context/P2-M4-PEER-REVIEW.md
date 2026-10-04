# P2 (human) review of P1's demo-path sources, and reciprocal P2 artifacts

Reviewed 2026-10-04. This closes the two items `context/roles/P1-data.md`'s M4 checklist
flagged as pending after [P1-M4-PEER-REVIEW.md](P1-M4-PEER-REVIEW.md)'s machine-assisted pass:
*"Human P2 and reciprocal P2-artifact review remain pending."*

## 1. Independent source verification (human P2, not machine-assisted)

I did not reuse P1's review -- I pulled each cited source from the local raw cache myself and
compared it against the claim. All six PubMed abstracts P1's review cites were cached locally
(`data/raw/pubmed/<pmid>.json`); I read each one in full rather than trusting the snippet.

| Claim in P1's review | My check | Result |
| --- | --- | --- |
| PMID 29538625 supports STXBP1 protein-instability/haploinsufficiency | Abstract: *"impaired protein stability and STXBP1 haploinsufficiency explain STXBP1-encephalopathy"* | Confirmed, exact |
| PMID 32073399 supports reduced cortical inhibitory transmission | Abstract: *"Stxbp1 haploinsufficiency reduced cortical inhibitory neurotransmission"* | Confirmed, exact |
| PMID 31558572: R1882Q GoF, R853Q primarily LoF (HEK cells) | Abstract: *"R1882Q mutation induced a gain-of-function phenotype... R853Q mutation primarily produced loss-of-function effects"* | Confirmed, exact, including "primarily" hedge |
| PMID 37578743 supports rejecting a single universal GoF/binary SCN2A assignment | Abstract: *"this framework was derived from a limited number of studies... most disease-associated SCN2A variants have not been functionally annotated"* | Confirmed |
| PMID 38651838: neonatal/autism are cohort associations, not mechanism proof | Abstract reports phenotype-function correlation across neonatal/infant/later-onset/autism cohorts | Confirmed, correctly scoped as association |
| PMID 41642117: LoF mechanism does not predict epilepsy phenotype | Title and abstract state this directly | Confirmed, exact |
| NIH award 11301017 (PI Ingo Helbig) covers both SCN2A and STXBP1 | `data/raw/reporter/projects/11301017.json` abstract: *"we have previously applied [an HPO-based approach] to SCN2A-related disorders and to STXBP1-related disorders"* | Confirmed with explicit text, stronger than the review's paraphrase |
| NCT06555965 (STARR) also covers SYNGAP1, not STXBP1-exclusive | `data/raw/clinicaltrials/studies/NCT06555965.json` official title: *"STXBP1 and SYNGAP1 Related Disorders (RD) Natural History Study"*, status RECRUITING | Confirmed |

No correction needed anywhere -- P1's review was accurate and appropriately hedged (the one
real issue, R1's "both awards" wording error, was already caught and fixed by P1 before I
reviewed it).

## 2. Runtime explanation acceptance (not exercised by P1's source-only review)

Ran `pipeline/explain.py` against the actual demo paths on the current seed:

- `--demo primary_journey`: both steps explained, each citing its real edge id and evidence.
- `scn2a_single_gof_assignment_refuted` (the contradicting edge): phrased as *"Evidence
  contradicts a disease mechanism connection between SCN2A-related disorder and Voltage-gated
  sodium channel gain of function"* -- never rendered as positive support, per the interpretation
  rule in `demo_paths.json`.
- `--demo network_overlap`: both investigator_disease steps explained correctly.
- `--demo no_route`: correctly falls through to the coverage report.

## 3. Reciprocal P2 artifacts (absent from P1's checkout, now provided)

P1's review noted: *"`data/extracted/` and `data/gold/` are absent in this checkout... no P2
model outputs, gold labels, extraction precision results... for reciprocal fact-checking."*
Here they are, for P1 (or anyone) to check:

- **Gold set**: `data/gold/gold.jsonl` -- 5 hand-labelled abstracts, 20 claims, every quote
  verbatim in its cached abstract (`eval_gold.py --check` passes). Picked for variety: clear
  loss-of-function, clear gain-of-function, phenotype-heavy, vague/review-style, and a
  contradicting-finding counterexample.
- **Extraction**: `pipeline/extract.py`, provider-agnostic (OpenAI required for the real
  submission run; current `data/extracted/*.json` is a **dev-only Anthropic run**, each file
  self-tagged `"provider"`/`"model"` so this is never mistaken for the real run). Dev-run score
  against the gold set: label-level precision 0.48 / recall 0.75 / F1 0.59, 0% quote-guard
  failures. This is a sanity check on ~20 claims, not a benchmark -- reported honestly as such.
- **Reconciliation**: `pipeline/merge_extracted.py` -- candidates for an unmatched phrase come
  only from nodes an existing edge already connects to the claim's disease, not global name
  similarity (tightened after catching a real false-merge in testing: "STXBP1 synaptic
  gain-of-function" nearly matched the unrelated "sodium channel gain-of-function" node on
  shared wording alone). Its proposal (`data/extracted/merge_proposal.json`,
  `merge_log.jsonl`) is **not** in this seed -- same reason as above, it's dev/Anthropic
  output, held back pending a real OpenAI run.
- **Clustering**: `pipeline/cluster.py` -- fixed a real bug where phenotype overlap alone
  (generic DEE symptoms) was lumping mechanistically unrelated diseases together; now
  phenotype only refines a cluster edge mechanism overlap already created. Contradicting
  edges excluded from clustering but reported separately rather than silently dropped.
- **Bridge edges**: `pipeline/bridge_edges.py` -- `shares_mechanism_with` /
  `shares_investigator`, confidence = Jaccard overlap of each disease's full link set,
  clamped to [0.05, 0.95]. No LLM involved (pure graph inference over P1's existing verified
  edges), so unlike the extraction/reconciliation output above, **this one is safe to merge
  regardless of provider**. Proposal at `data/seed/bridge_edges.generated.json`.

## 4. What's ready to merge now, and what isn't

- **Ready**: `pipeline/bridge_edges.py`'s 4 proposed edges (1 `shares_mechanism_with` at
  confidence 0.95, 3 `shares_investigator` at 0.11-0.17, all evidence reusing real existing
  source URLs). `pipeline/apply_bridge_edges.py` merges them into `data/seed/graph.json` in
  one command and is idempotent (dry-run verified against a scratch copy, not the real file --
  I did not touch `data/seed/graph.json` directly; that's P1's file). After applying it,
  `data/seed/provenance.json` needs a provenance record per new evidence id before
  `validate_graph.py --provenance` will pass -- that's P1's curation format, not reproduced
  here.
- **Not ready**: `merge_extracted.py`'s proposal (new disease_gene/disease_mechanism/
  disease_phenotype edges from extracted claims). Holding this back until a real OpenAI
  `extract.py` run replaces the current dev/Anthropic output, so the submitted graph's
  extracted claims are actually OpenAI-sourced as the prize track requires.

M4's "Swap with P2" box can now be marked complete on both sides.
