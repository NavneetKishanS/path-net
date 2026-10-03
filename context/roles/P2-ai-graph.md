# P2: AI and graph lead

Owner: ______________ · Sleeps 05:00 to 09:00 · Read `context/00-PROJECT.md` first.

## Mission
Turn raw text into trustworthy graph edges, group diseases by mechanism and phenotype, and explain every path in plain language with a citation for each step. Track prizes require OpenAI models or tools, so the extraction, reconciliation and explanation calls go to OpenAI.

## You own
`pipeline/extract.py`, `pipeline/cluster.py`, new `pipeline/reconcile.py` and `pipeline/explain.py`, all prompts, the gold set, and the extraction evaluation.

## Start in 5 minutes
```bash
cp .env.example .env     # set OPENAI_API_KEY, OPENAI_MODEL_EXTRACT, OPENAI_MODEL_EXPLAIN
cd pipeline && pip install -r requirements.txt
python cluster.py        # works on the placeholder seed: Disease 1 and 3 cluster, Disease 2 is separate
python extract.py        # needs cached abstracts from P1 (data/raw/pubmed)
```
Confirm with the team whether the hackathon provides OpenAI credits or whether you use your own key.

## Checklist
**M0 (Sat 20:30)**
- [ ] Fix the extraction schema, edge-type enum and mechanism taxonomy with P4 (`contract/contract.json`).
- [ ] Hand-label 5 abstracts as a gold set in `data/gold/` (claim, quote, correct edge).

**M1 (to 01:00)**
- [ ] Run extraction on P1's abstracts. Keep only claims whose quote is verbatim (already coded in `verify_quote`).
- [ ] Reconcile v0: exact and synonym match on ontology ids first. Only unmatched names go to the model, with the top five candidate nodes as options. The model may answer `none`.
- [ ] Turn kept claims into tier B edges plus evidence rows and merge them into the seed (coordinate with P1 on the file).
- [ ] Cluster v0 on tier A edges (`cluster.py`).

**M2 (01:00 to 05:00, you are awake with P4)**
- [ ] Extract mechanism and effect (loss or gain of function). Cluster on mechanism plus HPO term overlap.
- [ ] The counterexample: one gene in two clusters, with the contradicting edge shown.
- [ ] Tier C bridge edges (shared mechanism, shared investigator) and the confidence scoring rule.
- [ ] `explain.py`: input an ordered list of edges with evidence, output plain-language steps, each tagged with the edge id it rests on. Drop any sentence with no edge. Hypotheses use "may" and are labelled inferred. Empty path returns the coverage report.
- [ ] Score extraction on the gold set. Record precision honestly.
- [ ] Write the handoff note before you sleep at 05:00.

**M3 (09:00 to 10:00)**
- [ ] Wire explain output into the app with P3. Add a "next experiment" suggestion grounded in edges.
- [ ] Pre-render ElevenLabs audio for the demo paths.

**M4 (10:00 to 13:00)**
- [ ] Freeze prompts. Swap with P1 to fact-check demo-path edges.
- [ ] Report precision on the gold set and known limits.
- [ ] 10x slide: every number labelled as an assumption to validate, with the baseline source cited.

## Rules
- Structured JSON output only. Validate against the schema before writing anything.
- Cache every model output in `data/extracted/` so the live demo needs no API call.
- Log every model-made merge for human review.
- Never let the model invent an id, URL or quote.

## Done means
Gold-set score recorded, clusters show the counterexample, every explanation sentence cites an edge id, outputs are cached in the repo.

## Prompt to paste into Claude Code
"I am P2 (AI and graph) on PathNet. Read context/00-PROJECT.md and context/roles/P2-ai-graph.md. Build pipeline/reconcile.py and pipeline/explain.py using OpenAI structured outputs. Every explanation sentence must cite an edge id and unsupported sentences must be dropped. Do not invent identifiers or sources."
