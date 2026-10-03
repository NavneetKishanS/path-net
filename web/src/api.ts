// The ONLY file that knows where data comes from. The UI calls getApiClient() and nothing else.
//   mock   (default): pinned copy of the P1 slice in src/data/slice. No backend needed.
//   static : /graph.json, copied from data/seed by scripts/copy-seed.mjs.
//   rest   : PostgREST from docker compose at NEXT_PUBLIC_API_URL (VITE_API_URL is still honoured).
// Later (P4): add a 'supabase' branch that returns an ApiClient; nothing else in the UI changes.
import type { Graph } from './types'
import type { ApiClient } from './lib/api/client'
import { createMockClient } from './lib/api/mock'
import { createRestClient, createStaticClient, fetchRestGraph } from './lib/api/http'

export type DataSource = 'mock' | 'static' | 'rest'

export const DATA_SOURCE: DataSource = (['mock', 'static', 'rest'] as const).includes(
  process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource,
)
  ? (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource)
  : 'mock'
const API: string = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

let client: ApiClient | null = null

export function getApiClient(): ApiClient {
  client ??= DATA_SOURCE === 'rest' ? createRestClient(API) : DATA_SOURCE === 'static' ? createStaticClient() : createMockClient()
  return client
}

/** Contract-shaped graph, kept for the team scripts and P4's Supabase work. */
export async function loadGraph(): Promise<Graph> {
  if (DATA_SOURCE === 'rest') return fetchRestGraph(API)
  if (DATA_SOURCE === 'static') {
    const r = await fetch('/graph.json')
    if (!r.ok) throw new Error(`/graph.json returned ${r.status}`)
    return (await r.json()) as Graph
  }
  return (await import('./data/slice/graph.json')).default as unknown as Graph
}
