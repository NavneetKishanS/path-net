# Frontend plan (P3, branch `feat/frontend-atlas`)

The brief's bar: "Demonstrate one complete journey from disease to connection to shared action." The frontend is one app shell and one shared component library, composed per role by a typed config. Roles are lenses over the same data, not security boundaries.

## 1. Stack (versions verified on npm, 4 Oct 2026)

| Concern | Choice | Version | Note |
|---|---|---|---|
| Framework | Next.js App Router | 16.3 | Turbopack default; `next lint` removed, so ESLint runs directly |
| UI runtime | React | 19.3 | |
| Language | TypeScript, strict | 6.0.3 | TS 7.0 is out, but `typescript-eslint` 8.71 supports only `<6.1`, so we pin 6.0 |
| Styling | Tailwind CSS v4, tokens as CSS variables | 4.3 | CSS-first `@theme` config |
| Primitives | Radix via `radix-ui`, shadcn-pattern components written into `src/components/ui` | 1.6 | The shadcn CLI needs its registry; we copy the pattern, not the default look |
| Motion | `motion` | 14 | `MotionConfig reducedMotion="user"` |
| Graph | Cytoscape.js + `cytoscape-fcose` | 3.34 | Rationale in section 5 |
| Data | TanStack Query | 5.104 | |
| Client state | Zustand (admin review decisions, synonym edits, threshold) | 5.0 | |
| URL state | nuqs | 2.10 | `role`, `q`, `node`, `edge`, `focus` |
| Tests | Vitest 5 (role config, data adapter, engine), Playwright 1.63 (journeys) | | |
| Lint/format | ESLint 9.39 flat config + `eslint-config-next`, Prettier 3 | | ESLint 10 is out, but the React/import/a11y plugins still peer on `^9` |
| Package manager | npm | | The repo already uses npm and `package-lock.json`; `run.sh` and `docker-compose.yml` call npm |

## 2. The data slice and why

We do not hand-write citations. P1 has delivered a verified slice on `origin/p1/data` (54 nodes, 68 edges, 76 evidence rows, every edge sourced, built reproducibly from PubMed, HPO, MONDO, Orphadata, ClinVar, ClinicalTrials.gov, NIH RePORTER and patient-organization pages, retrieved 3 Oct 2026). The mock adapter reads a **pinned copy** of it in `web/src/data/slice/` (with its `coverage.json` and PubMed titles), recorded with source commit and graph hash.

Slice: **developmental and epileptic encephalopathies around STXBP1, SCN2A, KCNQ2 and SCN8A.** It suits the brief because:

- **Two differently named diseases share a mechanism through different genes.** DEE13 (SCN8A) and the SCN2A neonatal-onset epilepsy subgroup both have cited evidence for *voltage-gated sodium channel gain of function* (PMID 34431999, PMID 38651838).
- **One gene, different mechanisms.** SCN2A R1882Q is gain of function, R853Q is loss of function (ClinVar plus functional assays), so SCN2A sits in two clusters.
- **Contradictory evidence.** PMID 37578743 refutes assigning a single gain-of-function mechanism to all SCN2A-related disorders. This qualifies the shared-mechanism route: it holds for a subgroup, not the whole community.
- **Shared assets and duplicate effort.** DRAGONFLY registry (SCN2A), STARR natural history study (STXBP1), a KCNQ2 natural history study and biorepository, and NIH-funded disease-modelling projects for both SCN2A gain of function and SCN8A.
- **A shared collaborator across "unrelated" communities.** Ingo Helbig is the NIH-listed investigator on awards covering STXBP1, SCN2A and SCN8A.
- **An honest gap.** KCNQ2 has its own community and assets, but no cited mechanism shared with another disease in the slice, so its cross-community route is "no supported route". A query outside the slice (for example `CDKL5`) returns the coverage-backed "not in this atlas" state.

**Demo persona choice.** The Patient Group Leader demo follows a leader whose condition is **DEE13 (SCN8A)**: the slice has no SCN8A patient group, which mirrors the brief's "we may be the only family with this diagnosis", and the mechanism route leads to the SCN2A community, its registry, a shared investigator and a concrete next step. P1's STXBP1 path (STXBP1 Foundation and STARR) is the Patient / Caregiver "exact community" example.

**What is computed, not curated.** Two inferred relations are derived in the client engine and always shown as inferred (dashed, amber, labelled), each listing the observed edges it was built from:
- `shares_mechanism_with`: two diseases with *supporting* evidence for the same mechanism node. Contradicting edges never count as support.
- `shares_investigator`: two diseases with the same NIH-listed investigator.
`subgroup_of` comes from P1's curated `props.parent_disease` and cites the cohort paper.

**Sample records.** Admin needs a user-contributed edge (tier D) to demonstrate review. One such record exists, has no URL, and is labelled `sample` in the data file and in the UI.

## 3. Information architecture

```
/                      Role home (picked by RoleConfig.home)
/search?q=             Global search results, synonym resolution, no-route state
/explore               Graph canvas + cluster list + table alternative; ?node= ?edge=
/disease/[id]          Disease profile: summary, closest connections, community, assets
/route?from=&to=       "Why connected": step-by-step explanation, evidence beside each step
/action/[id]           Patient action view: viable leads vs unsupported, assets, partners,
                       next experiments, draft outreach ("Do this week")
/mechanisms            Mechanism picker + ranked clusters (Biotech Scout)
/people                Investigators, shared opinion leaders, how to reach them
/funding               RePORTER-style programs and gaps
/admin                 Graph builder status, edge review queue, source coverage
```

All links carry `?role=` through `AppLink`, so a role survives navigation and a shared URL opens the same lens. Pages a role cannot use show a short "not part of this view" note with a link to the role that has it, rather than a 404.

## 4. Role config

```ts
type Role = 'leader' | 'patient' | 'scout' | 'researcher' | 'admin'
type DetailLevel = 'plain' | 'standard' | 'technical'
interface RoleConfig { label; home: HomeKind; detail: DetailLevel; panels: PanelId[] | 'all'; lite: PanelId[] }
```

`useRole()` returns `{ role, config, can(panel), isLite(panel), detail }`. Components read `detail`; pages read `can()`. The feature table in the task maps one-to-one to `panels` (Full) and `lite` (Lite). Contract roles (`group_leader`, `family`) are mapped in one place for when P4 adds row-level security.

## 5. Graph library

| | Sigma.js + graphology | Cytoscape.js | React Flow |
|---|---|---|---|
| Rendering | WebGL; best for thousands of nodes | Canvas (WebGL preview since 3.31) | DOM/SVG |
| Few hundred nodes | Smooth | Smooth (Cytoscape's own benchmarks; WebGL for 1k+) | Fine, but every node is a React component |
| Dashed edges (inferred, bridge) | Not built in; needs a custom shader program | `line-style: dashed / dotted` | SVG stroke-dasharray |
| Clusters | Colour only; layout via ForceAtlas2 | fcose layout, compound nodes, built-in centrality and path algorithms | Manual layout (d3-force) |
| Fit | Overkill rendering, missing styling | Analysis-first, styling control | Diagram editor, not a network explorer |

**Choice: Cytoscape.js with fcose layout**, lazy-loaded (`next/dynamic`, `ssr: false`) so it never touches the first paint. It gives native dashed/dotted lines for inferred and cross-cluster bridge edges, built-in degree/betweenness centrality for node size, and comfortable performance for a few hundred nodes. If the atlas grows past a few thousand nodes, its WebGL renderer is a config switch. The graph always has a table alternative (keyboard and screen-reader friendly).

## 6. Data contract

Two layers, both in `web/src`:
- `types.ts` — unchanged contract mirror (`Graph`, rows, tiers). The shape P1 ships and PostgREST serves.
- `lib/model.ts` — UI domain types required by the task: `NodeType` (camelCase, includes `investigator`, `funding`, `paper`), `Evidence { sourceType, title, url, date, snippet, stance }`, `Edge { from, to, relation, confidence: number | null, basis: 'observed' | 'inferred', evidence, tier, status, scope }`, plus `Connection`, `Route`, `ActionPlan`, `RankedCluster`, `Coverage`.

`confidence` is `number | null`: the slice has no calibrated scores yet (P2 owns scoring), and showing an invented number would be fake precision. The UI says "not scored" and leans on tier and basis.

```ts
interface ApiClient {
  meta(); search(q); getGraph(); getNode(id); getConnections(diseaseId);
  getRoute(from, to); getActionPlan(diseaseId); getCommunities(q);
  getMechanisms(); rankClustersForMechanism(mechId); getPeople(); getFunding();
  getCoverage(); getReviewQueue(); reviewEdge(id, decision); addSynonym(nodeId, s)
}
```

`createApiClient()` in `src/api.ts` (still the only file that knows where data comes from) picks:
- `mock` (default): pinned slice, in memory.
- `static`: `/graph.json` copied from `data/seed` by `scripts/copy-seed.mjs`, so the app follows whatever P1 merges.
- `rest`: PostgREST at `NEXT_PUBLIC_API_URL` (the five contract tables). Same engine, so swapping is one env var. `VITE_*` env names from docker-compose are still honoured.

## 7. Design tokens

- Paper: cool near-white, chroma 0.002 (not cream). Ink: blue-black. Hairlines instead of boxes.
- One accent: cobalt `oklch(0.50 0.14 245)`, interaction and selection only.
- Semantic: `supports` green, `inferred` amber (always dashed + labelled), `contradicts` vermilion (always labelled), four muted cluster hues.
- Type: IBM Plex Sans (UI), Source Serif 4 (titles and reading prose), IBM Plex Mono (identifiers). Scale 12/13/14/16/20/26/34.
- Space: 4px base (4, 8, 12, 16, 24, 32, 48, 72). Radius: 2/4/6. Shadows only on floating layers.
- Light and dark from the same variable names.

## 8. Component tree

```
RootLayout (fonts, ThemeProvider, NuqsAdapter, QueryProvider, MotionConfig)
└─ AppShell (header: wordmark, GlobalSearch, RoleSwitcher, ThemeToggle; DataBanner)
   ├─ homes/ LeaderHome · PatientHome · ScoutHome · ResearcherHome · AdminHome
   └─ pages compose shared components:
      GlobalSearch, SearchResults, SynonymNote
      GraphCanvas (lazy) + GraphTable + GraphLegend
      ClusterList, MechanismPicker, RankedClusters
      ConnectionList, RouteExplainer, EdgeStep
      EvidencePanel (detail-aware), CitationMarker, BasisBadge, TierBadge, StanceBadge
      NoRoute (unresolved query | no cross-community route)
      CommunityFinder, ActionView, SharedAssets, DuplicateEffort
      PeopleList (shared opinion leaders), FundingTable
      DraftOutreach, AdminStatus, ReviewQueue, SourceCoverage
```

## 9. Borrowed from references

- **Open Targets Platform evidence pages**: evidence grouped by data source beside the association; summary first, detail widget on click. Basis for `EvidencePanel`.
- **Linear**: calm-but-dense lists, hairline separators, quiet chrome, keyboard-first (`/` focuses search), reversible actions (review decisions can be undone).
- **Connected Papers**: graph and list side by side; the list is the controlled view, the graph is for discovery.
- **Monarch Initiative / HPO**: phenotype overlap shown as specific terms, with broad terms (seizure) marked as less informative than specific ones.

## 10. Build order

1. Scaffold Next.js in `web/`, tokens, shell, role config, URL state, data layer + engine + Vitest.
2. Patient Group Leader end to end: search → disease → connection route → evidence → action view → draft outreach. No-route state.
3. Patient / Caregiver: one plain search, exact community or closest related, how to help build the missing one. Phone-first.
4. Graph explorer + clusters + table alternative.
5. Biotech Scout (mechanism ranking) and Researcher (people, funding).
6. Admin: builder status, review queue, coverage.
7. Playwright journeys, docs, demo script, anti-pattern review.

## 11. Assumptions and conflicts to flag

- `web/CLAUDE.md` and the role brief describe React + Vite with `react-force-graph-2d`; the task asks for Next.js. I follow the task and keep `loadGraph()` and the `api.ts`/`types.ts` rule. `npm run dev` stays on port 5173 and accepts the `--host` flag docker-compose passes.
- Contract roles are `family`/`group_leader`; the task uses `patient`/`leader`. The UI uses the task's ids, mapped to contract ids in one place. Contract node types `patient_group`/`person` map to `patientGroup`/`investigator`.
- The contract has no confidence scores in the slice; see section 6.
- The brief and team context mention row-level security for roles; the task says roles are lenses with no auth. The frontend does not enforce anything; P4 owns RLS.
- `contract/` and `data/` are not edited. The pinned slice lives under `web/`.
