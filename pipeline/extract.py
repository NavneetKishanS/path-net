"""Extract claims from cached abstracts with OpenAI, keeping only claims whose quote is verbatim.

    python extract.py                      # every file in data/raw/pubmed
    python extract.py 12345678 23456789    # only these PMIDs
    python extract.py --draft 111 222 333  # also write data/gold/draft.jsonl, a first draft to hand-correct

Needs OPENAI_API_KEY and OPENAI_MODEL_EXTRACT in .env. Output: data/extracted/<pmid>.json
Labels and rules live in labels.py (from contract/contract.json). Owner: P2.
"""
import json
import os
import re
import sys

from common import DATA_DIR, EXTRACTED_DIR, RAW_DIR, save_json
from labels import EFFECTS, RELATIONS, RULES, STANCES

SCHEMA = {
    "name": "claims",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["claims"],
        "properties": {
            "claims": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["subject", "relation", "object", "effect", "stance", "quote", "confidence"],
                    "properties": {
                        "subject": {"type": "string", "description": "the disease or condition, as written"},
                        "relation": {"type": "string", "enum": RELATIONS},
                        "object": {"type": "string", "description": "gene symbol, mechanism phrase, or phenotype, as written"},
                        "effect": {"type": "string", "enum": EFFECTS},
                        "stance": {"type": "string", "enum": STANCES},
                        "quote": {"type": "string", "description": "one sentence copied exactly from the abstract"},
                        "confidence": {"type": "number", "description": "0 to 1"},
                    },
                },
            }
        },
    },
}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def verify_quote(quote: str, text: str) -> bool:
    """A claim is kept only if its quote appears verbatim (ignoring case and whitespace)."""
    return bool(quote) and _norm(quote) in _norm(text)


def fix_effect(claim: dict) -> dict:
    """The effect label only makes sense for disease_mechanism. Enforce that consistently."""
    if claim["relation"] != "disease_mechanism":
        claim["effect"] = "not_applicable"
    elif claim["effect"] == "not_applicable":
        claim["effect"] = "unknown"
    return claim


def extract_one(client, model: str, rec: dict) -> dict:
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": RULES},
            {"role": "user", "content": f"PMID {rec['pmid']}\nTitle: {rec['title']}\nAbstract: {rec['abstract']}"},
        ],
        response_format={"type": "json_schema", "json_schema": SCHEMA},
    )
    claims = json.loads(resp.choices[0].message.content)["claims"]
    text = f"{rec['title']} {rec['abstract']}"
    kept = [fix_effect(c) for c in claims if verify_quote(c["quote"], text)]
    for c in kept:
        c["pmid"] = rec["pmid"]
        c["source_url"] = rec["url"]
    return {"pmid": rec["pmid"], "kept": kept, "dropped": len(claims) - len(kept)}


def draft_line(result: dict) -> dict:
    """Gold-format line for hand correction. The "draft" flag blocks eval_gold.py until you delete it."""
    keys = ("subject", "relation", "object", "effect", "stance", "quote")
    return {"pmid": result["pmid"], "draft": True, "claims": [{k: c[k] for k in keys} for c in result["kept"]]}


def main() -> None:
    from openai import OpenAI

    args = sys.argv[1:]
    draft = "--draft" in args
    pmids = [a for a in args if not a.startswith("--")]
    model = os.environ.get("OPENAI_MODEL_EXTRACT")
    if not os.environ.get("OPENAI_API_KEY") or not model:
        sys.exit("Set OPENAI_API_KEY and OPENAI_MODEL_EXTRACT in .env first.")
    client = OpenAI()

    files = [RAW_DIR / "pubmed" / f"{p}.json" for p in pmids] or sorted((RAW_DIR / "pubmed").glob("*.json"))
    drafts = []
    for f in files:
        if not f.exists():
            print(f"{f.name}: not in the raw cache; run fetch_pubmed.py first")
            continue
        rec = json.loads(f.read_text(encoding="utf-8"))
        if not rec.get("abstract"):
            continue
        result = extract_one(client, model, rec)
        save_json(EXTRACTED_DIR / f"{rec['pmid']}.json", result)
        drafts.append(draft_line(result))
        print(f"{rec['pmid']}: kept {len(result['kept'])}, dropped {result['dropped']} (quote not verbatim)")

    if draft and drafts:
        out = DATA_DIR / "gold" / "draft.jsonl"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("\n".join(json.dumps(d, ensure_ascii=False) for d in drafts) + "\n", encoding="utf-8")
        print(f"Draft written to {out}. Read each abstract, correct every claim, add missed ones, "
              f"delete the \"draft\" field, then save as gold.jsonl.")


if __name__ == "__main__":
    main()
