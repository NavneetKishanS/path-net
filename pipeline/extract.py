"""Extract claims from cached abstracts with OpenAI, keeping only claims whose quote is verbatim.

    python extract.py                 # all files in data/raw/pubmed
    python extract.py 12345678        # one PMID

Needs OPENAI_API_KEY and OPENAI_MODEL_EXTRACT in .env. Output: data/extracted/<pmid>.json
Owner: P2. This is a starting point: tune the prompt on the gold set, then freeze it.
"""
import json
import os
import re
import sys

from common import EXTRACTED_DIR, RAW_DIR, save_json

SYSTEM = (
    "You extract rare-disease claims from one abstract. Return only claims that the text states. "
    "For every claim, quote the exact sentence from the abstract. Never infer beyond the text."
)

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
                    "required": ["subject_type", "subject", "relation", "object_type", "object", "effect", "stance", "quote", "confidence"],
                    "properties": {
                        "subject_type": {"type": "string"},
                        "subject": {"type": "string"},
                        "relation": {"type": "string", "description": "an edge type from contract/contract.json"},
                        "object_type": {"type": "string"},
                        "object": {"type": "string"},
                        "effect": {"type": "string", "enum": ["loss_of_function", "gain_of_function", "dominant_negative", "unknown", "not_applicable"]},
                        "stance": {"type": "string", "enum": ["supports", "contradicts", "neutral"]},
                        "quote": {"type": "string"},
                        "confidence": {"type": "number"},
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


def extract_one(client, model: str, rec: dict) -> dict:
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"PMID {rec['pmid']}\nTitle: {rec['title']}\nAbstract: {rec['abstract']}"},
        ],
        response_format={"type": "json_schema", "json_schema": SCHEMA},
    )
    claims = json.loads(resp.choices[0].message.content)["claims"]
    text = f"{rec['title']} {rec['abstract']}"
    kept = [c for c in claims if verify_quote(c["quote"], text)]
    for c in kept:
        c["pmid"] = rec["pmid"]
        c["source_url"] = rec["url"]
    return {"pmid": rec["pmid"], "kept": kept, "dropped": len(claims) - len(kept)}


def main() -> None:
    from openai import OpenAI

    model = os.environ.get("OPENAI_MODEL_EXTRACT")
    if not os.environ.get("OPENAI_API_KEY") or not model:
        sys.exit("Set OPENAI_API_KEY and OPENAI_MODEL_EXTRACT in .env first.")
    client = OpenAI()
    files = sorted((RAW_DIR / "pubmed").glob("*.json"))
    if len(sys.argv) > 1:
        files = [RAW_DIR / "pubmed" / f"{sys.argv[1]}.json"]
    for f in files:
        rec = json.loads(f.read_text(encoding="utf-8"))
        if not rec.get("abstract"):
            continue
        result = extract_one(client, model, rec)
        save_json(EXTRACTED_DIR / f"{rec['pmid']}.json", result)
        print(f"{rec['pmid']}: kept {len(result['kept'])}, dropped {result['dropped']} (quote not verbatim)")


if __name__ == "__main__":
    main()
