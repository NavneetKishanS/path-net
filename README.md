# PathNet: AI Atlas for the World's Rare Diseases

Hack-Nation × OpenAI × Buffalo Initiative, Challenge 05. A mechanism-first knowledge graph that takes a patient-group leader from a disease to a cited connection, an existing asset, a collaborator and a concrete next step. When no supported route exists, it says so.

Status: **prototype v0**. The graph data is placeholder (Gene A, Disease 1, ...) until P1 loads the real slice. See `context/00-PROJECT.md` for the plan.

## Run it

Needs Docker Desktop.

```bash
bash run.sh up          # first run creates .env, builds, seeds the graph
# open http://localhost:5173
```

Other commands: `bash run.sh down`, `bash run.sh reset` (wipe the database), `bash run.sh seed`, `bash run.sh logs`, `bash run.sh smoke`.

No Docker? Run the web app alone on the seed file:

```bash
bash run.sh web         # cd web && npm install && npm run dev
```

| Service | URL | What |
|---|---|---|
| web | http://localhost:5173 | React app (Vite) |
| api | http://localhost:3001 | PostgREST over Postgres (`/nodes`, `/edges`, `/evidence`) |
| db | localhost:54322 | Postgres 16, user `postgres`, password `postgres`, db `pathnet` |

## Layout

```
web/         React + Vite app. src/api.ts is the only file that knows where data comes from.
pipeline/    Python: fetch sources, extract claims (OpenAI), cluster, load the seed into Postgres.
supabase/    SQL migrations (graph tables now, roles + RLS later).
contract/    contract.json: shared enums (node types, edge types, tiers, roles).
data/seed/   graph.json: the graph the app shows. The format is in contract/README.md.
context/     Project brief and one file per role. Read yours first.
scripts/     setup.sh, smoke.sh
```

## Architecture (short)

Sources (PubMed, ClinicalTrials.gov, RePORTER, HPO/MONDO/ClinVar/Orphadata, patient-group sites) → offline Python pipeline (fetch, normalize, extract with OpenAI, reconcile, score, cluster, explain) → Postgres/Supabase graph with row-level security → React app. Every edge carries a source, a quote, an evidence tier and a confidence.

## How to reproduce the dataset

To be completed by P1 and P4 before submission: the exact commands that rebuild `data/seed/graph.json` from the public sources. The pipeline scripts live in `pipeline/`.
