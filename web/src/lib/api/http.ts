// HTTP adapters. Both read the five contract tables and run the same engine as the mock,
// so switching NEXT_PUBLIC_DATA_SOURCE changes where data comes from and nothing else.
//   rest   : PostgREST at NEXT_PUBLIC_API_URL (docker-compose `api` service, or a hosted
//            Supabase project -- the latter requires an apikey header on every request;
//            the anon key is safe to expose client-side, RLS is the real boundary)
//   static : /graph.json, copied from data/seed by scripts/copy-seed.mjs
import type { Graph } from '@/types'
import { AtlasApiClient, emptyGraph } from './atlas-client'

async function getJson<T>(url: string, headers?: HeadersInit): Promise<T> {
  const r = await fetch(url, headers ? { headers } : undefined)
  if (!r.ok) throw new Error(`${url} returned ${r.status}`)
  return r.json() as Promise<T>
}

export async function fetchRestGraph(baseUrl: string): Promise<Graph> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const restHeaders = anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : undefined
  const [nodes, edges, evidence, clusters, node_cluster] = await Promise.all(
    (['nodes', 'edges', 'evidence', 'clusters', 'node_cluster'] as const).map((t) =>
      process.env.NEXT_PUBLIC_ACCOUNT_PROXY === 'true' && typeof window !== 'undefined'
        ? getJson<unknown[]>(`/api/account/graph?resource=${t}`)
        : getJson<unknown[]>(`${baseUrl}/${t}`, restHeaders),
    ),
  )
  return emptyGraph({ nodes, edges, evidence, clusters, node_cluster } as Partial<Graph>)
}

export function createRestClient(baseUrl: string) {
  return new AtlasApiClient(async () => ({
    graph: await fetchRestGraph(baseUrl.replace(/\/$/, '')),
    meta: { source: 'rest', label: `REST API ${baseUrl}`, snapshotDate: null, sourceCommit: null },
  }))
}

export function createStaticClient() {
  return new AtlasApiClient(async () => ({
    graph: emptyGraph(await getJson<Partial<Graph>>('/graph.json')),
    meta: { source: 'static', label: 'data/seed/graph.json', snapshotDate: null, sourceCommit: null },
  }))
}
