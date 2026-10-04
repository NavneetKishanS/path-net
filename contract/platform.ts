// Additive platform API. The five-table Graph and loadGraph() contract is unchanged.
export type PlatformRole = 'family' | 'group_leader' | 'scout' | 'researcher' | 'admin'
export type PlatformEdgeType = 'disease_gene' | 'gene_variant_mechanism' | 'disease_mechanism' | 'disease_phenotype' | 'group_disease' | 'asset_disease' | 'study_disease' | 'investigator_disease' | 'shares_mechanism_with' | 'shares_investigator'
export type PlatformStance = 'supports' | 'contradicts' | 'neutral'
// JSON representation of PostgreSQL rows: UUID/date/timestamptz values are strings.
export interface ContributionRow {
  id: string
  created_by: string
  org_id: string | null
  src: string
  dst: string
  type: PlatformEdgeType
  tier: 'D'
  stance: PlatformStance
  status: 'unverified' | 'verified' | 'rejected'
  note: string | null
  source_type: string
  source_url: string
  snippet: string
  pmid: string | null
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  edge_id: string | null
}
export interface SubmitContributionParams {
  p_src: string
  p_dst: string
  p_type: PlatformEdgeType
  p_source_url: string
  p_snippet: string
  p_org_id?: string | null
  p_stance?: PlatformStance
  p_note?: string | null
  p_source_type?: string
  p_pmid?: string | null
}
export interface ReviewContributionParams {
  p_id: string
  p_action: 'approve' | 'reject'
  p_review_note?: string | null
}
export interface ProfessionalContactRow {
  id: string
  person_node_id: string
  display_name: string
  organization: string | null
  public_email: string | null
  public_url: string
  source_url: string
  consent_basis: 'public_professional'
  updated_at: string
}
export interface CoverageReport {
  query: string
  status: 'matches_with_supported_connections' | 'no_supported_route'
  matched_node_ids: string[]
  supported_edge_ids: string[]
  searched: string[]
  missing: string[]
  next_steps: string[]
  limitations: string[]
  coverage: Record<string, unknown>
}
export interface ExplainPathRequest { edge_ids: string[]; query?: string }
export interface NoRouteRequest { query: string }
export interface CitedSentence {
  text: string
  edge_ids: string[]
  evidence_ids: string[]
  tier: 'A' | 'B' | 'C'
  kind: 'supported' | 'hypothesis'
  note: string | null
}
export interface ExplainedPath {
  status: 'explained'
  mode: 'deterministic'
  cache: 'hit' | 'miss'
  sentences: CitedSentence[]
  contradictions: { edge_id: string; evidence_ids: string[]; note: string | null }[]
  limitations: string[]
}
export interface UnsupportedPath {
  status: 'no_supported_route'
  reason: 'empty_path' | 'unsupported_path' | 'disconnected_path'
  coverage: CoverageReport
}
export type ExplainPathResponse = ExplainedPath | UnsupportedPath
export interface ExtractAbstractRequest { pmid: string; abstract: string }
export interface DraftClaim {
  subject_type: string
  subject: string
  relation: string
  object_type: string
  object: string
  effect: 'loss_of_function' | 'gain_of_function' | 'dominant_negative' | 'unknown' | 'not_applicable'
  stance: 'supports' | 'contradicts' | 'neutral'
  quote: string
  confidence: number | null
  pmid: string
  source_url: string
  tier: 'D'
  status: 'unverified'
  source_verified: false
}
export interface ExtractAbstractResponse {
  status: 'pending_review' | 'unavailable'
  claims: DraftClaim[]
  dropped: number
  cache: 'hit' | 'miss'
  message: string
}
export interface PlatformError { error: { code: string; message: string } }
