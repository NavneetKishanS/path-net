"""Score extraction against the hand-labelled gold set.

    python eval_gold.py             # validate data/gold/gold.jsonl, then score data/extracted/*.json against it
    python eval_gold.py --check     # only validate the gold file (labels, consistency, verbatim quotes)
    python eval_gold.py --verbose   # also list every miss and false positive

Three match levels, from loose to strict (all compare the normalised quote and the relation):
    sentence  same sentence + same relation
    label     ... + same effect and stance
    strict    ... + same subject and object text
Report "label" as the headline number; "strict" is harsh because names vary ("STXBP1" vs "STXBP1 gene").
With a handful of abstracts this is a sanity check, not a benchmark. Say so when you report it.
"""
import argparse
import json
import re
import sys
from collections import Counter

from common import DATA_DIR, EXTRACTED_DIR, RAW_DIR
from extract import verify_quote
from labels import EFFECTS, RELATIONS, STANCES

GOLD_FILE = DATA_DIR / "gold" / "gold.jsonl"
FIELDS = ("subject", "relation", "object", "effect", "stance", "quote")


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


LEVELS = {
    "sentence": lambda c: (norm(c["quote"]), c["relation"]),
    "label": lambda c: (norm(c["quote"]), c["relation"], c["effect"], c["stance"]),
    "strict": lambda c: (norm(c["quote"]), c["relation"], c["effect"], c["stance"], norm(c["subject"]), norm(c["object"])),
}


def abstract_text(pmid: str) -> str | None:
    f = RAW_DIR / "pubmed" / f"{pmid}.json"
    if not f.exists():
        return None
    rec = json.loads(f.read_text(encoding="utf-8"))
    return f"{rec.get('title', '')} {rec.get('abstract', '')}"


def load_gold(path=GOLD_FILE):
    """Return (gold dict pmid -> claims, errors, warnings)."""
    errors, warnings, gold = [], [], {}
    if not path.exists():
        return gold, [f"{path} not found. Copy data/gold/gold.example.jsonl and label your abstracts."], warnings
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f"line {n}: not valid JSON ({e})")
            continue
        pmid = str(row.get("pmid", "")).strip()
        where = f"line {n} (pmid {pmid or '?'})"
        if not pmid:
            errors.append(f"{where}: missing pmid")
            continue
        if row.get("draft"):
            errors.append(f"{where}: still marked draft. Check every claim against the abstract, then delete the \"draft\" field.")
        if pmid in gold:
            errors.append(f"{where}: duplicate pmid")
        text = abstract_text(pmid)
        if text is None:
            warnings.append(f"{where}: abstract not in data/raw/pubmed, so quotes cannot be verified")
        claims = row.get("claims")
        if not isinstance(claims, list):
            errors.append(f"{where}: claims must be a list")
            continue
        for i, c in enumerate(claims, 1):
            cw = f"{where} claim {i}"
            missing = [k for k in FIELDS if not isinstance(c.get(k), str) or not c[k].strip()]
            if missing:
                errors.append(f"{cw}: missing or empty {missing}")
                continue
            if c["relation"] not in RELATIONS:
                errors.append(f"{cw}: relation '{c['relation']}' not in {RELATIONS}")
            if c["effect"] not in EFFECTS:
                errors.append(f"{cw}: effect '{c['effect']}' not in {EFFECTS}")
            if c["stance"] not in STANCES:
                errors.append(f"{cw}: stance '{c['stance']}' not in {STANCES}")
            if c["relation"] == "disease_mechanism" and c["effect"] == "not_applicable":
                errors.append(f"{cw}: disease_mechanism needs an effect (use 'unknown' if the text does not say)")
            if c["relation"] != "disease_mechanism" and c["effect"] != "not_applicable":
                errors.append(f"{cw}: effect must be 'not_applicable' unless the relation is disease_mechanism")
            if c["quote"].strip().startswith("<") and c["quote"].strip().endswith(">"):
                errors.append(f"{cw}: quote is still the template placeholder")
            elif text is not None and not verify_quote(c["quote"], text):
                errors.append(f"{cw}: quote is not verbatim in the abstract: \"{c['quote'][:70]}...\"")
        gold[pmid] = claims
    if not gold and not errors:
        errors.append(f"{path} has no labelled abstracts yet")
    return gold, errors, warnings


def load_predicted(pmid: str):
    f = EXTRACTED_DIR / f"{pmid}.json"
    if not f.exists():
        return None, 0
    d = json.loads(f.read_text(encoding="utf-8"))
    return d["kept"], d.get("dropped", 0)


def prf(tp: int, pred: int, gold: int):
    p = tp / pred if pred else 0.0
    r = tp / gold if gold else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return p, r, f


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="only validate the gold file")
    ap.add_argument("--verbose", action="store_true", help="list misses and false positives")
    args = ap.parse_args()

    gold, errors, warnings = load_gold()
    for w in warnings:
        print(f"warning: {w}")
    if errors:
        print(f"\n{len(errors)} problem(s) in the gold file:")
        for e in errors:
            print(f"  - {e}")
        return 1
    n_claims = sum(len(v) for v in gold.values())
    print(f"Gold file OK: {len(gold)} abstracts, {n_claims} claims.")
    if args.check:
        return 0

    tp = Counter()
    n_gold = n_pred = dropped_total = 0
    per_pmid, misses, false_pos, not_run = [], [], [], []
    for pmid, gclaims in gold.items():
        pred, dropped = load_predicted(pmid)
        if pred is None:
            not_run.append(pmid)
            pred = []
        dropped_total += dropped
        n_gold += len(gclaims)
        n_pred += len(pred)
        for name, key in LEVELS.items():
            g, p = Counter(map(key, gclaims)), Counter(map(key, pred))
            tp[name] += sum((g & p).values())
            if name == "label":
                per_pmid.append((pmid, sum((g & p).values()), len(gclaims), len(pred)))
                misses += [(pmid, k) for k in (g - p).elements()]
                false_pos += [(pmid, k) for k in (p - g).elements()]

    if not_run:
        print(f"warning: no extraction output for {not_run}; run: python extract.py {' '.join(not_run)}")
    print(f"\n{'level':<10}{'precision':>10}{'recall':>9}{'F1':>7}   (tp / predicted / gold)")
    for name in LEVELS:
        p, r, f = prf(tp[name], n_pred, n_gold)
        print(f"{name:<10}{p:>10.2f}{r:>9.2f}{f:>7.2f}   ({tp[name]} / {n_pred} / {n_gold})")

    print(f"\nPer abstract at the 'label' level:\n{'pmid':<12}{'matched':>8}{'gold':>6}{'model':>7}")
    for pmid, m, g, p in per_pmid:
        print(f"{pmid:<12}{m:>8}{g:>6}{p:>7}")

    kept_plus_dropped = n_pred + dropped_total
    if kept_plus_dropped:
        print(f"\nQuote guard: {dropped_total} of {kept_plus_dropped} model claims were dropped for a non-verbatim quote "
              f"({dropped_total / kept_plus_dropped:.0%}).")
    print(f"Misses (in gold, not found): {len(misses)}   False positives (found, not in gold): {len(false_pos)}")
    if args.verbose:
        for tag, rows in (("MISS", misses), ("EXTRA", false_pos)):
            for pmid, k in rows:
                quote, *labels = k
                print(f"  {tag} {pmid} {labels} \"{quote[:80]}\"")
    else:
        print("Run with --verbose to list them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
