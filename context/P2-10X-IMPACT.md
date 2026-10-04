# 10× impact: a concrete milestone, not a slogan

Drafted by P2 (ai/graph) because nobody had started this yet and it is a named judging
criterion. This is a draft for the team (P4 owns the final 10x slide/story) -- every number
below is explicitly labelled as an assumption to validate, per `context/00-PROJECT.md`'s own
rule, not a cited statistic. Grounded entirely in real nodes/edges already in `data/seed/graph.json`
-- nothing here is invented.

## The milestone

Per the brief: *"Choose a meaningful milestone toward a possible treatment, such as launching
a shared natural history study."* The milestone here is narrower and more honest than that:
**a patient-group leader for an underserved disease in this slice identifies a concrete,
named, currently-active research resource to approach about extending or adapting its design
to their condition** -- the step that has to happen *before* anyone can "launch" anything.

## The case: SCN2A-related neonatal-onset epilepsy subgroup

`dis_scn2a_neonatal_epilepsy` is real in this graph and genuinely underserved within this
slice: it has **zero** `asset_disease`, `study_disease` or `group_disease` edges -- no
registry, no study, no patient organization listed. It has only two edges: `disease_gene` to
SCN2A, and `disease_mechanism` to "Voltage-gated sodium channel gain of function" (tier B,
PMID 38651838) -- the mechanism link that makes the bridge below possible.

That mechanism node is also where `dis_scn8a` (SCN8A-DEE) and `dis_scn2a_dee` (DEE11) sit --
confirmed by `pipeline/cluster.py` (same cluster) and now by `pipeline/bridge_edges.py`'s
`shares_mechanism_with` edge between the neonatal-onset subgroup and SCN8A-DEE, confidence
0.95 (Jaccard over each disease's full mechanism-link set -- see that script's docstring for
the rule). Both of those diseases have real, named resources already in the graph:

- **`dis_scn2a_dee`** has an NIH-funded asset, *"Multi-scale disease modeling of SCN2A-related
  epilepsy due to gain-of-function variants"* (https://reporter.nih.gov/project-details/11317220)
  -- a project explicitly modeling the same gain-of-function mechanism this subgroup shares.
- **`dis_scn8a`** has an active clinical trial, *PRAX-562* (NCT05818553, status
  `ACTIVE_NOT_RECRUITING` as of this snapshot), for developmental and epileptic
  encephalopathies broadly.

Neither of these was built for the neonatal-onset subgroup. Both are candidates worth a direct
question: *does this mechanism model or this trial's eligibility criteria extend to our
variants?*

## Existing timeline vs. the atlas's route

| Step | Without the atlas (assumption) | With the atlas (measured, this session) |
|---|---|---|
| Realize no registry/study exists for your subgroup | Months -- literature search, conference networking, asking around; rare-disease patient-group founding accounts commonly describe this as a multi-month-to-multi-year phase (**assumption, not a cited statistic -- needs a real baseline source before this goes in a slide**) | Immediate -- `coverage_report.py`'s no-route logic shows this explicitly when nothing supported exists |
| Discover a same-mechanism disease with usable infrastructure | Requires already knowing sodium-channel electrophysiology well enough to search for it, or a lucky conference conversation | Same session -- `cluster.py` + `bridge_edges.py` surface it automatically from existing verified edges, confidence-scored (0.95 here) |
| Identify a specific, named, currently real resource to approach | Separate search per candidate disease, per source (PubMed, NIH RePORTER, ClinicalTrials.gov) | Same session -- both resources above are already graph nodes with real URLs, cited, one click away |
| Get a concrete next action | Self-directed, often "keep researching" | `explain.py`/the action-plan view turns this into a specific instruction: which resource, which question to ask |

**The honest 10× claim is scoped to the discovery phase**, not the whole milestone. Baseline
"how long until a patient-group leader even knows this mechanism model and this trial exist"
is plausibly measured in months; the atlas's answer is same-session. That is comfortably more
than 10x on the piece it actually shortens. It is **not** a claim that the atlas launches a
study, secures funding, or gets IRB approval 10x faster -- those steps are untouched by this
tool and still take as long as they take.

## What would need to be validated next

1. A real baseline number for "time to discovery" from an actual patient-group founder account
   or a published source, to replace the assumption above with a cited figure.
2. Confirmation from the NIH-funded modeling project's team and the PRAX-562 trial sponsor that
   the neonatal-onset subgroup's variants are in scope -- the graph states what exists, not
   that eligibility or interest is confirmed (the asset's own `scope_note` already says this).
3. Whether `dis_scn2a_neonatal_epilepsy`'s apparent lack of any registry is a real gap or a gap
   in this slice's source coverage -- `coverage.json`'s limitations section already flags that
   a missing edge is not evidence of absence.

## Why this example, not STXBP1

The STXBP1 demo path (the primary journey) is already well-resourced in this slice --12
`study_disease` edges, a foundation, RARE-X, STARR. It is the right path to demonstrate the
full product experience, but it is the wrong example for a 10× *discovery* story: a group that
already has a dozen visible resources was never the hard case. The neonatal-onset subgroup,
with zero resources of its own, is.
