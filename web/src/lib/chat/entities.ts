import type { AtlasNode, Cluster, Edge, GraphData } from '@/lib/model'
import { normalise } from '@/lib/engine/atlas'

const STOP = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'to', 'for', 'on', 'with', 'by'])
/** Gene-like tokens that are never gene symbols. */
const NOT_GENES = new Set(['NIH', 'FDA', 'HPO', 'NCT', 'PMID', 'DNA', 'RNA'])

export const clean = (s: string) =>
  ` ${normalise(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `
const tokens = (s: string) =>
  clean(s)
    .trim()
    .split(' ')
    .filter((t) => t && !STOP.has(t))

export interface Found {
  diseases: AtlasNode[]
  genes: AtlasNode[]
  mechanisms: AtlasNode[]
  /** Gene-like terms in the question that match nothing in the atlas. */
  unknown: string[]
}

interface Term {
  text: string
  node?: AtlasNode
  cluster?: Cluster
}

interface Hit extends Term {
  at: number
}

const TYPES = new Set(['disease', 'gene', 'mechanism'])

/** Named entities in a question. Exact names and synonyms first; mechanism classes also match on most of their words. */
export function findEntities(question: string, graph: GraphData): Found {
  const q = clean(question)
  const terms: Term[] = []
  for (const node of graph.nodes) {
    if (!TYPES.has(node.type)) continue
    for (const t of [node.name, ...node.synonyms]) {
      const text = clean(t)
      if (text.trim().length >= 3) terms.push({ text, node })
    }
  }
  for (const cluster of graph.clusters) terms.push({ text: clean(cluster.label), cluster })

  // Longest phrase wins, so "SCN2A-related disorder" is not also read as the gene SCN2A.
  terms.sort((a, b) => b.text.length - a.text.length)
  const taken: [number, number][] = []
  const hits: Hit[] = []
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = q.indexOf(term.text, from)
      if (at < 0) break
      const span: [number, number] = [at, at + term.text.length]
      if (!taken.some(([s, e]) => span[0] < e && s < span[1])) {
        taken.push(span)
        hits.push({ ...term, at })
      }
      from = at + 1
    }
  }

  // Mechanism classes are often paraphrased: accept most of the label's words.
  const qTokens = new Set(tokens(question))
  for (const cluster of graph.clusters) {
    if (hits.some((h) => h.cluster === cluster)) continue
    const words = tokens(cluster.label)
    const covered = words.filter((w) => qTokens.has(w)).length
    if (words.length >= 3 && covered / words.length >= 0.75)
      hits.push({ text: cluster.label, cluster, at: Number.MAX_SAFE_INTEGER })
  }
  hits.sort((a, b) => a.at - b.at)

  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const pick = (type: AtlasNode['type']) => [
    ...new Map(hits.filter((h) => h.node?.type === type).map((h) => [h.node!.id, h.node!])).values(),
  ]
  const mechanisms = new Map(pick('mechanism').map((n) => [n.id, n]))
  for (const h of hits) {
    for (const id of h.cluster?.mechanismIds ?? []) {
      const n = byId.get(id)
      if (n) mechanisms.set(id, n)
    }
  }

  const known = new Set(terms.map((t) => t.text.trim()))
  const unknown = [...new Set(question.match(/\b[A-Z]{2,}[0-9]{1,3}[A-Z]?\b/g) ?? [])].filter(
    (t) => !NOT_GENES.has(t) && !known.has(clean(t).trim()),
  )

  return { diseases: pick('disease'), genes: pick('gene'), mechanisms: [...mechanisms.values()], unknown }
}

/** Conditions caused by a gene, broadest first (most cited links). */
export function diseasesOfGene(geneId: string, graph: GraphData): AtlasNode[] {
  const ids = graph.edges
    .filter((e) => e.relation === 'disease_gene' && e.to === geneId && e.stance === 'supports')
    .map((e) => e.from)
  return graph.nodes
    .filter((n) => ids.includes(n.id))
    .sort((a, b) => degree(b.id, graph.edges) - degree(a.id, graph.edges) || a.name.localeCompare(b.name))
}

const degree = (id: string, edges: Edge[]) => edges.filter((e) => e.from === id || e.to === id).length
