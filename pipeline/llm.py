"""Shared model-calling helpers: provider auto-detect and one structured-output call.

Used by extract.py (claim extraction) and merge_extracted.py (node reconciliation).
Provider is whichever key is set in .env; OPENAI_API_KEY wins if both are set, since
prize tracks require OpenAI for the real run. ANTHROPIC_API_KEY is for local dev only.
EXTRACT_PROVIDER=openai|anthropic overrides the auto-detect. Owner: P2.
"""
import json
import os
import sys


def pick_provider() -> tuple[str, str, str]:
    """Return (provider, model, api_key)."""
    override = os.environ.get("EXTRACT_PROVIDER", "").strip().lower()
    have_openai = bool(os.environ.get("OPENAI_API_KEY"))
    have_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
    provider = override or ("openai" if have_openai else "anthropic" if have_anthropic else "")
    if provider == "openai":
        model = os.environ.get("OPENAI_MODEL_EXTRACT")
        if not have_openai or not model:
            sys.exit("Set OPENAI_API_KEY and OPENAI_MODEL_EXTRACT in .env first.")
        return provider, model, os.environ["OPENAI_API_KEY"]
    if provider == "anthropic":
        model = os.environ.get("ANTHROPIC_MODEL_EXTRACT")
        if not have_anthropic or not model:
            sys.exit("Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL_EXTRACT in .env first.")
        return provider, model, os.environ["ANTHROPIC_API_KEY"]
    sys.exit("Set OPENAI_API_KEY (required for the real submission run) or ANTHROPIC_API_KEY (local dev only) in .env.")


def call_structured(provider: str, model: str, api_key: str, system: str, user_content: str, tool: dict) -> dict:
    """tool: {"name", "description", "input_schema"} (JSON schema). Returns the parsed structured output."""
    if provider == "openai":
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user_content}],
            response_format={"type": "json_schema", "json_schema": {"name": tool["name"], "strict": True, "schema": tool["input_schema"]}},
        )
        return json.loads(resp.choices[0].message.content)

    import requests

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "accept-encoding": "identity",  # some sandboxed network shims mishandle compressed bodies
        },
        json={
            "model": model,
            "max_tokens": 1024,
            "system": system,
            "messages": [{"role": "user", "content": user_content}],
            "tools": [tool],
            "tool_choice": {"type": "tool", "name": tool["name"]},
        },
        timeout=60,
    )
    resp.raise_for_status()
    body = resp.json()
    tool_use = next(b for b in body["content"] if b["type"] == "tool_use")
    return tool_use["input"]
