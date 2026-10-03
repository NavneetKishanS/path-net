import type {
  ActionPlan,
  AtlasNode,
  Connection,
  Coverage,
  DatasetMeta,
  FundingGap,
  FundingRecord,
  GraphData,
  InvestigatorRecord,
  MechanismEffect,
  NodeDetail,
  NodeType,
  RankedCluster,
  ReviewItem,
  Route,
  SearchResult,
  AssetRecord,
  DuplicateSignal,
} from '@/lib/model'

export interface SearchOptions {
  types?: NodeType[]
  /** Resolve gene matches to the diseases they cause (plain search). */
  resolveGenes?: boolean
}

/** The only data surface the UI uses. Implementations: MockApiClient (pinned slice), HttpApiClient (REST). */
export interface ApiClient {
  meta(): Promise<DatasetMeta>
  search(query: string, opts?: SearchOptions): Promise<SearchResult>
  getGraph(): Promise<GraphData>
  getNode(id: string): Promise<NodeDetail | null>
  getDiseases(): Promise<AtlasNode[]>
  getConnections(diseaseId: string): Promise<Connection[]>
  getRoute(fromId: string, toId: string): Promise<Route | null>
  getActionPlan(diseaseId: string): Promise<ActionPlan>
  getMechanisms(): Promise<AtlasNode[]>
  rankClusters(opts: { effects?: MechanismEffect[]; mechanismId?: string }): Promise<RankedCluster[]>
  getAssets(): Promise<{ assets: AssetRecord[]; duplicates: DuplicateSignal[] }>
  getPeople(): Promise<InvestigatorRecord[]>
  getFunding(): Promise<{ records: FundingRecord[]; gaps: FundingGap[] }>
  getCoverage(): Promise<Coverage>
  getReviewQueue(): Promise<ReviewItem[]>
  reviewEdge(edgeId: string, decision: 'approved' | 'rejected' | null): Promise<void>
  addSynonym(nodeId: string, synonym: string): Promise<void>
  removeSynonym(nodeId: string, synonym: string): Promise<void>
  getAddedSynonyms(): Promise<Record<string, string[]>>
}
