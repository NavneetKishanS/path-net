// UI domain model. The contract rows (src/types.ts) are mapped into these by src/lib/engine.

export type NodeType =
  | 'disease'
  | 'gene'
  | 'variant'
  | 'mechanism'
  | 'phenotype'
  | 'patientGroup'
  | 'paper'
  | 'study'
  | 'asset'
  | 'investigator'
  | 'funding'

export type SourceType =
  | 'PubMed'
  | 'OMIM'
  | 'ClinVar'
  | 'HPO'
  | 'ClinicalTrials'
  | 'RePORTER'
  | 'NORD'
  | 'Orphanet'
  | 'MONDO'
  | 'PatientOrg'
  | 'other'

export type Stance = 'supports' | 'contradicts'
export type Basis = 'observed' | 'inferred'
export type Tier = 'A' | 'B' | 'C' | 'D'
export type EdgeStatus = 'verified' | 'unverified' | 'rejected' | 'pending'

export interface Evidence {
  id: string
  sourceType: SourceType
  title: string
  url: string
  date: string
  snippet?: string
  stance: Stance
  pmid?: string
  authors?: string[]
  /** Record exists only to demonstrate a flow; not a real source. */
  sample?: boolean
}

export type Relation =
  | 'disease_gene'
  | 'variant_of'
  | 'gene_variant_mechanism'
  | 'disease_mechanism'
  | 'disease_phenotype'
  | 'group_disease'
  | 'asset_disease'
  | 'study_disease'
  | 'investigator_disease'
  | 'investigator_award'
  | 'subgroup_of'
  | 'shares_mechanism_with'
  | 'shares_investigator'
  | 'contributed'

export interface Edge {
  id: string
  from: string
  to: string
  relation: Relation
  /** Calibrated score in [0, 1]. Null means not scored yet; never invent one. */
  confidence: number | null
  basis: Basis
  tier: Tier
  status: EdgeStatus
  stance: Stance | 'neutral'
  /** What the edge does and does not claim, from the curator. */
  scope: string | null
  evidence: Evidence[]
  /** For inferred edges: the observed edges this was built from. */
  derivedFrom?: string[]
  /** Crosses between two mechanism clusters. */
  bridge?: boolean
  sample?: boolean
}

export interface ExternalId {
  namespace: string
  value: string
  url?: string
}

export interface AtlasNode {
  id: string
  type: NodeType
  name: string
  synonyms: string[]
  /** Related/broad ontology terms: searchable but never treated as identity. */
  relatedTerms: string[]
  ids: ExternalId[]
  summary: string | null
  props: Record<string, unknown>
  clusters: string[]
  /** Normalised degree centrality in [0, 1] over observed edges. */
  centrality: number
  sample?: boolean
}

export type MechanismEffect = 'loss_of_function' | 'gain_of_function' | 'dominant_negative' | 'unknown'

export interface Cluster {
  id: string
  label: string
  effect: MechanismEffect
  mechanismIds: string[]
  method: string | null
  scope: string | null
  /** Index into the cluster palette (0..3). */
  hue: number
}

export interface SearchMatch {
  node: AtlasNode
  matchedVia: { kind: 'name' | 'synonym' | 'id' | 'related' | 'gene'; value: string }
  /** For gene matches resolved to diseases (plain search). */
  resolvedFrom?: AtlasNode
}

export type SearchResult =
  | { status: 'ok'; query: string; matches: SearchMatch[] }
  | { status: 'no_match'; query: string; coverage: Coverage }

export interface SharedPhenotype {
  node: AtlasNode
  /** Annotated on few of the atlas's annotated conditions, so it says more than a common symptom. */
  informative: boolean
  /** Conditions in the atlas annotated with this symptom, out of annotatedTotal. */
  diseaseCount: number
  annotatedTotal: number
}

export type ConnectionKind = 'mechanism' | 'investigator' | 'phenotype'

export interface Connection {
  disease: AtlasNode
  kind: ConnectionKind
  /** True when every hop is observed, supporting evidence through a shared mechanism. */
  supported: boolean
  via: AtlasNode[]
  inferredEdge: Edge | null
  sharedPhenotypes: SharedPhenotype[]
  communities: CommunityLink[]
  /** Contradicting edges that limit this connection. */
  qualifiers: Edge[]
  reason: string
}

export interface CommunityLink {
  group: AtlasNode
  edge: Edge
  /** Set when the group serves a parent condition, not this exact one. */
  viaParent: AtlasNode | null
}

export interface RouteStep {
  edge: Edge
  subject: AtlasNode
  object: AtlasNode
}

export interface Route {
  from: AtlasNode
  to: AtlasNode
  kind: 'mechanism' | 'investigator'
  via: AtlasNode
  steps: RouteStep[]
  inferredEdge: Edge | null
  qualifiers: Edge[]
  communitySteps: RouteStep[]
  differences: string[]
  openQuestions: string[]
}

export type NoRouteReason = 'no_shared_mechanism' | 'only_broad_phenotypes' | 'not_in_atlas'

export interface NoRoute {
  from: AtlasNode
  reason: NoRouteReason
  searched: string[]
  missing: string[]
  nextQuestions: string[]
  coverage: Coverage
}

export type AssetCategory = 'patient_data' | 'biosamples' | 'funded_research' | 'study'

export interface AssetRecord {
  node: AtlasNode
  category: AssetCategory
  diseases: AtlasNode[]
  edge: Edge
  url: string | null
  nextStep: string | null
  reuse: string | null
  access: string | null
  status: string | null
}

export interface DuplicateSignal {
  category: AssetCategory
  clusterId: string
  assets: AssetRecord[]
  note: string
}

export interface ActionItem {
  id: string
  title: string
  detail: string
  /** Edges that justify this action. */
  edgeIds: string[]
  url: string | null
}

export interface InvestigatorRecord {
  node: AtlasNode
  diseases: AtlasNode[]
  clusters: string[]
  awards: AtlasNode[]
  edges: Edge[]
  /** Linked to diseases in more than one mechanism cluster. */
  sharedAcrossClusters: boolean
  organization: string | null
  profileUrl: string | null
  contactPolicy: string | null
}

export interface ActionPlan {
  disease: AtlasNode
  ownCommunities: CommunityLink[]
  viable: Connection[]
  /** Shared people, not shared biology. */
  network: Connection[]
  unsupported: Connection[]
  assets: AssetRecord[]
  duplicates: DuplicateSignal[]
  studies: AssetRecord[]
  partners: InvestigatorRecord[]
  nextExperiments: ActionItem[]
  doThisWeek: ActionItem[]
  noRoute: NoRoute | null
}

export interface RankedCluster {
  cluster: Cluster
  rank: number
  diseases: AtlasNode[]
  mechanismEdges: Edge[]
  groups: AtlasNode[]
  infrastructure: AssetRecord[]
  studies: AssetRecord[]
  contacts: InvestigatorRecord[]
  qualifiers: Edge[]
  unmetNeeds: string[]
}

export interface FundingRecord {
  award: AtlasNode
  funder: string
  institute: string | null
  fiscalYear: number | null
  totalCost: number | null
  organization: string | null
  projectNumber: string | null
  url: string | null
  investigators: AtlasNode[]
  diseases: AtlasNode[]
}

export interface FundingGap {
  disease: AtlasNode
  note: string
}

export interface CoverageQuery {
  source: string
  query: string
  total: number
  retrieved: number
  truncated: boolean
  retrievedAt: string
}

export interface Coverage {
  snapshotDate: string
  scope: string
  genes: string[]
  queries: CoverageQuery[]
  limitations: string[]
  counts: { nodes: number; edges: number; evidence: number; clusters: number }
  evidenceBySource: { sourceType: SourceType; count: number }[]
  nodesWithOntologyIds: number
  scoredEdges: number
}

export interface ReviewItem {
  edge: Edge
  from: AtlasNode
  to: AtlasNode
  origin: 'inferred' | 'contributed'
  decision: 'approved' | 'rejected' | null
}

export interface DatasetMeta {
  source: 'mock' | 'static' | 'rest'
  label: string
  snapshotDate: string | null
  sourceCommit: string | null
  counts: Coverage['counts']
}

export interface GraphData {
  nodes: AtlasNode[]
  edges: Edge[]
  clusters: Cluster[]
}

export interface NodeDetail {
  node: AtlasNode
  edges: Edge[]
  neighbours: AtlasNode[]
}
