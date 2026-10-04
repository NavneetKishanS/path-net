import type { AtlasNode, GraphData } from '@/lib/model'
import type { Role } from '@/lib/roles'
import { diseasesOfGene } from './entities'

/** The Patient Group Leader demo condition, used when nothing is in focus. */
const DEFAULT_DISEASE = 'dis_scn8a'

/** A short name people would type: "DEE13" rather than the full ontology label. */
function shortName(n: AtlasNode): string {
  const short = n.synonyms.find((s) => s.length <= 12 && /^[A-Z0-9-]+$/.test(s))
  return short ?? n.name
}

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export function suggestedQuestions(role: Role, graph: GraphData, focusId: string | null): string[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const focus = focusId ? byId.get(focusId) : undefined
  const geneDisease = focus?.type === 'gene' ? diseasesOfGene(focus.id, graph)[0] : undefined
  const disease =
    focus?.type === 'disease'
      ? focus
      : (geneDisease ?? byId.get(DEFAULT_DISEASE) ?? graph.nodes.find((n) => n.type === 'disease'))

  if (role === 'researcher') {
    const clusterId = (focus?.type === 'mechanism' ? focus.clusters[0] : disease?.clusters[0]) ?? graph.clusters[0]?.id
    const cluster = graph.clusters.find((c) => c.id === clusterId)
    const mechanism =
      focus?.type === 'mechanism' ? lc(focus.name) : cluster ? lc(cluster.label.replace(':', '')) : 'this mechanism'
    const geneEdge = disease && graph.edges.find((e) => e.from === disease.id && e.relation === 'disease_gene')
    const gene = (focus?.type === 'gene' ? focus : geneEdge && byId.get(geneEdge.to))?.name ?? 'STXBP1'
    return [
      `Who else works on ${mechanism}?`,
      'Which findings contradict a shared mechanism?',
      `Which NIH awards fund ${gene} research?`,
    ]
  }

  const name = disease ? shortName(disease) : 'our condition'
  return [
    `Which communities share a mechanism with ${name}?`,
    `What should we do this week about ${name}?`,
    `Who is researching ${name}?`,
  ]
}
