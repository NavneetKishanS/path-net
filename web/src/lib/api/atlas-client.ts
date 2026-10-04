import type { Graph } from '@/types'
import type { DatasetMeta } from '@/lib/model'
import { Atlas, type AtlasInput } from '@/lib/engine/atlas'
import { EMPTY_OVERRIDES, type Overrides } from '@/lib/engine/build'
import type { ApiClient, SearchOptions } from './client'

export interface LoadedDataset extends Omit<AtlasInput, 'overrides'> {
  meta: Omit<DatasetMeta, 'counts'>
}

export interface OverrideStore {
  read(): Overrides
  write(o: Overrides): void
}

const KEY = 'pathnet.overrides.v1'
let overrideKey = KEY
let overridesAllowed = process.env.NEXT_PUBLIC_ACCOUNT_PROXY !== 'true'

/** Local curator demonstrations belong to one verified administrator, never the next visitor. */
export function setBrowserOverrideAccount(userId: string | null, canAdmin: boolean): void {
  overridesAllowed = !!userId && canAdmin
  overrideKey = userId ? `${KEY}:${userId}` : KEY
}

export const browserOverrideStore: OverrideStore = {
  read() {
    if (typeof window === 'undefined' || !overridesAllowed) return EMPTY_OVERRIDES
    try {
      const raw = window.localStorage.getItem(overrideKey)
      return raw ? { ...EMPTY_OVERRIDES, ...(JSON.parse(raw) as Overrides) } : EMPTY_OVERRIDES
    } catch {
      return EMPTY_OVERRIDES
    }
  },
  write(o) {
    if (!overridesAllowed) throw new Error('An assigned administrator account is required.')
    if (typeof window !== 'undefined') window.localStorage.setItem(overrideKey, JSON.stringify(o))
  },
}

export function memoryOverrideStore(initial: Overrides = EMPTY_OVERRIDES): OverrideStore {
  let value = initial
  return {
    read: () => value,
    write: (o) => {
      value = o
    },
  }
}

/**
 * Loads a contract-shaped dataset once, then answers every query from the in-memory engine.
 * Admin edits (review decisions, synonyms) are kept locally and re-applied on rebuild.
 */
export class AtlasApiClient implements ApiClient {
  private dataset: Promise<LoadedDataset> | null = null
  private atlas: Atlas | null = null

  constructor(
    private readonly load: () => Promise<LoadedDataset>,
    private readonly store: OverrideStore = browserOverrideStore,
  ) {}

  private async engine(): Promise<Atlas> {
    if (this.atlas) return this.atlas
    this.dataset ??= this.load()
    const d = await this.dataset
    this.atlas = new Atlas({ ...d, overrides: this.store.read() })
    return this.atlas
  }

  private rebuild(next: Overrides) {
    this.store.write(next)
    this.atlas = null
  }

  async meta(): Promise<DatasetMeta> {
    const [atlas, d] = await Promise.all([this.engine(), this.dataset!])
    return { ...d.meta, counts: atlas.coverage().counts }
  }
  async search(query: string, opts?: SearchOptions) {
    return (await this.engine()).search(query, opts)
  }
  async getGraph() {
    return (await this.engine()).graphData()
  }
  async getNode(id: string) {
    return (await this.engine()).nodeDetail(id)
  }
  async getDiseases() {
    return (await this.engine()).diseases()
  }
  async getConnections(diseaseId: string) {
    return (await this.engine()).connections(diseaseId)
  }
  async getRoute(fromId: string, toId: string) {
    return (await this.engine()).route(fromId, toId)
  }
  async getActionPlan(diseaseId: string) {
    return (await this.engine()).actionPlan(diseaseId)
  }
  async getMechanisms() {
    return (await this.engine()).mechanisms()
  }
  async rankClusters(opts: Parameters<Atlas['rankClusters']>[0]) {
    return (await this.engine()).rankClusters(opts)
  }
  async getAssets() {
    const a = await this.engine()
    const assets = a.allAssets().filter((x) => x.category !== 'study')
    return { assets, duplicates: a.duplicates(assets) }
  }
  async getPeople() {
    return (await this.engine()).investigators()
  }
  async getFunding() {
    return (await this.engine()).funding()
  }
  async getCoverage() {
    return (await this.engine()).coverage()
  }
  async getReviewQueue() {
    return (await this.engine()).reviewQueue(this.store.read().decisions)
  }
  async reviewEdge(edgeId: string, decision: 'approved' | 'rejected' | null) {
    const o = this.store.read()
    const decisions = { ...o.decisions }
    if (decision) decisions[edgeId] = decision
    else delete decisions[edgeId]
    this.rebuild({ ...o, decisions })
  }
  async addSynonym(nodeId: string, synonym: string) {
    const s = synonym.trim()
    if (!s) return
    const o = this.store.read()
    const list = o.synonyms[nodeId] ?? []
    if (!list.includes(s)) this.rebuild({ ...o, synonyms: { ...o.synonyms, [nodeId]: [...list, s] } })
  }
  async removeSynonym(nodeId: string, synonym: string) {
    const o = this.store.read()
    this.rebuild({
      ...o,
      synonyms: { ...o.synonyms, [nodeId]: (o.synonyms[nodeId] ?? []).filter((x) => x !== synonym) },
    })
  }
  async getAddedSynonyms() {
    return this.store.read().synonyms
  }
}

export function emptyGraph(g: Partial<Graph>): Graph {
  return {
    nodes: g.nodes ?? [],
    edges: g.edges ?? [],
    evidence: g.evidence ?? [],
    clusters: g.clusters ?? [],
    node_cluster: g.node_cluster ?? [],
  }
}
