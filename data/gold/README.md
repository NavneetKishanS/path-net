# Gold set (owner: P2)

Hand-labelled claims for about 5 abstracts. `pipeline/eval_gold.py` scores the model against them.

Files:
- `gold.example.jsonl`: the format, with placeholder values. Copy its shape, do not edit it.
- `gold.jsonl`: your labels (you create it). One JSON object per line, one line per abstract.
- `draft.jsonl`: written by `extract.py --draft`. A starting point only. It is never scored.

Rules for the labels are in `context/LABEL_RULES.md`. Read them first.

## Steps

1. Make sure the abstracts are cached: `ls ../raw/pubmed`. If empty, run from `pipeline/`:
   `python fetch_pubmed.py "YOUR QUERY" --max 30`
2. Pick 5 abstracts that differ: a clear loss of function, a gain of function, one mostly about phenotypes, one vague or review-style, one with a negative or conflicting finding. Do not take the first 5.
3. Fast route: get a draft, then correct it.
   `python extract.py --draft PMID1 PMID2 PMID3 PMID4 PMID5`
   This writes `draft.jsonl`. Read each abstract first, then check every claim, fix wrong labels, delete wrong claims, add missed ones.
   Slow route: write the lines by hand following `gold.example.jsonl`.
4. Save as `gold.jsonl` and delete the `"draft": true` field from every line once you have checked it. The scorer refuses lines still marked draft, so you cannot accidentally score the model against its own unchecked output.
5. Validate: `python eval_gold.py --check`. It catches wrong labels, inconsistent effects and quotes that are not verbatim in the abstract.
6. Score: `python eval_gold.py --verbose`.
7. Optional but worth 10 minutes: ask P1 to label 2 of the same abstracts without seeing yours. If you disagree on more than a claim or two, tighten `context/LABEL_RULES.md`.

## What to report
Precision and recall at the `label` level, plus the quote-guard rate. With around 15 to 25 claims this is a sanity check. Say that in the README, not "accuracy".

Commit `gold.jsonl` and `data/extracted/`. Do not commit `data/raw/`.
