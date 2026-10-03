"""The closed label set for extraction and for scoring against the gold set.

Single source of truth: the "extraction" block in contract/contract.json.
Human-readable rules: context/LABEL_RULES.md (keep the wording in sync with RULES below).
"""
import json
import os
from pathlib import Path

CONTRACT_FILE = Path(os.environ.get("CONTRACT_FILE", Path(__file__).resolve().parent.parent / "contract" / "contract.json"))
_c = json.loads(CONTRACT_FILE.read_text(encoding="utf-8"))

RELATIONS: list[str] = _c["extraction"]["relations"]
EFFECTS: list[str] = _c["extraction"]["effects"]
STANCES: list[str] = _c["stances"]
# The object type follows from the relation (subject is always a disease).
OBJECT_TYPE: dict[str, str] = {r: _c["edge_types"][r]["to"] for r in RELATIONS}

RULES = """\
Task: extract claims from ONE abstract. Output only claims the text states.

Relations (use exactly these, otherwise skip the sentence):
- disease_gene: a disease or condition is caused by, or associated with, variants in a gene. subject = the disease, object = the gene symbol.
- disease_mechanism: how variants cause the disease. subject = the disease, object = a short phrase naming the mechanism or process.
- disease_phenotype: a clinical feature of the disease. subject = the disease, object = the feature as written.
The subject is always a disease or condition named in the text. If a sentence names no disease or condition, skip it.

effect (only for disease_mechanism; use not_applicable for the other two relations):
- loss_of_function: the variant reduces or removes the protein or its activity (haploinsufficiency, truncating variants).
- gain_of_function: the variant increases activity or creates a new, harmful activity.
- dominant_negative: the mutant protein interferes with the normal copy.
- unknown: the text says the mechanism is unclear or does not state one. Never guess.

stance:
- supports: the sentence asserts the relation.
- contradicts: the sentence says the relation does not hold, or reports a different one.
- neutral: the sentence only mentions or hypothesises it.

quote: copy ONE sentence from the abstract exactly as written. If a sentence states two relations, write two claims with the same quote.
Use only what the text says. Do not add outside knowledge.
"""
