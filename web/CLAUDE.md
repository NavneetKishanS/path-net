# web/ (owner: P3)

React + Vite + TypeScript. Graph drawn with react-force-graph-2d.

- `src/api.ts` is the only place that fetches data. Keep `loadGraph()` and its return type.
- `src/types.ts` mirrors `contract/contract.json`. Update it when the contract changes.
- Run with `bash run.sh web` (static seed) or `bash run.sh up` (Docker, REST API). Build check: `npm run build`.
- Mark tier C edges as inferred. Never show an edge without a way to reach its evidence.
- Full role brief: `context/roles/P3-frontend.md`.
