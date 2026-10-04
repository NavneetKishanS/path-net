import type { CitedSentence, CoverageReport, DraftClaim, ExplainedPath, ExplainPathResponse, PlatformRole } from '../../../contract/platform.ts'

export interface NodeRow { id: string; type: string; name: string; synonyms: string[]; ext_ids: Record<string, string>; props: Record<string, unknown> }
export interface EdgeRow { id: string; src: string; dst: string; type: string; tier: 'A' | 'B' | 'C' | 'D'; stance: string; status: string; note: string | null; confidence: number | null }
export interface EvidenceRow { id: string; edge_id: string; source_url: string | null; snippet: string | null; pmid: string | null; source_type?: string | null; retrieved_at?: string | null }
export interface GraphSlice { nodes: NodeRow[]; edges: EdgeRow[]; evidence: EvidenceRow[] }

// Endpoint pairs mirror contract.json. A test fails if either contract changes.
export const RELATIONS: Record<string, readonly [string, string]> = {
  disease_gene: ['disease', 'gene'], gene_variant_mechanism: ['variant', 'mechanism'],
  disease_mechanism: ['disease', 'mechanism'], disease_phenotype: ['disease', 'phenotype'],
  group_disease: ['patient_group', 'disease'], asset_disease: ['asset', 'disease'],
  study_disease: ['study', 'disease'], investigator_disease: ['person', 'disease'],
  shares_mechanism_with: ['disease', 'disease'], shares_investigator: ['disease', 'disease'],
}
export const ROLES: PlatformRole[] = ['family', 'group_leader', 'scout', 'researcher', 'admin']
export const LIMITATIONS = [
  'A coverage gap does not mean that no research, patient group or treatment exists.',
  'Source-backed connections do not establish clinical eligibility, treatment benefit, or equivalence between diseases.',
]

// Python casefold differences relevant to biomedical Latin names; no fuzzy identity merges.
const casefold = (s: string) => s.toLowerCase().replaceAll('ß', 'ss').replaceAll('ς', 'σ')
export function coverageReport(query: string, graph: GraphSlice, coverage: Record<string, unknown> = {}): CoverageReport {
  const q = casefold(query.trim()).replace(/\s+/gu, ' ')
  const labels = (n: NodeRow) => [n.name, ...n.synonyms, ...Object.values(n.ext_ids)].map(casefold)
  const exact = graph.nodes.filter(n => q && labels(n).includes(q))
  const matches = exact.length ? exact : graph.nodes.filter(n => q && labels(n).some(s => s.includes(q)))
  const ids = new Set(matches.map(n => n.id))
  const cited = new Set(graph.evidence.filter(e => e.source_url && e.snippet).map(e => e.edge_id))
  const edges = graph.edges.filter(e => (ids.has(e.src) || ids.has(e.dst)) && e.stance === 'supports' && e.status === 'verified' && ['A', 'B'].includes(e.tier) && cited.has(e.id))
  const supported = edges.length > 0
  return {
    query, status: supported ? 'matches_with_supported_connections' : 'no_supported_route',
    matched_node_ids: [...ids].sort(), supported_edge_ids: edges.map(e => e.id).sort(),
    searched: ['Names, exact synonyms, and stable external identifiers in the committed P1 slice', 'Direct verified A/B relationships with source evidence; contradictory, rejected, and inferred edges excluded'],
    missing: supported ? [] : ['No supported connection for this query was found in the selected slice.'],
    next_steps: supported ? ['Review the cited relationship scopes before choosing a study or reusable resource.'] : ['Check spelling and resolve the term against MONDO/HGNC/HPO.', 'Search the relevant official literature, trial and patient-organization sources; record coverage before adding a relationship.'],
    limitations: [...LIMITATIONS], coverage,
  }
}

function usableEvidence(e: EvidenceRow): boolean {
  if (!e.snippet?.trim() || !e.source_url) return false
  try { return ['https:', 'http:'].includes(new URL(e.source_url).protocol) } catch { return false }
}

function connected(edges: EdgeRow[]): boolean {
  if (edges.length < 2) return true
  let ends = new Set([edges[0].src, edges[0].dst])
  for (const edge of edges.slice(1)) {
    const next = new Set<string>()
    if (ends.has(edge.src)) next.add(edge.dst)
    if (ends.has(edge.dst)) next.add(edge.src)
    ends = next
  }
  return ends.size > 0
}

const phrasing: Record<string, string> = {
  disease_gene: 'has a documented gene association with',
  gene_variant_mechanism: 'has a source-scoped functional relationship with',
  disease_mechanism: 'has a source-scoped mechanism relationship with',
  disease_phenotype: 'has a documented phenotype association with',
  group_disease: 'is a patient organization linked to',
  asset_disease: 'is a research resource linked to',
  study_disease: 'is a registered study linked to',
  investigator_disease: 'is an investigator linked to',
  shares_mechanism_with: 'has a documented shared-mechanism relationship with',
  shares_investigator: 'has a shared-investigator relationship with',
}

export function explainPath(edgeIds: string[], query: string, graph: GraphSlice, coverage: Record<string, unknown> = {}): ExplainPathResponse {
  const noRoute = (reason: 'empty_path' | 'unsupported_path' | 'disconnected_path'): ExplainPathResponse => ({ status: 'no_supported_route', reason, coverage: coverageReport(query, graph, coverage) })
  if (!edgeIds.length) return noRoute('empty_path')
  const nodes = new Map(graph.nodes.map(n => [n.id, n]))
  const edgeMap = new Map(graph.edges.map(e => [e.id, e]))
  const edges: EdgeRow[] = []
  for (const id of edgeIds) {
    const e = edgeMap.get(id)
    if (!e || !nodes.has(e.src) || !nodes.has(e.dst) || e.stance !== 'supports' || e.status !== 'verified' || e.tier === 'D' || !Object.hasOwn(RELATIONS, e.type) || nodes.get(e.src)!.type !== RELATIONS[e.type][0] || nodes.get(e.dst)!.type !== RELATIONS[e.type][1] || !graph.evidence.some(v => v.edge_id === id && usableEvidence(v))) return noRoute('unsupported_path')
    edges.push(e)
  }
  if (!connected(edges)) return noRoute('disconnected_path')
  const sentences: CitedSentence[] = edges.map(e => ({
    text: e.tier === 'C'
      ? `Hypothesis (inferred): ${nodes.get(e.src)!.name} may have a ${e.type.replaceAll('_', ' ')} relationship with ${nodes.get(e.dst)!.name}; this requires expert review.`
      : `${nodes.get(e.src)!.name} ${phrasing[e.type]} ${nodes.get(e.dst)!.name}.`,
    edge_ids: [e.id], evidence_ids: graph.evidence.filter(v => v.edge_id === e.id && usableEvidence(v)).map(v => v.id).sort(),
    tier: e.tier as 'A' | 'B' | 'C', kind: e.tier === 'C' ? 'hypothesis' : 'supported', note: e.note,
  }))
  // Contradictions remain separate from every supporting sentence and path step.
  const nodeIds = new Set(edges.flatMap(e => [e.src, e.dst]))
  const contradictions = graph.edges.filter(e => e.stance === 'contradicts' && e.status !== 'rejected' && (nodeIds.has(e.src) || nodeIds.has(e.dst))).map(e => ({ edge_id: e.id, evidence_ids: graph.evidence.filter(v => v.edge_id === e.id && usableEvidence(v)).map(v => v.id).sort(), note: e.note })).sort((a, b) => a.edge_id.localeCompare(b.edge_id))
  return { status: 'explained', mode: 'deterministic', cache: 'miss', sentences, contradictions, limitations: [...LIMITATIONS] }
}

export async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

function stableJson(value: unknown): string {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, normalize(x)])) : v
  return JSON.stringify(normalize(value))
}

export async function buildCacheEntry(edgeIds: string[], graph: GraphSlice, role: PlatformRole = 'family') {
  const canonical = {
    nodes: [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...graph.edges].sort((a, b) => a.id.localeCompare(b.id)),
    evidence: [...graph.evidence].sort((a, b) => a.id.localeCompare(b.id)),
  }
  const payload = explainPath(edgeIds, '', canonical)
  if (payload.status !== 'explained') return null
  return { cache_key: await sha256({ version: 'p4-v1', role, edge_ids: edgeIds, graph: canonical }), edge_ids: edgeIds, audience: role, payload }
}

export function validCachedExplanation(value: unknown, expected: ExplainedPath): value is ExplainedPath {
  // Cached prose has exactly the same evidence scope as the current, RLS-filtered graph.
  return stableJson(value) === stableJson(expected)
}

export function validateClaims(value: unknown, abstract: string, pmid: string): { claims: DraftClaim[]; dropped: number } {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { claims?: unknown }).claims)) throw new Error('invalid_model_output')
  const raw = (value as { claims: unknown[] }).claims
  if (raw.length > 50) throw new Error('too_many_claims')
  const claims: DraftClaim[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    const text = (key: string, max: number) => typeof c[key] === 'string' && (c[key] as string).trim().length > 0 && (c[key] as string).length <= max
    const pair = typeof c.relation === 'string' && Object.hasOwn(RELATIONS, c.relation) ? RELATIONS[c.relation] : undefined
    if (!pair || c.subject_type !== pair[0] || c.object_type !== pair[1] || !text('subject', 300) || !text('object', 300) || !text('quote', 8000) || !abstract.includes(c.quote as string) || typeof c.stance !== 'string' || !['supports', 'contradicts', 'neutral'].includes(c.stance) || typeof c.effect !== 'string' || !['loss_of_function', 'gain_of_function', 'dominant_negative', 'unknown', 'not_applicable'].includes(c.effect) || !(c.confidence === null || (typeof c.confidence === 'number' && Number.isFinite(c.confidence) && c.confidence >= 0 && c.confidence <= 1))) continue
    claims.push({
      subject_type: c.subject_type as string, subject: c.subject as string, relation: c.relation as string,
      object_type: c.object_type as string, object: c.object as string, effect: c.effect as DraftClaim['effect'],
      stance: c.stance as DraftClaim['stance'], quote: c.quote as string,
      // Model confidence is uncalibrated; graph confidence remains null.
      confidence: null, pmid, source_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, tier: 'D', status: 'unverified', source_verified: false,
    })
  }
  return { claims, dropped: raw.length - claims.length }
}
