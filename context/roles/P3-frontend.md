# P3: Frontend lead

Owner: ______________ · Sleeps 01:00 to 05:00 · Read `context/00-PROJECT.md` first.

## Mission
Make the evidence understandable to a family. Someone facing an untreated disease should see why a connection matters, what is uncertain, and who can help. Design principles from the brief: low ink and high signal, one global search, progressive reveal (summary first, depth on click), explain every edge, a patient action view.

## You own
Everything in `web/`.

## Start in 5 minutes
```bash
bash run.sh web          # no Docker: http://localhost:5173, reads data/seed/graph.json
# or
bash run.sh up           # Docker: db + api + web, reads the REST API
```
What already works: search with synonyms, force graph colored by cluster, node panel, edge evidence panel, a no-route panel, a role dropdown that only changes a label.

## The one rule about data
`web/src/api.ts` is the only file that knows where data comes from. Keep `loadGraph(): Promise<Graph>` and the types in `web/src/types.ts`. Later P4 adds a Supabase branch in that file; nothing else in the UI should change.

## Tool choice (decide at M0)
- **Default:** keep building in `web/` with Claude Code. It already runs and has no sync problems.
- **If you prefer Lovable:** generate in Lovable, sync to GitHub, then copy its `src/` components into `web/src/`. Keep `api.ts` and `types.ts`. Do not let Lovable overwrite `api.ts`. Paste this prompt in Lovable: "Build a single-page app with a top search box, a force-directed graph (react-force-graph-2d) on the left and a side panel on the right. Data comes from loadGraph() in src/api.ts returning {nodes, edges, evidence, clusters, node_cluster}. Clicking an edge shows source link, quote, tier badge A to D, confidence and contradicting evidence. Include a 'No supported route' state. Low ink, high signal."

## Checklist
**M0 (Sat 20:30)**
- [ ] Run the app and read `App.tsx`, `GraphView.tsx`, `Panels.tsx`. They are short.
- [ ] Decide Lovable or `web/` (above). Agree the Graph type with P4.

**M1 (to 01:00)**
- [ ] Autocomplete over names and synonyms (suggestions exist; polish them).
- [ ] Graph readability: labels, cluster colors, bridge nodes, dashed inferred edges, red contradicting edges (all started).
- [ ] Edge panel shows source link, tier badge, confidence, snippet. Placeholder and missing evidence are visible.

**M2 (01:00 to 05:00, asleep)** Leave `main` deployable. Write your handoff note first.

**M3 (05:00 to 10:00)**
- [ ] Four role home views: Devon (plain language, `props.plain`, read-aloud), Maria (cluster map, reuse checklist), Priya (ranked clusters by mechanism), Osei (collaborators).
- [ ] Action view: reusable asset, partner or group, next step, and the expert-review questions.
- [ ] Real no-route screen from P4's coverage report.
- [ ] Progressive reveal. Check every screen at phone width.

**M4 (10:00 to 13:00)**
- [ ] Loading, empty and error states. Keyboard and contrast pass.
- [ ] Screenshots for the README and the video.

## Rules
- Never show a connection without a way to reach its evidence.
- Hypotheses (tier C) are always visibly labelled as inferred.
- Do not hard-code data in components. Everything comes through `loadGraph()`.

## Done means
The demo journey works for each persona on a phone and a laptop, with no console errors.

## Prompt to paste into Claude Code
"I am P3 (frontend) on PathNet. Read context/00-PROJECT.md and context/roles/P3-frontend.md. Add the four role home views and an action view to web/. Keep data access inside src/api.ts. Mark inferred (tier C) edges clearly and never show an edge without a path to its evidence."
