// Hand-mirrored from contract/contract.json. Keep in sync.
export const ROLES = ['family', 'group_leader', 'scout', 'researcher', 'admin'] as const
export type Role = (typeof ROLES)[number]

export type Tier = 'A' | 'B' | 'C' | 'D'
export const TIER_TEXT: Record<Tier, string> = {
  A: 'Curated database',
  B: 'Extracted from a source, quote checked',
  C: 'Inferred by the graph: a hypothesis, not a published finding',
  D: 'Contributed by a user, pending review',
}

export interface NodeRow {
  id: string
  type: string
  name: string
  synonyms: string[]
  ext_ids: Record<string, string>
  props: Record<string, unknown>
}
export interface EdgeRow {
  id: string
  src: string
  dst: string
  type: string
  tier: Tier
  confidence: number | null
  stance: 'supports' | 'contradicts' | 'neutral'
  status: 'verified' | 'unverified' | 'rejected'
  note: string | null
}
export interface EvidenceRow {
  id: string
  edge_id: string
  source_type: string | null
  source_url: string | null
  pmid: string | null
  snippet: string | null
  retrieved_at: string | null
}
export interface ClusterRow {
  id: string
  label: string
  mechanism: Record<string, unknown>
}
export interface NodeClusterRow {
  node_id: string
  cluster_id: string
}
export interface Graph {
  nodes: NodeRow[]
  edges: EdgeRow[]
  evidence: EvidenceRow[]
  clusters: ClusterRow[]
  node_cluster: NodeClusterRow[]
}
