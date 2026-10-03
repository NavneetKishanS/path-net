# pipeline/ (owners: P1 fetchers, P2 extraction and clustering)

Offline Python. Scripts read and write under `data/` (see `common.py`).

- `fetch_pubmed.py`: caches abstracts to `data/raw/pubmed/`.
- `extract.py`: OpenAI structured extraction; keeps only claims with a verbatim quote.
- `cluster.py`: mechanism and phenotype clustering on the seed graph.
- `load_seed.py`: loads `data/seed/graph.json` into Postgres. Safe to re-run.
- Never invent identifiers, URLs or quotes. Cache everything so the demo needs no live API.
- Role briefs: `context/roles/P1-data.md`, `context/roles/P2-ai-graph.md`.
