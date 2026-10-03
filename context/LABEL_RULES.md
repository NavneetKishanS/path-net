# Label rules for extraction (owner: P2)

These are the only labels the model may output and the only ones you use when hand-labelling the gold set. The same text is in `pipeline/labels.py` (the model prompt) and `contract/contract.json` (the allowed values). If you change a rule, change all three and tell P4.

One rule above all: **label only what the text says.** Not what you know about the disease.

## Relations
| relation | Means | subject | object |
|---|---|---|---|
| `disease_gene` | the disease is caused by, or associated with, variants in a gene | the disease | the gene symbol |
| `disease_mechanism` | how the variants cause the disease | the disease | a short phrase for the mechanism |
| `disease_phenotype` | a clinical feature of the disease | the disease | the feature, as written |

The subject is always a disease or condition named in the text. If a sentence names none, skip it.
Anything that fits none of the three relations (treatment results, epidemiology, methods): skip it.

## effect (only for `disease_mechanism`; everything else is `not_applicable`)
| effect | Use when the text says |
|---|---|
| `loss_of_function` | the variant reduces or removes the protein or its activity (haploinsufficiency, truncating variants) |
| `gain_of_function` | the variant increases activity or creates a new, harmful activity |
| `dominant_negative` | the mutant protein interferes with the normal copy |
| `unknown` | the mechanism is unclear, or the text does not state one. Never guess |

## stance
| stance | Use when the sentence |
|---|---|
| `supports` | asserts the relation |
| `contradicts` | says the relation does not hold, or reports a different one than expected |
| `neutral` | only mentions or hypothesises it ("may", "could", "we propose") |

## quote
Copy exactly one sentence from the abstract, character for character. A paraphrase fails the verbatim check. If one sentence states two relations, write two claims with the same quote.

## Tricky cases
These sentences are invented to show the rule. They are not from any paper.

| Sentence | Label |
|---|---|
| "Variants in GENE_X cause Example syndrome." | `disease_gene`, effect `not_applicable`, `supports`. subject Example syndrome, object GENE_X |
| "Truncating variants lead to haploinsufficiency in Example syndrome." | `disease_mechanism`, `loss_of_function`, `supports` |
| "Whether the variants act by loss or gain of function remains unclear." | `disease_mechanism`, `unknown`, `neutral` |
| "We found no evidence that GENE_X variants cause Example syndrome." | `disease_gene`, `contradicts` |
| "Patients with Example syndrome show seizures and hypotonia." | two `disease_phenotype` claims, same quote: seizures, hypotonia |
| "Example syndrome may be caused by dominant-negative effects." | `disease_mechanism`, `dominant_negative`, `neutral` (hedged) |
| "Mutations impair protein function." (no disease named) | skip |
| "Patients responded to treatment Y." | skip (not one of the three relations) |

When two labels both seem right, pick the weaker one (`unknown`, `neutral`) and move on. Consistency matters more than getting every edge case right.
