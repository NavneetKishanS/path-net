// Answers questions from the atlas only. Every listed item carries the edges that justify it,
// so the UI can show a citation for each; nothing is generated beyond what the ApiClient returns.
import type { ApiClient } from '@/lib/api/client'
import type { AssetCategory, AtlasNode, Edge, GraphData } from '@/lib/model'
import type { DetailLevel, PanelId } from '@/lib/roles'
import { edgeSentence, formatDate, formatMoney, studyStatusText } from '@/lib/copy'
import { diseasesOfGene, findEntities, type Found } from './entities'

export type Intent =
  'route' | 'contradictions' | 'funding' | 'resources' | 'action' | 'connections' | 'people' | 'mechanism' | 'overview'

export interface AnswerItem {
  title: string
  /** Internal page with the full record. */
  href?: string
  /** Public source page. */
  url?: string
  detail?: string
  edges: Edge[]
  tone?: 'inferred' | 'contradicts'
}

export interface AnswerLink {
  label: string
  href: string
  /** Hidden when the role cannot open this panel. */
  panel: PanelId
}

export interface ChatAnswer {
  intent: Intent | 'not_in_atlas' | 'unclear'
  /** Set when the subject came from the page or the previous answer, not the question. */
  context: string | null
  lead: string
  leadEdges: Edge[]
  items: AnswerItem[]
  caveats: string[]
  links: AnswerLink[]
  subjectId: string | null
}

export interface ChatContext {
  /** Condition, gene or mechanism the user is looking at. */
  focusId: string | null
  /** Subject of the previous answer, for follow-ups like "who works on it?". */
  lastSubjectId: string | null
  detail: DetailLevel
}

const INTENTS: [Intent, RegExp][] = [
  ['route', /\b(why|how)\b.*\b(connected|linked|related|connect|link)\b/],
  ['contradictions', /\b(contradict\w*|against|refut\w*|conflict\w*|disagree\w*)\b/],
  ['funding', /\b(fund\w*|grants?|awards?|nih|money|financ\w*)\b/],
  [
    'resources',
    /\b(stud(y|ies)|trials?|registr(y|ies)|natural history|biorepositor(y|ies)|biobank|resources?|assets?|data)\b/,
  ],
  ['action', /\b(this week|next steps?|what (should|can) (we|i)|do next|action|plan)\b/],
  [
    'connections',
    /\b(share\w*|similar|closest|related|connections?|partners?|communit(y|ies)|groups?|other (conditions|diseases))\b/,
  ],
  ['people', /\b(who|researchers?|investigators?|experts?|labs?|scientists?|works? on|working on)\b/],
  ['mechanism', /\b(mechanisms?|cause\w*|biology|variants?|gain of function|loss of function)\b/],
]

export function classify(question: string): Intent {
  const q = question.toLowerCase()
  return INTENTS.find(([, re]) => re.test(q))?.[0] ?? 'overview'
}

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  patient_data: 'Registry or natural history data',
  biosamples: 'Biosamples',
  funded_research: 'Funded research',
  study: 'Clinical study',
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const names = (ns: AtlasNode[]) => ns.map((n) => n.name).join(', ')
const uniqEdges = (es: (Edge | null | undefined)[]) => [
  ...new Map(es.filter((e): e is Edge => !!e).map((e) => [e.id, e])).values(),
]

interface Subject {
  diseases: AtlasNode[]
  mechanisms: AtlasNode[]
  gene: AtlasNode | null
  /** The node later questions can refer back to. */
  anchor: AtlasNode | null
  fromContext: boolean
}

function resolveSubject(found: Found, graph: GraphData, ctx: ChatContext): Subject | null {
  const fromNode = (node: AtlasNode, fromContext: boolean): Subject | null => {
    if (node.type === 'disease') return { diseases: [node], mechanisms: [], gene: null, anchor: node, fromContext }
    if (node.type === 'gene')
      return { diseases: diseasesOfGene(node.id, graph), mechanisms: [], gene: node, anchor: node, fromContext }
    if (node.type === 'mechanism') return { diseases: [], mechanisms: [node], gene: null, anchor: node, fromContext }
    return null
  }
  if (found.diseases.length)
    return { diseases: found.diseases, mechanisms: [], gene: null, anchor: found.diseases[0]!, fromContext: false }
  if (found.genes.length) {
    const gene = found.genes[0]!
    const diseases = [...new Set(found.genes.flatMap((g) => diseasesOfGene(g.id, graph)))]
    return { diseases, mechanisms: [], gene, anchor: gene, fromContext: false }
  }
  if (found.mechanisms.length)
    return { diseases: [], mechanisms: found.mechanisms, gene: null, anchor: found.mechanisms[0]!, fromContext: false }
  for (const id of [ctx.lastSubjectId, ctx.focusId]) {
    const node = id ? graph.nodes.find((n) => n.id === id) : undefined
    const s = node && fromNode(node, true)
    if (s) return s
  }
  return null
}

/** Conditions with a cited (supporting) disease_mechanism edge to any of these mechanisms. */
function conditionsWith(mechs: AtlasNode[], graph: GraphData) {
  const ids = new Set(mechs.map((m) => m.id))
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  return graph.edges
    .filter((e) => e.relation === 'disease_mechanism' && e.stance === 'supports' && ids.has(e.to))
    .map((edge) => ({ disease: byId.get(edge.from)!, edge }))
    .filter((x) => x.disease)
}

function blank(intent: ChatAnswer['intent'], subject: Subject | null): ChatAnswer {
  return {
    intent,
    context: subject?.fromContext && subject.anchor ? `About ${subject.anchor.name}.` : null,
    lead: '',
    leadEdges: [],
    items: [],
    caveats: [],
    links: [],
    subjectId: subject?.anchor?.id ?? null,
  }
}

export async function answerQuestion(api: ApiClient, question: string, ctx: ChatContext): Promise<ChatAnswer> {
  const graph = await api.getGraph()
  const found = findEntities(question, graph)
  const subject = resolveSubject(found, graph, ctx)
  const intent = classify(question)

  if (found.unknown.length && !found.diseases.length && !found.genes.length && !found.mechanisms.length) {
    const coverage = await api.getCoverage()
    const a = blank('not_in_atlas', null)
    a.lead = `${found.unknown.join(', ')} ${found.unknown.length === 1 ? 'is' : 'are'} not in this atlas, so there is no supported answer.`
    a.caveats = [
      `This atlas covers conditions linked to ${coverage.genes.length} genes (${coverage.genes.join(', ')}), from sources retrieved ${formatDate(coverage.snapshotDate)}.`,
      'Not being in the atlas is not evidence that no research exists.',
    ]
    return a
  }

  // Questions about all contradictions do not need a subject.
  if (!subject && intent !== 'contradictions') {
    const coverage = await api.getCoverage()
    const a = blank('unclear', null)
    a.lead = 'I could not find a condition, gene or mechanism from this atlas in that question.'
    a.caveats = [
      `Name one of the ${coverage.genes.length} genes in scope (${coverage.genes.join(', ')}), a condition such as DEE13, or a mechanism such as sodium channel gain of function.`,
    ]
    return a
  }

  const a = await build(intent, api, graph, subject, found, ctx)
  if (found.unknown.length) a.caveats.push(`${found.unknown.join(', ')} is not in this atlas and was left out.`)
  return a
}

async function build(
  intent: Intent,
  api: ApiClient,
  graph: GraphData,
  subject: Subject | null,
  found: Found,
  ctx: ChatContext,
): Promise<ChatAnswer> {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const edges = new Map(graph.edges.map((e) => [e.id, e]))
  const a = blank(intent, subject)

  // Mechanism-only questions are about the conditions that carry the mechanism.
  const mechConds = subject && subject.mechanisms.length ? conditionsWith(subject.mechanisms, graph) : []
  const diseases = subject?.diseases.length ? subject.diseases : [...new Set(mechConds.map((x) => x.disease))]
  const ids = new Set(diseases.map((d) => d.id))
  const main = diseases[0] ?? null
  const label = subject?.gene?.name ?? subject?.anchor?.name ?? ''
  const mechIntro = () => {
    if (!mechConds.length) return
    a.lead = `Conditions with cited evidence for ${subject!.mechanisms.map((m) => m.name.toLowerCase()).join(' or ')}: ${names([...new Set(mechConds.map((x) => x.disease))])}.`
    a.leadEdges = mechConds.map((x) => x.edge)
  }

  switch (intent) {
    case 'route': {
      const pair =
        found.diseases.length >= 2
          ? found.diseases
          : main && ctx.focusId && ctx.focusId !== main.id
            ? [nodes.get(ctx.focusId)!, main]
            : null
      if (!pair || !pair[0] || !pair[1] || pair[0].type !== 'disease') {
        a.lead = 'Name two conditions to see whether a cited route connects them.'
        return a
      }
      const [from, to] = pair as [AtlasNode, AtlasNode]
      a.subjectId = from.id
      const route = await api.getRoute(from.id, to.id)
      if (!route) {
        a.lead = `No supported route connects ${from.name} and ${to.name} in this atlas.`
        a.caveats.push('They may share common symptoms, but that alone is not evidence of shared biology.')
        return a
      }
      a.lead =
        route.kind === 'investigator'
          ? `${from.name} and ${to.name} are linked through ${route.via.name}, who is listed on NIH awards for both. That is shared expertise, not shared biology.`
          : `${from.name} and ${to.name} are linked through ${route.via.name.toLowerCase()}. The link is inferred from these cited steps:`
      a.leadEdges = uniqEdges([route.inferredEdge])
      a.items = route.steps.map((s) => ({
        title: edgeSentence(s.edge, s.subject, s.object, false),
        edges: [s.edge],
      }))
      a.items.push(...qualifierItems(route.qualifiers, nodes))
      a.caveats.push(...route.differences.slice(0, 2))
      a.links.push({ label: 'Open the full explanation', href: `/route?from=${from.id}&to=${to.id}`, panel: 'explain' })
      return a
    }

    case 'contradictions': {
      const all = graph.edges.filter((e) => e.stance === 'contradicts')
      const scoped = ids.size ? all.filter((e) => ids.has(e.from) || ids.has(e.to)) : all
      const list = scoped.length ? scoped : all
      a.lead = !all.length
        ? 'No contradicting evidence is recorded in this atlas.'
        : scoped.length || !ids.size
          ? `${plural(list.length, 'cited finding')} argue${list.length === 1 ? 's' : ''} against a link${ids.size ? ` for ${label}` : ' in this atlas'}.`
          : `No contradicting evidence is recorded for ${label}. Across the atlas, ${plural(list.length, 'finding')} argue${list.length === 1 ? 's' : ''} against a link:`
      a.items = qualifierItems(list, nodes)
      if (list.length)
        a.caveats.push('Contradicting evidence is shown beside a link and never used to support a route.')
      return a
    }

    case 'funding': {
      mechIntro()
      const { records, gaps } = await api.getFunding()
      const mine = records.filter((r) => r.diseases.some((d) => ids.has(d.id)))
      const lead = mine.length
        ? `${plural(mine.length, 'NIH award')} in this sample cover${mine.length === 1 ? 's' : ''} ${label}.`
        : `No NIH award in this sample is linked to ${label}.`
      a.lead = a.lead ? `${a.lead} ${lead}` : lead
      a.items = mine.map((r) => ({
        title: r.award.name,
        href: `/node/${r.award.id}`,
        url: r.url ?? undefined,
        detail: [
          r.institute,
          r.fiscalYear ? `FY ${r.fiscalYear}` : null,
          r.organization,
          ctx.detail === 'technical' && r.totalCost !== null ? formatMoney(r.totalCost) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        edges: graph.edges.filter((e) => e.relation === 'asset_disease' && e.from === r.award.id && ids.has(e.to)),
      }))
      a.caveats.push(...gaps.filter((g) => ids.has(g.disease.id)).map((g) => `${g.disease.name}: ${g.note}`))
      a.links.push({ label: 'All funding', href: '/funding', panel: 'funding' })
      return a
    }

    case 'resources': {
      mechIntro()
      const { assets } = await api.getAssets()
      const mine = assets.filter((r) => r.category !== 'funded_research' && r.diseases.some((d) => ids.has(d.id)))
      const lead = mine.length
        ? `${plural(mine.length, 'registry, study or sample collection', 'registries, studies and sample collections')} in this atlas cover ${label}.`
        : `No registry, study or sample collection in this atlas is linked to ${label}.`
      a.lead = a.lead ? `${a.lead} ${lead}` : lead
      a.items = mine.map((r) => ({
        title: r.node.name,
        href: `/node/${r.node.id}`,
        url: r.url ?? undefined,
        detail: [
          CATEGORY_LABEL[r.category],
          r.category === 'study' ? studyStatusText(r.status) : null,
          r.access ? `Access: ${r.access}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        edges: [r.edge],
      }))
      if (mine.some((r) => r.category === 'study'))
        a.caveats.push('A listed study is not an invitation to enrol. Check its current status on the record.')
      if (main) a.links.push({ label: 'Open the action plan', href: `/action/${main.id}`, panel: 'action' })
      return a
    }

    case 'action': {
      if (!main) return mechanismAnswer(a, subject, graph, nodes)
      const plan = await api.getActionPlan(main.id)
      a.lead = plan.doThisWeek.length
        ? `${plural(plan.doThisWeek.length, 'step')} for ${main.name} this week, each based on a cited link:`
        : `The atlas has no concrete next step for ${main.name} yet.`
      a.items = plan.doThisWeek.map((s) => ({
        title: s.title,
        detail: s.detail,
        url: s.url ?? undefined,
        edges: uniqEdges(s.edgeIds.map((id) => edges.get(id))),
      }))
      if (plan.noRoute) a.caveats.push(`No other condition shares a cited mechanism with ${main.name}.`)
      a.links.push({ label: 'Open the action plan', href: `/action/${main.id}`, panel: 'action' })
      return a
    }

    case 'connections': {
      if (!main || (subject?.mechanisms.length && !subject.diseases.length)) {
        mechIntro()
        if (!a.lead) a.lead = `No condition in this atlas has cited evidence for ${label}.`
        a.items = mechConds.map((x) => ({ title: x.disease.name, href: `/disease/${x.disease.id}`, edges: [x.edge] }))
        return a
      }
      const conns = await api.getConnections(main.id)
      const mech = conns.filter((c) => c.kind === 'mechanism')
      const people = conns.filter((c) => c.kind === 'investigator')
      const symptoms = conns.filter((c) => c.kind === 'phenotype')
      a.lead = mech.length
        ? `${plural(mech.length, 'condition')} share${mech.length === 1 ? 's' : ''} a cited mechanism with ${main.name}. Each link is inferred from cited findings; open the explanation to check every step.`
        : `No condition in this atlas shares a cited mechanism with ${main.name}, so no supported route is shown.`
      a.items = mech.map((c) => ({
        title: c.disease.name,
        href: `/route?from=${main.id}&to=${c.disease.id}`,
        detail: [
          c.reason,
          c.communities.length ? `Community: ${c.communities.map((x) => x.group.name).join(', ')}.` : null,
          c.supported ? null : 'Not every step is an observed, supporting finding.',
        ]
          .filter(Boolean)
          .join(' '),
        edges: uniqEdges([c.inferredEdge, ...c.communities.map((x) => x.edge)]),
        tone: 'inferred' as const,
      }))
      a.items.push(...qualifierItems(uniqEdges(mech.flatMap((c) => c.qualifiers)), nodes))
      a.items.push(
        ...people.map((c) => ({
          title: c.disease.name,
          href: `/route?from=${main.id}&to=${c.disease.id}`,
          detail: c.reason,
          edges: uniqEdges([c.inferredEdge]),
          tone: 'inferred' as const,
        })),
      )
      if (symptoms.length)
        a.caveats.push(
          `${plural(symptoms.length, 'condition shares', 'conditions share')} only common symptoms with ${main.name}. That is not evidence of shared biology, so they are not listed.`,
        )
      a.links.push({ label: 'Open the action plan', href: `/action/${main.id}`, panel: 'action' })
      return a
    }

    case 'people': {
      mechIntro()
      const people = (await api.getPeople()).filter((p) => p.diseases.some((d) => ids.has(d.id)))
      const lead = people.length
        ? `${plural(people.length, 'investigator')} in this sample ${people.length === 1 ? 'is' : 'are'} listed on NIH awards for ${subject?.mechanisms.length ? 'these conditions' : label}.`
        : `No investigator in this sample is linked to ${subject?.mechanisms.length ? 'these conditions' : label}.`
      a.lead = a.lead ? `${a.lead} ${lead}` : lead
      a.items = people.map((p) => ({
        title: p.node.name,
        href: `/node/${p.node.id}`,
        detail: [
          p.organization,
          names(p.diseases.filter((d) => ids.has(d.id))),
          p.sharedAcrossClusters ? 'Works across mechanisms' : null,
        ]
          .filter(Boolean)
          .join(' · '),
        edges: p.edges.filter((e) => e.relation === 'investigator_disease' && ids.has(e.to)),
      }))
      if (people.length)
        a.caveats.push(
          "Contact them through their institution's public pages. The atlas holds no personal contact details.",
        )
      a.links.push({ label: 'All investigators', href: '/people', panel: 'people' })
      return a
    }

    case 'mechanism':
      return mechanismAnswer(a, subject, graph, nodes)

    case 'overview': {
      if (!main || (subject?.mechanisms.length && !subject.diseases.length))
        return mechanismAnswer(a, subject, graph, nodes)
      const plan = await api.getActionPlan(main.id)
      const own = graph.edges.filter((e) => e.from === main.id)
      const gene = own.find((e) => e.relation === 'disease_gene' && e.stance === 'supports')
      a.lead = `What the atlas holds on ${main.name}:`
      if (gene) a.items.push({ title: `Gene: ${nodes.get(gene.to)?.name}`, edges: [gene] })
      for (const e of own.filter((x) => x.relation === 'disease_mechanism')) {
        a.items.push({
          title: `${e.stance === 'contradicts' ? 'Evidence against' : 'Mechanism'}: ${nodes.get(e.to)?.name}`,
          detail: e.scope ?? undefined,
          edges: [e],
          tone: e.stance === 'contradicts' ? 'contradicts' : undefined,
        })
      }
      for (const c of plan.ownCommunities) {
        a.items.push({
          title: `Community: ${c.group.name}`,
          href: `/node/${c.group.id}`,
          detail: c.viaParent ? `Serves ${c.viaParent.name}, which includes this condition.` : undefined,
          edges: [c.edge],
        })
      }
      if (!plan.ownCommunities.length)
        a.caveats.push(`No patient organization is linked to ${main.name} in this atlas.`)
      const top = plan.viable[0]
      if (top?.inferredEdge)
        a.items.push({
          title: `Closest connection: ${top.disease.name}`,
          href: `/route?from=${main.id}&to=${top.disease.id}`,
          detail: top.reason,
          edges: [top.inferredEdge],
          tone: 'inferred',
        })
      a.links.push({ label: `Open ${main.name}`, href: `/disease/${main.id}`, panel: 'search' })
      return a
    }
  }
}

function qualifierItems(list: Edge[], nodes: Map<string, AtlasNode>): AnswerItem[] {
  return list.flatMap((e) => {
    const from = nodes.get(e.from)
    const to = nodes.get(e.to)
    if (!from || !to) return []
    return [
      {
        title: edgeSentence(e, from, to, false),
        detail: e.scope ?? undefined,
        edges: [e],
        tone: 'contradicts' as const,
      },
    ]
  })
}

function mechanismAnswer(a: ChatAnswer, subject: Subject | null, graph: GraphData, nodes: Map<string, AtlasNode>) {
  a.intent = 'mechanism'
  if (subject?.mechanisms.length && !subject.diseases.length) {
    const conds = conditionsWith(subject.mechanisms, graph)
    a.lead = conds.length
      ? `${plural(conds.length, 'condition')} in this atlas ${conds.length === 1 ? 'has' : 'have'} cited evidence for ${subject.mechanisms.map((m) => m.name.toLowerCase()).join(' or ')}:`
      : `No condition in this atlas has cited evidence for ${subject.mechanisms[0]!.name.toLowerCase()}.`
    a.items = conds.map((x) => ({
      title: x.disease.name,
      href: `/disease/${x.disease.id}`,
      detail: x.edge.scope ?? undefined,
      edges: [x.edge],
    }))
    a.items.push(
      ...qualifierItems(
        graph.edges.filter(
          (e) => e.stance === 'contradicts' && subject.mechanisms.some((m) => m.id === e.to || m.id === e.from),
        ),
        nodes,
      ),
    )
    return a
  }
  const ids = new Set(subject?.diseases.map((d) => d.id) ?? [])
  const found = graph.edges.filter((e) => e.relation === 'disease_mechanism' && ids.has(e.from))
  if (subject?.gene) {
    const variants = new Set(
      graph.edges.filter((e) => e.relation === 'variant_of' && e.to === subject.gene!.id).map((e) => e.from),
    )
    found.push(...graph.edges.filter((e) => e.relation === 'gene_variant_mechanism' && variants.has(e.from)))
  }
  const label = subject?.gene?.name ?? subject?.anchor?.name ?? 'this condition'
  a.lead = found.length
    ? `${plural(found.length, 'cited mechanism finding')} for ${label}:`
    : `No cited mechanism for ${label} is recorded in this atlas.`
  a.items = found.map((e) => {
    const from = nodes.get(e.from)!
    const to = nodes.get(e.to)!
    return {
      title: edgeSentence(e, from, to, false),
      detail: e.scope ?? undefined,
      edges: [e],
      tone: e.stance === 'contradicts' ? ('contradicts' as const) : undefined,
    }
  })
  return a
}
