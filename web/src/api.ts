// The ONLY file that knows where data comes from. The UI calls loadGraph() and nothing else.
//   static : reads /graph.json (copied from data/seed). No backend needed.
//   rest   : reads the PostgREST API from docker compose (tables: nodes, edges, evidence, clusters, node_cluster).
// Later (P4/P3): add a 'supabase' branch using supabase-js and keep the same return shape.
import type { Graph } from './types'

export const DATA_SOURCE: string = import.meta.env.VITE_DATA_SOURCE ?? 'static'
const API: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} returned ${r.status}`)
  return r.json() as Promise<T>
}

export async function loadGraph(): Promise<Graph> {
  if (DATA_SOURCE === 'rest') {
    const [nodes, edges, evidence, clusters, node_cluster] = await Promise.all(
      ['nodes', 'edges', 'evidence', 'clusters', 'node_cluster'].map((t) => getJson<any[]>(`${API}/${t}`)),
    )
    return { nodes, edges, evidence, clusters, node_cluster }
  }
  const g = await getJson<Partial<Graph>>('/graph.json')
  return {
    nodes: g.nodes ?? [],
    edges: g.edges ?? [],
    evidence: g.evidence ?? [],
    clusters: g.clusters ?? [],
    node_cluster: g.node_cluster ?? [],
  }
}
