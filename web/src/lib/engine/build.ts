// Maps contract rows (src/types.ts) into the UI model and derives the inferred relations.
// Rules: contradicting edges never count as support; inferred edges always list the observed edges they came from.
import type { EdgeRow, EvidenceRow, Graph, NodeRow } from '@/types'
import type {
  AtlasNode,
  Cluster,
  Edge,
  EdgeStatus,
  Evidence,
  ExternalId,
  MechanismEffect,
  NodeType,
  Relation,
  SourceType,
  Tier,
} from '@/lib/model'

export interface PubmedTitles {
  [pmid: string]: { title: string; authors?: string[] }
}

export interface Overrides {
  /** Review decisions keyed by edge id. */
  decisions: Record<string, 'approved' | 'rejected'>
  /** Extra synonyms added by an admin, keyed by node id. */
  synonyms: Record<string, string[]>
}

export const EMPTY_OVERRIDES: Overrides = { decisions: {}, synonyms: {} }

export interface BuiltGraph {
  nodes: Map<string, AtlasNode>
  edges: Edge[]
  edgeById: Map<string, Edge>
  clusters: Cluster[]
  /** Raw evidence rows kept for coverage counts. */
  evidenceCount: number
}

const NODE_TYPE: Record<string, NodeType> = {
  disease: 'disease',
  gene: 'gene',
  variant: 'variant',
  mechanism: 'mechanism',
  phenotype: 'phenotype',
  patient_group: 'patientGroup',
  paper: 'paper',
  study: 'study',
  asset: 'asset',
  person: 'investigator',
}

const SOURCE_TYPE: Record<string, SourceType> = {
  pubmed: 'PubMed',
  pmc: 'PubMed',
  omim: 'OMIM',
  clinvar: 'ClinVar',
  hpo: 'HPO',
  clinicaltrials: 'ClinicalTrials',
  nih_reporter: 'RePORTER',
  reporter: 'RePORTER',
  nord: 'NORD',
  orphadata: 'Orphanet',
  orphanet: 'Orphanet',
  mondo: 'MONDO',
  patient_organization: 'PatientOrg',
}

const ID_URL: Record<string, (v: string) => string> = {
  MONDO: (v) => `https://purl.obolibrary.org/obo/${v.replace(':', '_')}`,
  HPO: (v) => `https://hpo.jax.org/browse/term/${v}`,
  OMIM: (v) => `https://omim.org/entry/${v}`,
  Orphanet: (v) => `https://www.orpha.net/en/disease/detail/${v}`,
  MEDGEN: (v) => `https://www.ncbi.nlm.nih.gov/medgen/${v}`,
  HGNC: (v) => `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${v}`,
  NCBIGene: (v) => `https://www.ncbi.nlm.nih.gov/gene/${v}`,
  Ensembl: (v) => `https://www.ensembl.org/id/${v}`,
  ClinVarVariation: (v) => `https://www.ncbi.nlm.nih.gov/clinvar/variation/${v}/`,
  'ClinicalTrials.gov': (v) => `https://clinicaltrials.gov/study/${v}`,
  NIHRePORTER: (v) => `https://reporter.nih.gov/project-details/${v}`,
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

function mapNodeType(row: NodeRow): NodeType {
  if (row.type === 'asset' && row.props.kind === 'funded_research_project') return 'funding'
  return NODE_TYPE[row.type] ?? 'asset'
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function evidenceTitle(ev: EvidenceRow, sourceType: SourceType, titles: PubmedTitles): string {
  const url = ev.source_url ?? ''
  switch (sourceType) {
    case 'PubMed':
      return (ev.pmid && titles[ev.pmid]?.title) || `PubMed record ${ev.pmid ?? ''}`.trim()
    case 'HPO':
      return 'HPO phenotype annotations (phenotype.hpoa)'
    case 'MONDO': {
      const id = url.match(/MONDO:\d+/)?.[0]
      return id ? `MONDO term ${id}` : 'MONDO disease ontology'
    }
    case 'Orphanet': {
      const code = url.match(/orphacodes\/(\d+)/)?.[1]
      return code ? `Orphadata gene associations, ORPHA:${code}` : 'Orphadata'
    }
    case 'ClinicalTrials': {
      const nct = url.match(/NCT\d+/)?.[0]
      return nct ? `ClinicalTrials.gov ${nct}` : 'ClinicalTrials.gov record'
    }
    case 'RePORTER': {
      const id = url.match(/project-details\/(\d+)/)?.[1]
      return id ? `NIH RePORTER project ${id}` : 'NIH RePORTER'
    }
    case 'PatientOrg':
      return `Patient organization page, ${hostOf(url)}`
    default:
      return url ? hostOf(url) : 'Source not yet attached'
  }
}

function mapEvidence(ev: EvidenceRow, stance: Evidence['stance'], titles: PubmedTitles): Evidence {
  const placeholder = ev.source_type === 'placeholder' || !ev.source_url
  const sourceType = SOURCE_TYPE[ev.source_type ?? ''] ?? 'other'
  const authors = ev.pmid ? titles[ev.pmid]?.authors : undefined
  return {
    id: ev.id,
    sourceType,
    title: placeholder ? 'Placeholder: no real source yet' : evidenceTitle(ev, sourceType, titles),
    url: placeholder ? '' : (ev.source_url ?? ''),
    date: ev.retrieved_at ?? '',
    snippet: ev.snippet ?? undefined,
    stance,
    pmid: ev.pmid ?? undefined,
    authors: authors && authors.length ? authors : undefined,
    sample: placeholder || undefined,
  }
}

function externalIds(row: NodeRow): ExternalId[] {
  return Object.entries(row.ext_ids ?? {})
    .filter(([, v]) => typeof v === 'string' && v !== '')
    .map(([namespace, value]) => ({ namespace, value, url: ID_URL[namespace]?.(value) }))
}

function relatedTerms(row: NodeRow): string[] {
  const raw = row.props.ontology_synonyms
  if (!Array.isArray(raw)) return []
  return raw
    .map((s) => (typeof s === 'string' ? s : str((s as Record<string, unknown> | null)?.name)))
    .filter((s): s is string => !!s && !row.synonyms.includes(s))
}

function effectOf(value: unknown): MechanismEffect {
  return value === 'loss_of_function' || value === 'gain_of_function' || value === 'dominant_negative'
    ? value
    : 'unknown'
}

function statusOf(row: EdgeRow, overrides: Overrides): EdgeStatus {
  const d = overrides.decisions[row.id]
  if (d === 'rejected') return 'rejected'
  if (d === 'approved') return 'verified'
  return row.status
}

export function buildGraph(graph: Graph, titles: PubmedTitles = {}, overrides: Overrides = EMPTY_OVERRIDES): BuiltGraph {
  const membership = new Map<string, string[]>()
  for (const nc of graph.node_cluster) {
    membership.set(nc.node_id, [...(membership.get(nc.node_id) ?? []), nc.cluster_id])
  }

  const nodes = new Map<string, AtlasNode>()
  for (const row of graph.nodes) {
    const extra = overrides.synonyms[row.id] ?? []
    nodes.set(row.id, {
      id: row.id,
      type: mapNodeType(row),
      name: row.name,
      synonyms: [...row.synonyms, ...extra.filter((s) => !row.synonyms.includes(s))],
      relatedTerms: relatedTerms(row),
      ids: externalIds(row),
      summary: str(row.props.plain),
      props: row.props,
      clusters: membership.get(row.id) ?? [],
      centrality: 0,
      sample: row.props.placeholder === true || row.props.sample === true || undefined,
    })
  }

  const evidenceByEdge = new Map<string, EvidenceRow[]>()
  for (const ev of graph.evidence) {
    evidenceByEdge.set(ev.edge_id, [...(evidenceByEdge.get(ev.edge_id) ?? []), ev])
  }

  const edges: Edge[] = []
  for (const row of graph.edges) {
    if (!nodes.has(row.src) || !nodes.has(row.dst)) continue
    const stance = row.stance === 'contradicts' ? 'contradicts' : 'supports'
    const tier = row.tier as Tier
    edges.push({
      id: row.id,
      from: row.src,
      to: row.dst,
      relation: row.type as Relation,
      confidence: row.confidence,
      basis: tier === 'C' ? 'inferred' : 'observed',
      tier,
      status: overrides.decisions[row.id] ? statusOf(row, overrides) : tier === 'D' ? 'pending' : row.status,
      stance: row.stance,
      scope: row.note,
      evidence: (evidenceByEdge.get(row.id) ?? []).map((ev) => mapEvidence(ev, stance, titles)),
      sample: row.id.startsWith('sample_') || undefined,
    })
  }

  edges.push(...curatedLinks(nodes, edges))
  edges.push(...inferredLinks(nodes, edges, overrides))

  for (const e of edges) {
    const a = nodes.get(e.from)?.clusters ?? []
    const b = nodes.get(e.to)?.clusters ?? []
    e.bridge = a.length > 0 && b.length > 0 && !a.some((c) => b.includes(c))
  }

  const degree = new Map<string, number>()
  for (const e of edges) {
    if (e.basis !== 'observed' || e.status === 'rejected') continue
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  const maxDegree = Math.max(1, ...degree.values())
  for (const n of nodes.values()) n.centrality = (degree.get(n.id) ?? 0) / maxDegree

  const clusters: Cluster[] = graph.clusters.map((c, i) => {
    const m = (c.mechanism ?? {}) as Record<string, unknown>
    return {
      id: c.id,
      label: c.label,
      effect: effectOf(m.effect),
      mechanismIds: Array.isArray(m.mechanism_ids) ? (m.mechanism_ids as string[]) : [],
      method: str(m.method),
      scope: str(m.scope),
      hue: i % 4,
    }
  })

  return {
    nodes,
    edges,
    edgeById: new Map(edges.map((e) => [e.id, e])),
    clusters,
    evidenceCount: graph.evidence.length,
  }
}

/** Links stated in curated node properties (variant gene, award investigators, subgroup parent). */
function curatedLinks(nodes: Map<string, AtlasNode>, edges: Edge[]): Edge[] {
  const out: Edge[] = []
  for (const n of nodes.values()) {
    const p = n.props
    if (n.type === 'variant' && str(p.gene_id) && nodes.has(p.gene_id as string)) {
      const url = str(p.source_url)
      const clinvarId = url?.match(/variation\/(\d+)/)?.[1]
      out.push({
        id: `cur_variant_of_${n.id}`,
        from: n.id,
        to: p.gene_id as string,
        relation: 'variant_of',
        confidence: null,
        basis: 'observed',
        tier: 'A',
        status: 'verified',
        stance: 'supports',
        scope: 'ClinVar records this variant in the gene. Clinical classification alone does not state its functional effect.',
        evidence: url
          ? [
              {
                id: `ev_cur_variant_of_${n.id}`,
                sourceType: 'ClinVar',
                title: clinvarId ? `ClinVar variation ${clinvarId}` : 'ClinVar record',
                url,
                date: str(p.retrieved_at) ?? '',
                snippet: [str(p.classification), str(p.review_status)].filter(Boolean).join('; ') || undefined,
                stance: 'supports',
              },
            ]
          : [],
      })
    }
    if (n.type === 'funding' && Array.isArray(p.investigator_ids)) {
      const url = str(p.url) ?? str(p.source_url)
      for (const pid of p.investigator_ids as string[]) {
        if (!nodes.has(pid)) continue
        out.push({
          id: `cur_award_${pid}_${n.id}`,
          from: pid,
          to: n.id,
          relation: 'investigator_award',
          confidence: null,
          basis: 'observed',
          tier: 'A',
          status: 'verified',
          stance: 'supports',
          scope: 'NIH RePORTER lists this person as a principal investigator on the award.',
          evidence: url
            ? [
                {
                  id: `ev_cur_award_${pid}_${n.id}`,
                  sourceType: 'RePORTER',
                  title: `NIH RePORTER project ${url.match(/(\d+)$/)?.[1] ?? ''}`.trim(),
                  url,
                  date: str(p.retrieved_at) ?? '',
                  snippet: n.name,
                  stance: 'supports',
                },
              ]
            : [],
        })
      }
    }
    if (n.type === 'disease' && str(p.parent_disease) && nodes.has(p.parent_disease as string)) {
      const geneEdge = edges.find((e) => e.from === n.id && e.relation === 'disease_gene')
      out.push({
        id: `cur_subgroup_${n.id}`,
        from: n.id,
        to: p.parent_disease as string,
        relation: 'subgroup_of',
        confidence: null,
        basis: 'observed',
        tier: 'B',
        status: 'verified',
        stance: 'supports',
        scope: str(p.subgroup_definition) ?? str(p.ontology_note),
        evidence: geneEdge?.evidence ?? [],
      })
    }
  }
  return out
}

const pairKey = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string]

/** Graph-derived hypotheses. Always tier C, basis 'inferred'. */
function inferredLinks(nodes: Map<string, AtlasNode>, edges: Edge[], overrides: Overrides): Edge[] {
  const out: Edge[] = []
  const usable = (e: Edge) => e.stance === 'supports' && e.status !== 'rejected'

  const byMechanism = new Map<string, Edge[]>()
  for (const e of edges) {
    if (e.relation !== 'disease_mechanism' || !usable(e)) continue
    byMechanism.set(e.to, [...(byMechanism.get(e.to) ?? []), e])
  }
  for (const [mechId, list] of byMechanism) {
    const mech = nodes.get(mechId)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = pairKey(list[i]!.from, list[j]!.from)
        if (a === b) continue
        const id = `inf_mech_${a}__${b}__${mechId}`
        out.push({
          id,
          from: a,
          to: b,
          relation: 'shares_mechanism_with',
          confidence: null,
          basis: 'inferred',
          tier: 'C',
          status: overrides.decisions[id] === 'rejected' ? 'rejected' : overrides.decisions[id] === 'approved' ? 'verified' : 'unverified',
          stance: 'supports',
          scope: `Inferred by the graph: both conditions have cited evidence for "${mech?.name ?? mechId}". A shared mechanism class does not establish trial eligibility or interchangeable treatment.`,
          evidence: [...list[i]!.evidence, ...list[j]!.evidence],
          derivedFrom: [list[i]!.id, list[j]!.id],
        })
      }
    }
  }

  const byPerson = new Map<string, Edge[]>()
  for (const e of edges) {
    if (e.relation !== 'investigator_disease' || !usable(e)) continue
    byPerson.set(e.from, [...(byPerson.get(e.from) ?? []), e])
  }
  for (const [personId, list] of byPerson) {
    const person = nodes.get(personId)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = pairKey(list[i]!.to, list[j]!.to)
        if (a === b) continue
        const id = `inf_inv_${a}__${b}__${personId}`
        out.push({
          id,
          from: a,
          to: b,
          relation: 'shares_investigator',
          confidence: null,
          basis: 'inferred',
          tier: 'C',
          status: overrides.decisions[id] === 'rejected' ? 'rejected' : overrides.decisions[id] === 'approved' ? 'verified' : 'unverified',
          stance: 'supports',
          scope: `Inferred by the graph: ${person?.name ?? personId} is listed on NIH awards for both conditions. Shared expertise, not shared biology.`,
          evidence: [...list[i]!.evidence, ...list[j]!.evidence],
          derivedFrom: [list[i]!.id, list[j]!.id],
        })
      }
    }
  }
  return out
}
