import { useEffect, useMemo, useState } from 'react'
import { DATA_SOURCE, loadGraph } from './api'
import GraphView from './GraphView'
import { EdgePanel, NoRoutePanel, NodePanel, Welcome } from './Panels'
import { ROLES, type Graph, type Role } from './types'

function search(graph: Graph | null, q: string) {
  const s = q.trim().toLowerCase()
  if (!graph || !s) return []
  return graph.nodes.filter((n) => n.name.toLowerCase().includes(s) || n.synonyms.some((x) => x.toLowerCase().includes(s)))
}

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [edgeId, setEdgeId] = useState<string | null>(null)
  // v0: the role only changes a label. RBAC lands with Supabase auth + RLS (P4), role views (P3).
  const [role, setRole] = useState<Role>('group_leader')

  useEffect(() => {
    loadGraph().then(setGraph).catch((e) => setError(String(e)))
  }, [])

  const matches = useMemo(() => search(graph, query), [graph, query])

  // Nodes to keep bright: the selection (or search matches) plus direct neighbours.
  const focusIds = useMemo(() => {
    if (!graph) return null
    const seeds = nodeId ? [nodeId] : matches.map((m) => m.id)
    if (seeds.length === 0) return null
    const ids = new Set(seeds)
    graph.edges.forEach((e) => {
      if (seeds.includes(e.src)) ids.add(e.dst)
      if (seeds.includes(e.dst)) ids.add(e.src)
    })
    return ids
  }, [graph, nodeId, matches])

  const pickNode = (id: string) => { setNodeId(id); setEdgeId(null) }
  const pickEdge = (id: string) => setEdgeId(id)

  const node = graph?.nodes.find((n) => n.id === nodeId)
  const edge = graph?.edges.find((e) => e.id === edgeId)
  const noRoute = query.trim() !== '' && matches.length === 0

  return (
    <div className="app">
      <header>
        <div className="brand">PathNet <span className="muted">rare disease atlas · v0</span></div>
        <div className="search">
          <input
            id="search"
            aria-label="Search a disease, gene, symptom or patient group"
            placeholder="Search a disease, gene, symptom, group or mechanism"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setNodeId(null); setEdgeId(null) }}
          />
          {matches.length > 0 && !nodeId && (
            <ul className="suggest">
              {matches.slice(0, 6).map((m) => (
                <li key={m.id}><button onClick={() => pickNode(m.id)}>{m.name} <span className="muted">{m.type.replace('_', ' ')}</span></button></li>
              ))}
            </ul>
          )}
        </div>
        <label className="role">
          <span className="muted">View as</span>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
        </label>
        <span className="muted src">data: {DATA_SOURCE}</span>
      </header>

      <main>
        {error && <div className="panel"><h2>Could not load the graph</h2><p className="warn">{error}</p><p>Static mode: run <code>npm run dev</code> in web/. Docker mode: run <code>bash run.sh up</code> and wait for the seed step.</p></div>}
        {!error && !graph && <div className="panel"><p>Loading…</p></div>}
        {graph && (
          <>
            <GraphView graph={graph} focusIds={focusIds} selectedNodeId={nodeId} selectedEdgeId={edgeId} onNode={pickNode} onEdge={pickEdge} />
            <aside>
              {noRoute ? <NoRoutePanel query={query} /> : edge ? <EdgePanel graph={graph} edge={edge} /> : node ? <NodePanel graph={graph} node={node} onEdge={pickEdge} /> : <Welcome role={role} />}
            </aside>
          </>
        )}
      </main>
    </div>
  )
}
