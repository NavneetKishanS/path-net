// Read model over a built graph. Pure and synchronous; ApiClient implementations wrap it.
import type { Graph } from '@/types'
import type {
  ActionItem,
  ActionPlan,
  AssetCategory,
  AssetRecord,
  AtlasNode,
  CommunityLink,
  Connection,
  Coverage,
  DuplicateSignal,
  Edge,
  FundingGap,
  FundingRecord,
  GraphData,
  InvestigatorRecord,
  MechanismEffect,
  NodeDetail,
  NodeType,
  NoRoute,
  RankedCluster,
  ReviewItem,
  Route,
  RouteStep,
  SearchMatch,
  SearchResult,
  SharedPhenotype,
  SourceType,
} from '@/lib/model'
import { buildGraph, EMPTY_OVERRIDES, type BuiltGraph, type Overrides, type PubmedTitles } from './build'

export interface CoverageFile {
  snapshot_date?: string
  primary_gene?: string
  neighbor_genes?: string[]
  selection_reason?: string
  queries?: {
    source: string
    query: string
    total_count: number
    retrieved_count: number
    retrieved_at: string
    truncated: boolean
  }[]
  limitations?: string[]
}

export interface AtlasInput {
  graph: Graph
  titles?: PubmedTitles
  coverage?: CoverageFile
  overrides?: Overrides
  /** Sample-only records appended for demonstration (tier D review). */
  sampleEdges?: Graph['edges']
}

export const PATIENT_TYPES: NodeType[] = ['disease', 'phenotype', 'patientGroup']

const ASSET_CATEGORY: Record<string, AssetCategory> = {
  patient_registry: 'patient_data',
  natural_history_study: 'patient_data',
  prospective_natural_history_study: 'patient_data',
  biorepository: 'biosamples',
  funded_research_project: 'funded_research',
}

const INACTIVE_STUDY = new Set(['TERMINATED', 'WITHDRAWN', 'COMPLETED', 'UNKNOWN', 'SUSPENDED', 'ACTIVE_NOT_RECRUITING'])

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim()
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

export class Atlas {
  readonly g: BuiltGraph
  private readonly coverageFile: CoverageFile

  constructor(input: AtlasInput) {
    const graph: Graph = input.sampleEdges
      ? { ...input.graph, edges: [...input.graph.edges, ...input.sampleEdges] }
      : input.graph
    this.g = buildGraph(graph, input.titles ?? {}, input.overrides ?? EMPTY_OVERRIDES)
    this.coverageFile = input.coverage ?? {}
  }

  // ---------- basics ----------

  node(id: string): AtlasNode | undefined {
    return this.g.nodes.get(id)
  }

  private must(id: string): AtlasNode {
    const n = this.g.nodes.get(id)
    if (!n) throw new Error(`Unknown node ${id}`)
    return n
  }

  /** Edges that may be shown as connections: not rejected. */
  private live(): Edge[] {
    return this.g.edges.filter((e) => e.status !== 'rejected')
  }

  edgesOf(id: string): Edge[] {
    return this.live().filter((e) => e.from === id || e.to === id)
  }

  edge(id: string): Edge | undefined {
    return this.g.edgeById.get(id)
  }

  graphData(): GraphData {
    return { nodes: [...this.g.nodes.values()], edges: this.live().filter((e) => e.status !== 'pending'), clusters: this.g.clusters }
  }

  nodeDetail(id: string): NodeDetail | null {
    const node = this.g.nodes.get(id)
    if (!node) return null
    const edges = this.edgesOf(id)
    const neighbours = edges.map((e) => this.must(e.from === id ? e.to : e.from))
    return { node, edges, neighbours }
  }

  diseases(): AtlasNode[] {
    return [...this.g.nodes.values()].filter((n) => n.type === 'disease').sort((a, b) => a.name.localeCompare(b.name))
  }

  geneOf(diseaseId: string): AtlasNode | null {
    const e = this.live().find((x) => x.from === diseaseId && x.relation === 'disease_gene' && x.stance === 'supports')
    return e ? this.must(e.to) : null
  }

  parentOf(diseaseId: string): AtlasNode | null {
    const e = this.live().find((x) => x.from === diseaseId && x.relation === 'subgroup_of')
    return e ? this.must(e.to) : null
  }

  childrenOf(diseaseId: string): AtlasNode[] {
    return this.live()
      .filter((x) => x.to === diseaseId && x.relation === 'subgroup_of')
      .map((x) => this.must(x.from))
  }

  mechanismsOf(diseaseId: string): { node: AtlasNode; edge: Edge }[] {
    return this.live()
      .filter((e) => e.from === diseaseId && e.relation === 'disease_mechanism')
      .map((edge) => ({ node: this.must(edge.to), edge }))
  }

  phenotypesOf(diseaseId: string): AtlasNode[] {
    return this.live()
      .filter((e) => e.from === diseaseId && e.relation === 'disease_phenotype' && e.stance === 'supports')
      .map((e) => this.must(e.to))
  }

  // ---------- search ----------

  search(query: string, opts: { types?: NodeType[]; resolveGenes?: boolean } = {}): SearchResult {
    const q = normalise(query)
    if (!q) return { status: 'ok', query, matches: [] }
    const scored: { m: SearchMatch; score: number }[] = []

    for (const node of this.g.nodes.values()) {
      const best = this.matchNode(node, q)
      if (best) scored.push(best)
    }
    scored.sort((a, b) => b.score - a.score || a.m.node.name.localeCompare(b.m.node.name))

    let matches = scored.map((s) => s.m)
    if (opts.resolveGenes) {
      const resolved: SearchMatch[] = []
      for (const m of matches) {
        if (m.node.type !== 'gene') continue
        for (const e of this.live()) {
          if (e.relation === 'disease_gene' && e.to === m.node.id && e.stance === 'supports') {
            resolved.push({ node: this.must(e.from), matchedVia: { kind: 'gene', value: m.node.name }, resolvedFrom: m.node })
          }
        }
      }
      matches = [...matches, ...resolved]
    }
    if (opts.types) matches = matches.filter((m) => opts.types!.includes(m.node.type))
    const seen = new Set<string>()
    matches = matches.filter((m) => (seen.has(m.node.id) ? false : (seen.add(m.node.id), true)))

    if (matches.length === 0) return { status: 'no_match', query, coverage: this.coverage() }
    return { status: 'ok', query, matches }
  }

  private matchNode(node: AtlasNode, q: string): { m: SearchMatch; score: number } | null {
    const name = normalise(node.name)
    const mk = (kind: SearchMatch['matchedVia']['kind'], value: string, score: number) => ({
      m: { node, matchedVia: { kind, value } },
      score: score + node.centrality,
    })
    if (name === q) return mk('name', node.name, 100)
    for (const id of node.ids) {
      if (normalise(id.value) === q || normalise(`${id.namespace}:${id.value}`) === q || normalise(`${id.namespace} ${id.value}`) === q)
        return mk('id', `${id.namespace} ${id.value}`, 95)
    }
    for (const s of node.synonyms) if (normalise(s) === q) return mk('synonym', s, 90)
    if (name.startsWith(q)) return mk('name', node.name, 70)
    for (const s of node.synonyms) if (normalise(s).startsWith(q)) return mk('synonym', s, 60)
    if (q.length >= 3 && name.includes(q)) return mk('name', node.name, 50)
    if (q.length >= 3) for (const s of node.synonyms) if (normalise(s).includes(q)) return mk('synonym', s, 40)
    if (q.length >= 3) for (const s of node.relatedTerms) if (normalise(s).includes(q)) return mk('related', s, 30)
    return null
  }

  // ---------- communities, phenotypes ----------

  communitiesOf(diseaseId: string): CommunityLink[] {
    const direct = (id: string, viaParent: AtlasNode | null): CommunityLink[] =>
      this.live()
        .filter((e) => e.relation === 'group_disease' && e.to === id && e.stance === 'supports')
        .map((edge) => ({ group: this.must(edge.from), edge, viaParent }))
    const own = direct(diseaseId, null)
    const parent = this.parentOf(diseaseId)
    return parent ? [...own, ...direct(parent.id, parent)] : own
  }

  private annotatedDiseases(): string[] {
    return [...new Set(this.live().filter((e) => e.relation === 'disease_phenotype').map((e) => e.from))]
  }

  sharedPhenotypes(a: string, b: string): SharedPhenotype[] {
    const pa = new Set(this.phenotypesOf(a).map((n) => n.id))
    const annotated = this.annotatedDiseases()
    const total = annotated.length
    return this.phenotypesOf(b)
      .filter((n) => pa.has(n.id))
      .map((node) => {
        const count = this.live().filter(
          (e) => e.relation === 'disease_phenotype' && e.to === node.id && e.stance === 'supports',
        ).length
        return { node, diseaseCount: count, annotatedTotal: total, informative: count <= Math.max(1, Math.floor(total / 3)) }
      })
      .sort((x, y) => x.diseaseCount - y.diseaseCount || x.node.name.localeCompare(y.node.name))
  }

  // ---------- connections and routes ----------

  private family(id: string): string[] {
    const parent = this.parentOf(id)
    return [id, ...this.childrenOf(id).map((c) => c.id), ...(parent ? [parent.id] : [])]
  }

  /** Contradicting edges from `target` (or its parent) to mechanisms that `focus` (or its subgroups) has support for. */
  private qualifiersFor(focusIds: string[], targetId: string): Edge[] {
    const supported = new Set(
      this.live()
        .filter((e) => focusIds.includes(e.from) && e.relation === 'disease_mechanism' && e.stance === 'supports')
        .map((e) => e.to),
    )
    const parent = this.parentOf(targetId)
    const targets = [targetId, ...(parent ? [parent.id] : [])]
    const out = this.live().filter(
      (e) => e.stance === 'contradicts' && e.relation === 'disease_mechanism' && targets.includes(e.from) && supported.has(e.to),
    )
    // The focus's own contradicted assignments also limit any link through that mechanism.
    const own = this.live().filter(
      (e) =>
        e.stance === 'contradicts' &&
        e.relation === 'disease_mechanism' &&
        focusIds.includes(e.from) &&
        this.live().some((x) => x.from === targetId && x.to === e.to && x.stance === 'supports'),
    )
    return [...out, ...own]
  }

  connections(diseaseId: string): Connection[] {
    const focus = this.must(diseaseId)
    const fam = this.family(diseaseId)
    const focusIds = [diseaseId, ...this.childrenOf(diseaseId).map((c) => c.id)]
    const inferred = this.live().filter((e) => e.basis === 'inferred')
    const out: Connection[] = []

    for (const cand of this.diseases()) {
      if (fam.includes(cand.id)) continue
      const touches = (e: Edge) =>
        (focusIds.includes(e.from) && e.to === cand.id) || (focusIds.includes(e.to) && e.from === cand.id)
      const mech = inferred.find((e) => e.relation === 'shares_mechanism_with' && touches(e))
      const inv = inferred.find((e) => e.relation === 'shares_investigator' && touches(e))
      const phen = this.sharedPhenotypes(focus.id, cand.id)
      const qualifiers = this.qualifiersFor(focusIds, cand.id)
      const communities = this.communitiesOf(cand.id)

      if (mech) {
        const mechNode = this.must(mech.id.split('__')[2]!)
        const supported = (mech.derivedFrom ?? []).every((id) => {
          const e = this.edge(id)
          return !!e && e.basis === 'observed' && e.stance === 'supports' && e.status !== 'rejected'
        })
        out.push({
          disease: cand,
          kind: 'mechanism',
          supported,
          via: [mechNode],
          inferredEdge: mech,
          sharedPhenotypes: phen,
          communities,
          qualifiers,
          reason: `Both have cited evidence for ${mechNode.name.toLowerCase()}.`,
        })
      } else if (inv) {
        const person = this.must(inv.id.split('__')[2]!)
        out.push({
          disease: cand,
          kind: 'investigator',
          supported: false,
          via: [person],
          inferredEdge: inv,
          sharedPhenotypes: phen,
          communities,
          qualifiers,
          reason: `${person.name} is listed on NIH awards for both. Shared expertise, not shared biology.`,
        })
      } else if (phen.length > 0) {
        out.push({
          disease: cand,
          kind: 'phenotype',
          supported: false,
          via: phen.map((p) => p.node),
          inferredEdge: null,
          sharedPhenotypes: phen,
          communities,
          qualifiers,
          reason: `Shares ${phen.length} symptom annotation${phen.length === 1 ? '' : 's'}, none specific enough to suggest shared biology.`,
        })
      }
    }

    const order = { mechanism: 0, investigator: 1, phenotype: 2 }
    return out.sort(
      (a, b) =>
        order[a.kind] - order[b.kind] ||
        Number(b.supported) - Number(a.supported) ||
        a.qualifiers.length - b.qualifiers.length ||
        b.sharedPhenotypes.length - a.sharedPhenotypes.length ||
        a.disease.name.localeCompare(b.disease.name),
    )
  }

  private step(edge: Edge): RouteStep {
    return { edge, subject: this.must(edge.from), object: this.must(edge.to) }
  }

  route(fromId: string, toId: string): Route | null {
    const from = this.must(fromId)
    const to = this.must(toId)
    const conn = this.connections(fromId).find((c) => c.disease.id === toId)
    if (!conn || conn.kind === 'phenotype' || !conn.inferredEdge) return null

    const via = conn.via[0]!
    const steps: RouteStep[] = []
    for (const id of conn.inferredEdge.derivedFrom ?? []) {
      const e = this.edge(id)
      if (e) steps.push(this.step(e))
    }
    // Put the focus side first.
    steps.sort((a, b) => Number(this.touchesFamily(b, fromId)) - Number(this.touchesFamily(a, fromId)))
    const childStep = steps.find((s) => s.subject.id !== fromId && this.parentOf(s.subject.id)?.id === fromId)
    if (childStep) {
      const sub = this.live().find((e) => e.relation === 'subgroup_of' && e.from === childStep.subject.id)
      if (sub) steps.unshift(this.step(sub))
    }

    const communitySteps: RouteStep[] = []
    const parent = this.parentOf(toId)
    if (parent) {
      const sub = this.live().find((e) => e.relation === 'subgroup_of' && e.from === toId)
      if (sub) communitySteps.push(this.step(sub))
    }
    for (const c of conn.communities) communitySteps.push(this.step(c.edge))
    for (const a of this.assetsFor([toId, ...(parent ? [parent.id] : [])])) {
      if (a.category === 'patient_data' || a.category === 'biosamples') communitySteps.push(this.step(a.edge))
    }

    return {
      from,
      to,
      kind: conn.kind === 'mechanism' ? 'mechanism' : 'investigator',
      via,
      steps,
      inferredEdge: conn.inferredEdge,
      qualifiers: conn.qualifiers,
      communitySteps,
      differences: this.differences(from, to, conn),
      openQuestions: this.openQuestions(from, to, conn),
    }
  }

  private touchesFamily(s: RouteStep, id: string): boolean {
    return s.subject.id === id || s.object.id === id || this.parentOf(s.subject.id)?.id === id
  }

  private differences(from: AtlasNode, to: AtlasNode, conn: Connection): string[] {
    const out: string[] = []
    const ga = this.geneOf(from.id)
    const gb = this.geneOf(to.id)
    if (ga && gb && ga.id !== gb.id) out.push(`Different genes: ${ga.name} and ${gb.name}. The link is through what the change does, not the gene name.`)
    if (conn.kind === 'mechanism') {
      const scope = str(conn.via[0]?.props.scope)
      if (scope) out.push(scope.endsWith('.') ? scope : `${scope}.`)
    }
    const sub = str(to.props.subgroup_definition)
    if (sub) out.push(`${to.name} is a defined subgroup: ${sub}.`)
    const pa = new Set(this.phenotypesOf(from.id).map((n) => n.id))
    const pb = new Set(this.phenotypesOf(to.id).map((n) => n.id))
    const onlyA = [...pa].filter((x) => !pb.has(x)).map((x) => this.must(x).name)
    if (pb.size > 0 && onlyA.length > 0) out.push(`Symptoms annotated only for ${from.name}: ${onlyA.slice(0, 4).join(', ')}.`)
    if (pb.size === 0) out.push(`No symptom annotations are recorded for ${to.name} in this atlas, so symptoms cannot be compared yet.`)
    return out
  }

  private openQuestions(from: AtlasNode, to: AtlasNode, conn: Connection): string[] {
    const out: string[] = []
    if (conn.kind === 'mechanism') {
      const mech = conn.via[0]!
      out.push(
        `Has ${mech.name.toLowerCase()} been shown for the specific variants in your families? The cited studies tested particular variants, not every family.`,
      )
    }
    for (const q of conn.qualifiers) {
      out.push(`${this.must(q.from).name}: evidence contradicts one mechanism for everyone with this diagnosis. Which families fall in the matching subgroup?`)
    }
    const studies = this.assetsFor([from.id, to.id, ...(this.parentOf(to.id) ? [this.parentOf(to.id)!.id] : [])]).filter(
      (a) => a.category === 'study',
    )
    for (const s of studies) {
      if (s.status && INACTIVE_STUDY.has(s.status)) {
        out.push(`${s.node.name} is recorded as ${s.status.toLowerCase().replace(/_/g, ' ')}. What did its design learn before anyone proposes a shared trial?`)
      }
    }
    if (conn.communities.length > 0) {
      out.push('Do the partner registry’s consent and data fields allow use for a related condition? This needs the registry team’s review.')
    }
    return out
  }

  noRoute(diseaseId: string): NoRoute {
    const from = this.must(diseaseId)
    const mechs = this.mechanismsOf(diseaseId).filter((m) => m.edge.stance === 'supports')
    const conns = this.connections(diseaseId)
    const phen = conns.flatMap((c) => c.sharedPhenotypes)
    const broad = [...new Map(phen.map((p) => [p.node.id, p.node.name])).values()]
    const reason = conns.some((c) => c.kind === 'phenotype') ? 'only_broad_phenotypes' : 'no_shared_mechanism'
    return {
      from,
      reason,
      searched: [
        `Mechanism evidence for ${this.diseases().length} conditions in this atlas`,
        'NIH RePORTER investigators listed on awards for each condition (sampled)',
        'HPO symptom annotations',
        'Patient organizations, registries and studies linked to each condition',
      ],
      missing: [
        mechs.length
          ? `No other condition in this atlas has cited evidence for ${mechs.map((m) => m.node.name.toLowerCase()).join(' or ')}.`
          : `No cited mechanism is recorded for ${from.name} yet.`,
        ...(broad.length
          ? [`Symptom overlap is limited to common features (${broad.slice(0, 4).join(', ')}), which many unrelated conditions share.`]
          : []),
      ],
      nextQuestions: [
        ...mechs.map(
          (m) => `Which other genes act through ${m.node.name.toLowerCase()}? Extending the search beyond the four genes in this slice could answer that.`,
        ),
        'Has the mechanism been tested for the specific variants in your community?',
        'Are there researchers outside this sample who study the same pathway? A wider NIH RePORTER and PubMed search would show them.',
      ],
      coverage: this.coverage(),
    }
  }

  // ---------- assets, people, funding ----------

  assetsFor(diseaseIds: string[]): AssetRecord[] {
    const out = new Map<string, AssetRecord>()
    for (const e of this.live()) {
      if (!(e.relation === 'asset_disease' || e.relation === 'study_disease') || !diseaseIds.includes(e.to)) continue
      const node = this.must(e.from)
      const prev = out.get(node.id)
      if (prev) {
        prev.diseases.push(this.must(e.to))
        continue
      }
      out.set(node.id, this.assetRecord(node, e))
    }
    return [...out.values()]
  }

  private assetRecord(node: AtlasNode, edge: Edge): AssetRecord {
    const p = node.props
    const category: AssetCategory =
      node.type === 'study' ? 'study' : (ASSET_CATEGORY[str(p.kind) ?? ''] ?? (node.type === 'funding' ? 'funded_research' : 'patient_data'))
    return {
      node,
      category,
      diseases: [this.must(edge.to)],
      edge,
      url: str(p.url) ?? str(p.source_url),
      nextStep: str(p.next_step),
      reuse: str(p.reuse_status),
      access: str(p.access),
      status: str(p.status) ?? str(p.recruitment_status),
    }
  }

  allAssets(): AssetRecord[] {
    return this.assetsFor(this.diseases().map((d) => d.id))
  }

  duplicates(assets: AssetRecord[]): DuplicateSignal[] {
    const out: DuplicateSignal[] = []
    for (const cluster of this.g.clusters) {
      const clusterGenes = new Set(
        this.live()
          .filter((e) => e.relation === 'disease_mechanism' && e.stance === 'supports' && cluster.mechanismIds.includes(e.to))
          .map((e) => this.geneOf(e.from)?.name)
          .filter((g): g is string => !!g),
      )
      const geneOfAsset = (a: AssetRecord) => a.diseases.map((d) => this.geneOf(d.id)?.name).find((g) => g && clusterGenes.has(g))
      for (const category of ['patient_data', 'funded_research', 'biosamples'] as AssetCategory[]) {
        const inCluster = assets.filter((a) => a.category === category && (a.node.clusters.includes(cluster.id) || geneOfAsset(a)))
        const genes = [...new Set(inCluster.map(geneOfAsset).filter((g): g is string => !!g))]
        if (inCluster.length >= 2 && genes.length >= 2) {
          const what = category === 'funded_research' ? 'funded projects' : category === 'patient_data' ? 'patient data efforts' : 'sample collections'
          out.push({
            category,
            clusterId: cluster.id,
            assets: inCluster,
            note: `${inCluster.length} ${what} cover different genes in "${cluster.label}" (${genes.join(', ')}). Compare their designs before starting another; titles alone do not show whether they test the same mechanism.`,
          })
        }
      }
    }
    return out
  }

  investigators(): InvestigatorRecord[] {
    const people = [...this.g.nodes.values()].filter((n) => n.type === 'investigator')
    return people
      .map((node) => {
        const edges = this.live().filter((e) => e.from === node.id && (e.relation === 'investigator_disease' || e.relation === 'investigator_award'))
        const diseases = edges.filter((e) => e.relation === 'investigator_disease').map((e) => this.must(e.to))
        const awards = edges.filter((e) => e.relation === 'investigator_award').map((e) => this.must(e.to))
        const clusters = [...new Set(diseases.flatMap((d) => d.clusters))]
        const diseaseClusters = diseases.map((d) => d.clusters)
        const sharedAcrossClusters =
          diseases.length >= 2 && diseaseClusters.some((a, i) => diseaseClusters.some((b, j) => j > i && !a.some((c) => b.includes(c))))
        return {
          node,
          diseases,
          clusters,
          awards,
          edges,
          sharedAcrossClusters,
          organization: str(node.props.award_recipient_organization),
          profileUrl: str(node.props.source_url),
          contactPolicy: str(node.props.contact_policy),
        }
      })
      .sort((a, b) => Number(b.sharedAcrossClusters) - Number(a.sharedAcrossClusters) || b.diseases.length - a.diseases.length || a.node.name.localeCompare(b.node.name))
  }

  funding(): { records: FundingRecord[]; gaps: FundingGap[] } {
    const awards = [...this.g.nodes.values()].filter((n) => n.type === 'funding')
    const records: FundingRecord[] = awards.map((award) => {
      const p = award.props
      const funders = Array.isArray(p.funder) ? (p.funder as Record<string, unknown>[]) : []
      const f = funders[0] ?? {}
      return {
        award,
        funder: 'NIH',
        institute: str(f.abbreviation) ?? str(p.administering_institute),
        fiscalYear: typeof p.fiscal_year === 'number' ? p.fiscal_year : null,
        totalCost: typeof f.total_cost === 'number' ? f.total_cost : null,
        organization: str(p.organization),
        projectNumber: str(p.core_project_num) ?? award.ids.find((i) => i.namespace === 'NIHProject')?.value ?? null,
        url: str(p.url) ?? str(p.source_url),
        investigators: this.live().filter((e) => e.relation === 'investigator_award' && e.to === award.id).map((e) => this.must(e.from)),
        diseases: this.live().filter((e) => e.relation === 'asset_disease' && e.from === award.id).map((e) => this.must(e.to)),
      }
    })
    const funded = new Set(records.flatMap((r) => r.diseases.map((d) => d.id)))
    const reporter = (this.coverageFile.queries ?? []).filter((q) => q.source === 'reporter')
    const gaps: FundingGap[] = this.diseases()
      .filter((d) => !funded.has(d.id))
      .map((d) => {
        const gene = this.geneOf(d.id)?.name
        const q = reporter.find((x) => gene && x.query === gene)
        return {
          disease: d,
          note: q
            ? `No award linked in this sample. The ${gene} search returned ${q.total_count} RePORTER records and ${q.retrieved_count} were reviewed, so this is a gap in the sample, not proof of no funding.`
            : 'No award linked in this sample.',
        }
      })
    return { records, gaps }
  }

  // ---------- action plan ----------

  actionPlan(diseaseId: string): ActionPlan {
    const disease = this.must(diseaseId)
    const parent = this.parentOf(diseaseId)
    const conns = this.connections(diseaseId)
    const viable = conns.filter((c) => c.kind === 'mechanism' && c.supported && c.disease.id)
    const network = conns.filter((c) => c.kind === 'investigator')
    const contradicted = conns.filter((c) => c.kind !== 'mechanism' && c.qualifiers.some((q) => q.from === c.disease.id))
    const unsupported = [
      ...contradicted,
      ...conns.filter((c) => c.kind === 'phenotype'),
      ...conns.filter((c) => c.kind === 'mechanism' && !c.supported),
    ]

    const ownIds = [diseaseId, ...(parent ? [parent.id] : [])]
    const partnerIds = viable.flatMap((c) => [c.disease.id, ...(this.parentOf(c.disease.id) ? [this.parentOf(c.disease.id)!.id] : [])])
    const all = this.assetsFor([...ownIds, ...partnerIds])
    const assets = all.filter((a) => a.category !== 'study')
    const studies = all.filter((a) => a.category === 'study')

    const investigatorIds = new Set([
      ...network.map((c) => c.via[0]!.id),
      ...this.live().filter((e) => e.relation === 'investigator_disease' && [...ownIds, ...partnerIds].includes(e.to)).map((e) => e.from),
    ])
    const partners = this.investigators().filter((r) => investigatorIds.has(r.node.id))

    const doThisWeek: ActionItem[] = []
    const nextExperiments: ActionItem[] = []
    const top = viable[0]
    if (top) {
      const route = this.route(diseaseId, top.disease.id)
      const group = top.communities[0]
      if (group && route) {
        doThisWeek.push({
          id: 'write-partner',
          title: `Write to ${group.group.name}`,
          detail: `Share the cited evidence that ${disease.name} and ${top.disease.name} both involve ${top.via[0]!.name.toLowerCase()}, and ask which questions need expert review before working together.`,
          edgeIds: [...route.steps, ...route.communitySteps].map((s) => s.edge.id),
          url: str(group.group.props.url),
        })
      }
      const registry = assets.find((a) => a.category === 'patient_data' && partnerIds.some((p) => a.diseases.some((d) => d.id === p)))
      if (registry) {
        doThisWeek.push({
          id: 'read-registry',
          title: `Read how ${registry.node.name} is set up`,
          detail: registry.nextStep ?? 'Read the registry’s public researcher information.',
          edgeIds: [registry.edge.id],
          url: registry.url,
        })
      }
      for (const s of route?.steps ?? []) {
        if (s.edge.relation === 'disease_mechanism') {
          nextExperiments.push({
            id: `confirm-${s.edge.id}`,
            title: `Confirm the mechanism for ${s.subject.name} variants`,
            detail: `${s.edge.scope ?? ''} A functional test of the variants in your families would show whether the shared mechanism applies to them.`.trim(),
            edgeIds: [s.edge.id],
            url: s.edge.evidence[0]?.url ?? null,
          })
        }
      }
      if (registry) {
        nextExperiments.push({
          id: 'compare-measures',
          title: 'Compare what each community measures',
          detail: `Map ${registry.node.name}'s outcome measures against what your families already record, to see whether one shared natural history design could cover both conditions.`,
          edgeIds: [registry.edge.id],
          url: registry.url,
        })
      }
    }
    const shared = partners.find((p) => p.sharedAcrossClusters)
    if (shared) {
      doThisWeek.push({
        id: 'contact-investigator',
        title: `Ask ${shared.node.name}'s team whether they see the overlap`,
        detail: `Listed on NIH awards for ${shared.diseases.map((d) => d.name).join(', ')}. Use the institution's public contact route; the atlas does not hold personal contact details.`,
        edgeIds: shared.edges.map((e) => e.id),
        url: shared.profileUrl,
      })
    }
    const own = this.communitiesOf(diseaseId)[0]
    if (!top && own) {
      doThisWeek.push({
        id: 'own-community',
        title: `Talk to ${own.group.name}`,
        detail: str(own.group.props.next_step) ?? 'Contact the foundation through its public site.',
        edgeIds: [own.edge.id],
        url: str(own.group.props.url),
      })
    }

    return {
      disease,
      ownCommunities: this.communitiesOf(diseaseId),
      viable,
      network,
      unsupported: [...new Map(unsupported.map((c) => [c.disease.id, c])).values()],
      assets,
      duplicates: this.duplicates(this.allAssets().filter((a) => a.category !== 'study')).filter((d) =>
        d.assets.some((a) => a.diseases.some((x) => [...ownIds, ...partnerIds].includes(x.id))),
      ),
      studies,
      partners,
      nextExperiments,
      doThisWeek,
      noRoute: viable.length === 0 ? this.noRoute(diseaseId) : null,
    }
  }

  // ---------- mechanism ranking (Biotech Scout) ----------

  mechanisms(): AtlasNode[] {
    return [...this.g.nodes.values()].filter((n) => n.type === 'mechanism').sort((a, b) => a.name.localeCompare(b.name))
  }

  rankClusters(opts: { effects?: MechanismEffect[]; mechanismId?: string }): RankedCluster[] {
    const matches = this.g.clusters.filter((c) => {
      if (opts.mechanismId) return c.mechanismIds.includes(opts.mechanismId)
      const effects = c.mechanismIds.map((id) => this.node(id)?.props.effect)
      return (opts.effects ?? []).some((e) => effects.includes(e) || c.effect === e)
    })
    const ranked = matches.map((cluster) => {
      const mechanismEdges = this.live().filter((e) => e.relation === 'disease_mechanism' && cluster.mechanismIds.includes(e.to))
      const supporting = mechanismEdges.filter((e) => e.stance === 'supports')
      const diseases = [...new Map(supporting.map((e) => [e.from, this.must(e.from)])).values()]
      const ids = diseases.flatMap((d) => [d.id, ...(this.parentOf(d.id) ? [this.parentOf(d.id)!.id] : [])])
      const groups = [...new Map(diseases.flatMap((d) => this.communitiesOf(d.id)).map((c) => [c.group.id, c.group])).values()]
      const records = this.assetsFor(ids)
      const infrastructure = records.filter((a) => a.category !== 'study')
      const studies = records.filter((a) => a.category === 'study')
      const contacts = this.investigators().filter((r) => r.diseases.some((d) => ids.includes(d.id)))
      const unmetNeeds: string[] = []
      for (const d of diseases) {
        if (this.communitiesOf(d.id).length === 0) unmetNeeds.push(`No patient organization linked to ${d.name} in this atlas.`)
      }
      if (!infrastructure.some((a) => a.category === 'patient_data')) unmetNeeds.push('No registry or natural history study linked.')
      if (!studies.some((s) => s.status === 'RECRUITING')) unmetNeeds.push('No recruiting interventional or observational study linked.')
      return {
        cluster,
        rank: 0,
        diseases,
        mechanismEdges,
        groups,
        infrastructure,
        studies,
        contacts,
        qualifiers: mechanismEdges.filter((e) => e.stance === 'contradicts'),
        unmetNeeds,
      }
    })
    ranked.sort(
      (a, b) =>
        b.diseases.length - a.diseases.length ||
        Number(b.infrastructure.some((x) => x.category === 'patient_data')) - Number(a.infrastructure.some((x) => x.category === 'patient_data')) ||
        b.groups.length - a.groups.length ||
        b.contacts.length - a.contacts.length ||
        a.cluster.label.localeCompare(b.cluster.label),
    )
    return ranked.map((r, i) => ({ ...r, rank: i + 1 }))
  }

  // ---------- coverage, review ----------

  coverage(): Coverage {
    const c = this.coverageFile
    const bySource = new Map<SourceType, number>()
    const seen = new Set<string>()
    for (const e of this.g.edges) {
      for (const ev of e.evidence) {
        if (seen.has(ev.id)) continue
        seen.add(ev.id)
        bySource.set(ev.sourceType, (bySource.get(ev.sourceType) ?? 0) + 1)
      }
    }
    const nodes = [...this.g.nodes.values()]
    const observed = this.g.edges.filter((e) => e.basis === 'observed' && !e.sample)
    return {
      snapshotDate: c.snapshot_date ?? '',
      scope: c.selection_reason ?? '',
      genes: [c.primary_gene, ...(c.neighbor_genes ?? [])].filter((g): g is string => !!g),
      queries: (c.queries ?? []).map((q) => ({
        source: q.source,
        query: q.query,
        total: q.total_count,
        retrieved: q.retrieved_count,
        truncated: q.truncated,
        retrievedAt: q.retrieved_at,
      })),
      limitations: c.limitations ?? [],
      counts: { nodes: nodes.length, edges: observed.length, evidence: this.g.evidenceCount, clusters: this.g.clusters.length },
      evidenceBySource: [...bySource.entries()].map(([sourceType, count]) => ({ sourceType, count })).sort((a, b) => b.count - a.count),
      nodesWithOntologyIds: nodes.filter((n) => n.ids.length > 0).length,
      scoredEdges: this.g.edges.filter((e) => e.confidence !== null).length,
    }
  }

  reviewQueue(decisions: Record<string, 'approved' | 'rejected'> = {}): ReviewItem[] {
    return this.g.edges
      .filter((e) => e.basis === 'inferred' || e.tier === 'D')
      .map((edge) => ({
        edge,
        from: this.must(edge.from),
        to: this.must(edge.to),
        origin: edge.tier === 'D' ? ('contributed' as const) : ('inferred' as const),
        decision: decisions[edge.id] ?? null,
      }))
      .sort((a, b) => Number(a.decision !== null) - Number(b.decision !== null) || a.edge.relation.localeCompare(b.edge.relation))
  }
}
