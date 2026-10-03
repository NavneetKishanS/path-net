# web/ (owner: P3)

Next.js App Router + React + TypeScript (strict). Graph drawn with Cytoscape.js (fcose layout), loaded on demand.

- `src/api.ts` is the only place that fetches data. Keep `loadGraph()` and its return type. `createApiClient()` picks the adapter from `NEXT_PUBLIC_DATA_SOURCE` (`mock` default, `static`, `rest`); the REST URL is `NEXT_PUBLIC_API_URL` (`VITE_*` names are still read).
- `src/types.ts` mirrors `contract/contract.json`. Update it when the contract changes. UI types live in `src/lib/model.ts`.
- The mock adapter reads the pinned P1 slice in `src/data/slice/`. Do not hand-edit citations there.
- Roles are lenses, set by `?role=`. Panels per role live in `src/lib/roles.ts`; components ask `useRole()`. Component usage: `src/components/README.md`.
- Run: `npm run dev` (port 5173), `bash run.sh web`, or `bash run.sh up` (Docker, REST API). Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npx playwright test`.
- Mark tier C edges as inferred. Never show an edge without a way to reach its evidence.
- Full role brief: `context/roles/P3-frontend.md`. Plan: `docs/frontend/plan.md`. Demo: `docs/frontend/demo-script.md`.
