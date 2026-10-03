"""Turn kept extraction claims (data/extracted/*.json) into tier B edges + evidence.

    python merge_extracted.py              # every file in data/extracted
    python merge_extracted.py 12345678     # only this PMID

Does NOT touch data/seed/graph.json (that file is P1's; coordinate before merging).
Instead it writes a proposal for a human to review and fold in:
    data/extracted/merge_proposal.json   {new_nodes, new_edges, new_evidence, evidence_for_existing_edges}
    data/extracted/merge_log.jsonl       every model-made reconciliation decision, one per line

Reconciliation, in order:
1. Exact name/synonym match against existing seed nodes of the right type.
2. Contextual candidates: nodes of the right type that already have a real edge of this
   same relation from the resolved subject disease (in the seed, or created earlier in this
   run) -- i.e. an actual prior claim already connects them, not just similar wording.
   Ranked by name similarity, sent to the model with a "none" option.
3. Only if there is no context at all (a disease never linked to that node type before):
   a strict global name-similarity fallback (>= STRICT_SIM), so near-duplicate phrasing of
   the same thing still reconciles. Below that, straight to a new node -- no model call,
   no guess by shared vocabulary alone (e.g. two unrelated mechanisms both called "gain of
   function" must NOT be offered as candidates for each other).
Owner: P2.
"""
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

import llm
from common import EXTRACTED_DIR, RAW_DIR, SEED_FILE, load_seed, save_json

CONTRACT = json.loads((Path(__file__).resolve().parent.parent / "contract" / "contract.json").read_text(encoding="utf-8"))
EDGE_TYPES = CONTRACT["edge_types"]
TOP_K = 5
STRICT_SIM = 0.8  # only used when there is no graph context at all to lean on

CHOOSE_TOOL = {
    "name": "choose_node",
    "description": "Pick which existing graph node (if any) this phrase refers to.",
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["choice"],
        "properties": {"choice": {"type": "string", "description": "1-5 for a candidate, or 'none' if the phrase is a new entity not in the list"}},
    },
}

CHOOSE_SYSTEM = (
    "You are reconciling a phrase extracted from a scientific abstract against existing nodes in a "
    "rare-disease knowledge graph. Given the phrase and up to 5 candidate nodes (name plus known synonyms), "
    "choose the candidate the phrase refers to, or 'none' if it is a distinct entity not already in the list. "
    "Use only the information given; do not guess from outside knowledge."
)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def slugify(s: str, max_len: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
    return slug[:max_len].strip("_") or "x"


def similarity(text: str, node: dict) -> float:
    target = norm(text)
    return max(SequenceMatcher(None, target, norm(name)).ratio() for name in [node["name"], *node.get("synonyms", [])])


def build_exact_index(nodes: list[dict]) -> dict[str, dict[str, str]]:
    """type -> {normalized name-or-synonym: node_id}."""
    idx: dict[str, dict[str, str]] = {}
    for n in nodes:
        bucket = idx.setdefault(n["type"], {})
        for text in [n["name"], *n.get("synonyms", [])]:
            bucket.setdefault(norm(text), n["id"])
    return idx


def rank(text: str, candidate_nodes: list[dict], k: int = TOP_K) -> list[dict]:
    scored = sorted(candidate_nodes, key=lambda n: -similarity(text, n))
    return scored[:k]


def ask_model(text: str, node_type: str, candidates: list[dict], provider, model, api_key, log: list, calls: list) -> str | None:
    """Returns a chosen node id, or None for 'none' / no usable answer."""
    listing = "\n".join(f"{i + 1}. {c['name']} (synonyms: {', '.join(c.get('synonyms', [])) or 'none'})" for i, c in enumerate(candidates))
    user = f"Phrase: \"{text}\"\nNode type: {node_type}\nCandidates:\n{listing}"
    out = llm.call_structured(provider, model, api_key, CHOOSE_SYSTEM, user, CHOOSE_TOOL)
    calls.append(1)
    choice = str(out.get("choice", "")).strip().lower()
    log.append({"phrase": text, "node_type": node_type, "candidates": [c["id"] for c in candidates], "model_choice": choice})
    if choice in {"1", "2", "3", "4", "5"} and int(choice) <= len(candidates):
        return candidates[int(choice) - 1]["id"]
    return None


def new_node_proposal(text: str, node_type: str) -> dict:
    return {"id": slugify(f"{node_type}_{text}"), "type": node_type, "name": text, "synonyms": [], "ext_ids": {}, "props": {"source": "extracted", "status": "needs_review"}}


def resolve_subject(text: str, exact_idx, nodes_by_type, all_nodes, provider, model, api_key, cache, log, calls) -> tuple[str | None, dict | None]:
    """Disease subject: no graph context to anchor on, so require a strict similarity floor before asking."""
    key = ("disease", norm(text))
    if key in cache:
        return cache[key]
    exact = exact_idx.get("disease", {}).get(norm(text))
    if exact:
        return cache.setdefault(key, (exact, None))

    candidates = [n for n in rank(text, nodes_by_type.get("disease", [])) if similarity(text, n) >= STRICT_SIM]
    if not candidates:
        return cache.setdefault(key, (None, new_node_proposal(text, "disease")))

    chosen = ask_model(text, "disease", candidates, provider, model, api_key, log, calls)
    result = (chosen, None) if chosen else (None, new_node_proposal(text, "disease"))
    return cache.setdefault(key, result)


def resolve_object(text: str, node_type: str, subj_id: str, relation: str, exact_idx, nodes_by_type, all_nodes,
                    adjacency: dict, provider, model, api_key, cache, log, calls) -> tuple[str | None, dict | None]:
    """Gene/mechanism/phenotype object: prefer nodes an actual edge already connects to this disease."""
    key = (node_type, subj_id, relation, norm(text))
    if key in cache:
        return cache[key]
    exact = exact_idx.get(node_type, {}).get(norm(text))
    if exact:
        return cache.setdefault(key, (exact, None))

    contextual_ids = adjacency.get((subj_id, relation), set())
    contextual_nodes = [all_nodes[i] for i in contextual_ids if all_nodes.get(i, {}).get("type") == node_type]

    if contextual_nodes:
        candidates = rank(text, contextual_nodes)
    else:
        candidates = [n for n in rank(text, nodes_by_type.get(node_type, [])) if similarity(text, n) >= STRICT_SIM]

    if not candidates:
        return cache.setdefault(key, (None, new_node_proposal(text, node_type)))

    chosen = ask_model(text, node_type, candidates, provider, model, api_key, log, calls)
    result = (chosen, None) if chosen else (None, new_node_proposal(text, node_type))
    return cache.setdefault(key, result)


def main() -> None:
    args = sys.argv[1:]
    pmids = args or None

    seed = load_seed(SEED_FILE)
    nodes_by_type: dict[str, list[dict]] = {}
    all_nodes: dict[str, dict] = {}
    for n in seed["nodes"]:
        nodes_by_type.setdefault(n["type"], []).append(n)
        all_nodes[n["id"]] = n
    exact_idx = build_exact_index(seed["nodes"])
    existing_edge_keys = {(e["type"], e["src"], e["dst"]): e["id"] for e in seed["edges"]}
    adjacency: dict[tuple, set] = {}
    for e in seed["edges"]:
        adjacency.setdefault((e["src"], e["type"]), set()).add(e["dst"])

    provider, model, api_key = llm.pick_provider()
    print(f"Reconciliation provider: {provider} ({model})")
    if provider == "anthropic":
        print("Note: dev-only provider for reconciliation too.")

    files = [EXTRACTED_DIR / f"{p}.json" for p in pmids] if pmids else sorted(EXTRACTED_DIR.glob("*.json"))
    files = [f for f in files if f.name != "merge_proposal.json"]

    cache: dict = {}
    log: list = []
    new_nodes: dict[str, dict] = {}
    new_edges: dict[tuple, dict] = {}
    new_evidence: list[dict] = []
    evidence_for_existing: list[dict] = []
    calls: list = []

    for f in files:
        if not f.exists():
            print(f"{f.name}: not found, skipping")
            continue
        result = json.loads(f.read_text(encoding="utf-8"))
        pmid = result["pmid"]
        raw = RAW_DIR / "pubmed" / f"{pmid}.json"
        retrieved_at = json.loads(raw.read_text(encoding="utf-8"))["retrieved_at"][:10] if raw.exists() else None

        for claim in result.get("kept", []):
            to_type = EDGE_TYPES[claim["relation"]]["to"]
            subj_id, subj_new = resolve_subject(claim["subject"], exact_idx, nodes_by_type, all_nodes, provider, model, api_key, cache, log, calls)
            if subj_new:
                all_nodes[subj_new["id"]] = subj_new
            subj_id = subj_id or subj_new["id"]

            obj_id, obj_new = resolve_object(claim["object"], to_type, subj_id, claim["relation"], exact_idx, nodes_by_type, all_nodes, adjacency, provider, model, api_key, cache, log, calls)
            if obj_new:
                all_nodes[obj_new["id"]] = obj_new
            obj_id = obj_id or obj_new["id"]

            for new_node in (subj_new, obj_new):
                if new_node and new_node["id"] not in new_nodes:
                    new_nodes[new_node["id"]] = new_node

            edge_key = (claim["relation"], subj_id, obj_id)
            edge_id = existing_edge_keys.get(edge_key) or new_edges.get(edge_key, {}).get("id")
            is_new_edge = edge_id is None
            if is_new_edge:
                edge_id = slugify(f"e_{claim['relation']}_{subj_id}_{obj_id}")
                new_edges[edge_key] = {
                    "id": edge_id, "src": subj_id, "dst": obj_id, "type": claim["relation"],
                    "tier": "B", "confidence": claim.get("confidence"), "stance": claim["stance"],
                    "status": "unverified", "note": f"Extracted from PMID {pmid} ({provider}/{model}); pending curator review.",
                }
            adjacency.setdefault((subj_id, claim["relation"]), set()).add(obj_id)  # this run's claims become context for later ones

            ev = {
                "id": slugify(f"ev_{edge_id}_{pmid}_{len(new_evidence) + len(evidence_for_existing)}"),
                "edge_id": edge_id, "source_type": "pubmed", "source_url": claim["source_url"],
                "pmid": pmid, "snippet": claim["quote"], "retrieved_at": retrieved_at,
            }
            (new_evidence if is_new_edge else evidence_for_existing).append(ev)

    proposal = {
        "new_nodes": list(new_nodes.values()),
        "new_edges": list(new_edges.values()),
        "new_evidence": new_evidence,
        "evidence_for_existing_edges": evidence_for_existing,
    }
    save_json(EXTRACTED_DIR / "merge_proposal.json", proposal)
    (EXTRACTED_DIR / "merge_log.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in log) + ("\n" if log else ""), encoding="utf-8"
    )

    print(f"\n{len(calls)} reconciliation call(s) made.")
    print(f"Proposal: {len(new_nodes)} new nodes, {len(new_edges)} new edges, {len(new_evidence)} new evidence rows, "
          f"{len(evidence_for_existing)} evidence rows attached to existing edges.")
    print(f"Written to {EXTRACTED_DIR / 'merge_proposal.json'} and {EXTRACTED_DIR / 'merge_log.jsonl'}.")
    print("This does not touch data/seed/graph.json. Review the proposal (and the log) before merging it in with P1.")


if __name__ == "__main__":
    main()
