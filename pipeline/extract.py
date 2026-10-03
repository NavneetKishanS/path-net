"""Extract claims from cached abstracts, keeping only claims whose quote is verbatim.

    python extract.py                      # every file in data/raw/pubmed, skipping cached ones
    python extract.py 12345678 23456789    # only these PMIDs
    python extract.py --force 12345678     # re-extract even if data/extracted/<pmid>.json exists
    python extract.py --draft 111 222 333  # also write data/gold/draft.jsonl, a first draft to hand-correct

Provider is auto-detected from which key is set in .env (OPENAI_API_KEY or ANTHROPIC_API_KEY;
EXTRACT_PROVIDER=openai|anthropic overrides if both happen to be set). Prize tracks require
OpenAI, so the real submission run must have OPENAI_API_KEY set; Anthropic is for local dev
only (e.g. no OpenAI key yet) and every extracted file records which provider produced it.

Output: data/extracted/<pmid>.json. Labels and rules live in labels.py (from contract/contract.json).
Owner: P2.
"""
import json
import re
import sys

import llm
from common import DATA_DIR, EXTRACTED_DIR, RAW_DIR, save_json
from labels import EFFECTS, RELATIONS, RULES, STANCES

CLAIM_SCHEMA = {
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
}

CLAIM_TOOL = {"name": "record_claims", "description": "Record the claims extracted from the abstract.", "input_schema": CLAIM_SCHEMA}


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


def extract_one(provider: str, model: str, api_key: str, rec: dict) -> dict:
    user_content = f"PMID {rec['pmid']}\nTitle: {rec['title']}\nAbstract: {rec['abstract']}"
    claims = llm.call_structured(provider, model, api_key, RULES, user_content, CLAIM_TOOL)["claims"]
    text = f"{rec['title']} {rec['abstract']}"
    kept = [fix_effect(c) for c in claims if verify_quote(c["quote"], text)]
    for c in kept:
        c["pmid"] = rec["pmid"]
        c["source_url"] = rec["url"]
    return {"pmid": rec["pmid"], "kept": kept, "dropped": len(claims) - len(kept), "provider": provider, "model": model}


def draft_line(result: dict) -> dict:
    """Gold-format line for hand correction. The "draft" flag blocks eval_gold.py until you delete it."""
    keys = ("subject", "relation", "object", "effect", "stance", "quote")
    return {"pmid": result["pmid"], "draft": True, "claims": [{k: c[k] for k in keys} for c in result["kept"]]}


def main() -> None:
    args = sys.argv[1:]
    draft = "--draft" in args
    force = "--force" in args
    pmids = [a for a in args if not a.startswith("--")]
    provider, model, api_key = llm.pick_provider()
    print(f"Provider: {provider} ({model})")
    if provider == "anthropic":
        print("Note: dev-only provider. The real submission run must use OpenAI (prize requirement).")

    files = [RAW_DIR / "pubmed" / f"{p}.json" for p in pmids] or sorted((RAW_DIR / "pubmed").glob("*.json"))
    drafts = []
    for f in files:
        pmid = f.stem
        out_path = EXTRACTED_DIR / f"{pmid}.json"
        if out_path.exists() and not force and not draft:
            print(f"{pmid}: already extracted, skipping (use --force to redo)")
            continue
        if not f.exists():
            print(f"{f.name}: not in the raw cache; run fetch_pubmed.py first")
            continue
        rec = json.loads(f.read_text(encoding="utf-8"))
        if not rec.get("abstract"):
            continue
        result = extract_one(provider, model, api_key, rec)
        save_json(out_path, result)
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
