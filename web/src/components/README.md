# Component library

One shell, one set of components, composed per role. Pages never branch on a role id; they ask the role lens.

## The role lens

```tsx
const { role, config, detail, can, isLite } = useRole()

if (!can('funding')) return null // panel not in this role
const compact = isLite('people') // reduced form of a panel
;(detail === 'plain') | 'standard' | 'technical'
```

- Role config lives in `src/lib/roles.ts` (`ROLE_CONFIG`). Add or remove a panel there, not in components.
- `?role=` is the source of truth. Use `AppLink` (or `useHref()`) for internal links so the lens survives navigation.
- Wrap a whole page in `<Gate panel="action" what="The action plan">` to show the "not part of this view" note instead of the page.

## Evidence (`evidence/`)

| Component                                                                                     | Use                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CitationMarker edge`                                                                         | Inline chip naming the source (PMID, NCT, RePORTER, host). Opens the evidence drawer via `?edge=`. Every claim on screen gets one.                                                                                        |
| `EvidencePanel edge from to`                                                                  | Evidence for one edge at the current `detail`. Plain: a sentence and the source. Standard: basis, scope, quotes. Technical: tier, status, confidence, ids, raw rows. Shows contradicting evidence beside mechanism links. |
| `EvidenceDrawer`                                                                              | Mounted once in the shell. Do not mount it again.                                                                                                                                                                         |
| `BasisBadge`, `ContradictsBadge`, `TierBadge`, `SampleBadge`, `StatusBadge`, `SupportedBadge` | State labels. Each pairs colour with a word or line pattern.                                                                                                                                                              |

## Atlas views (`atlas/`, `action/`, `scout/`, `research/`, `admin/`)

| Component                                     | Use                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `DiseaseOverview id`                          | Condition page: gene, mechanism, community, Do this week, connections, mini map, symptoms.                     |
| `ConnectionList fromId connections`           | Ranked connections with the ranking rule printed under the list.                                               |
| `RouteExplainer route`                        | "Why connected": numbered cited steps, evidence beside the selected step, limits, differences, open questions. |
| `NoRouteState noRoute? query? coverage`       | Honest empty state: what was searched, what is missing, what would answer it.                                  |
| `CommunityFinder diseaseId`                   | Patient / Caregiver view of a condition. Plain copy, phone first.                                              |
| `ActionView diseaseId`                        | Action plan: `Workflow` tracker on top, cited background (routes, resources, studies, limits) below.           |
| `Workflow plan`                               | Task tracker for one plan: mark done, close with a required note, restore, add your own. Filter in `?show=`.   |
| `MechanismPicker`, `RankedClusters`           | Biotech Scout. Ranking rule is text (`RANK_RULE`), not a score.                                                |
| `MechanismIndex`, `PeopleView`, `FundingView` | Researcher views; `isLite` trims them for the leader.                                                          |
| `AdminView`                                   | Builder status, review queue, synonyms, threshold, coverage.                                                   |

## Action plan tab

- "Action plan" in the top nav shows for roles with the full `action` panel (Patient Group Leader, Admin). `/action` reopens the last plan used; `/action?view=all` lists plans with their progress.
- Tasks come from `tasksFor(plan, progress)` in `src/lib/workflow.ts`: the plan's cited `doThisWeek` and `nextExperiments`, plus tasks the user adds (marked "Added by you", no citation).
- Progress lives in `useWorkflow` (Zustand, saved to this browser's localStorage under `pathnet.workflow.v1`). Read it only after `useWorkflowReady()` is true, so server and client render the same thing.
- `DoThisWeek` takes `doneIds` and `hiddenIds`, so the condition page shows the same progress.

## Chat (`chat/`)

- `ChatDock` sits in the header and renders only when `config.assistant` is true (Patient Group Leader, Researcher). It opens a non-modal sidebar; the page stays usable and citations open the shared evidence drawer.
- Answers come from `answerQuestion()` in `src/lib/chat/answer.ts`: it finds the condition, gene or mechanism in the question, picks an intent, and calls the `ApiClient`. Every listed item carries the edges behind it. Unknown terms get the "not in this atlas" answer, never a guess.
- `suggestedQuestions()` gives three questions per role about the page in focus. Clicking one fills the box; it does not send.
- The conversation lives in `useChat` (Zustand, session only).

## Graph (`graph/`)

- `LazyGraph` loads Cytoscape only when rendered. Always put it inside `GraphFrame height={n}` so the space is reserved.
- `MiniMap focusId` waits until it scrolls into view.
- Node shape encodes type, size encodes cited-link count, dashed amber is inferred, long-dash grey is a cross-cluster bridge, red with a bar end is contradicts. `GraphLegend` explains all of it.
- Every graph has a `GraphTable` alternative behind "Show as table".

## Layout and primitives

- `Page`, `PageHeader`, `Section`, `Pending`, `ErrorNote` in `layout/page.tsx`. `Pending` is static text; no shimmer.
- `Button` (`primary | secondary | ghost | quiet`, `sm | md`, `asChild`) and `Sheet` in `ui/`.

## Rules

- Data comes only from hooks in `src/lib/queries.ts`, which call the `ApiClient` from `src/api.ts`.
- Never render an edge without a `CitationMarker` or another one-click path to its evidence.
- Inferred links always say "Inferred" or use a dashed line; never present them as findings.
- Do not invent numbers. Confidence is `null` until scoring exists; show "Not scored".
- Copy: plain words, no exclamation marks, no em dashes. See `docs/frontend/anti-patterns.md`.
