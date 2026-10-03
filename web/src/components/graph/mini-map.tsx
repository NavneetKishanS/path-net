'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useGraph } from '@/lib/queries'
import { useHref } from '@/components/role/app-link'
import { nodeHref } from '@/components/search/global-search'
import { edgeParam } from '@/lib/url-state'
import { useInView } from '@/lib/use-in-view'
import type { GraphData } from '@/lib/model'
import { GraphFrame, LazyGraph } from './lazy-graph'
import { GraphLegend } from './graph-legend'
import { GraphTable } from './graph-table'

const HIDE = new Set(['phenotype', 'investigator', 'funding', 'variant'])

/** Neighbourhood of one condition, two steps out, without symptoms and people. */
export function neighbourhood(g: GraphData, focusId: string): GraphData {
  const type = new Map(g.nodes.map((n) => [n.id, n.type]))
  const visible = (id: string) => !HIDE.has(type.get(id) ?? 'phenotype')
  const keep = new Set([focusId])
  for (let i = 0; i < 2; i++) {
    const frontier = new Set(keep)
    for (const e of g.edges) {
      if (!visible(e.from) || !visible(e.to)) continue
      if (frontier.has(e.from) || frontier.has(e.to)) {
        keep.add(e.from)
        keep.add(e.to)
      }
    }
  }
  const nodes = g.nodes.filter((n) => keep.has(n.id) && (n.id === focusId || !HIDE.has(n.type)))
  const ids = new Set(nodes.map((n) => n.id))
  return { nodes, edges: g.edges.filter((e) => ids.has(e.from) && ids.has(e.to)), clusters: g.clusters }
}

export function MiniMap({ focusId, height = 340 }: { focusId: string; height?: number }) {
  const graph = useGraph()
  const router = useRouter()
  const href = useHref()
  const [edge, setEdge] = useQueryState('edge', edgeParam)
  const [asTable, setAsTable] = useState(false)
  const [box, inView] = useInView<HTMLDivElement>()
  const sub = useMemo(() => (graph.data ? neighbourhood(graph.data, focusId) : null), [graph.data, focusId])
  if (!sub || !inView)
    return (
      <div ref={box}>
        <GraphFrame height={height}>{null}</GraphFrame>
      </div>
    )
  const focus = sub.nodes.find((n) => n.id === focusId)
  const clusters = sub.clusters.filter((c) => sub.nodes.some((n) => n.clusters.includes(c.id)))
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="link text-label" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? 'Show as map' : 'Show as table'}
        </button>
      </div>
      {asTable ? (
        <GraphTable nodes={sub.nodes} edges={sub.edges} caption={`Links around ${focus?.name ?? focusId}`} />
      ) : (
        <GraphFrame height={height}>
          <LazyGraph
            nodes={sub.nodes}
            edges={sub.edges}
            clusters={clusters}
            selectedNode={focusId}
            selectedEdge={edge}
            onSelectEdge={(id) => void setEdge(id)}
            onSelectNode={(id) => {
              const n = id ? sub.nodes.find((x) => x.id === id) : null
              if (n && n.id !== focusId) router.push(href(nodeHref(n)))
            }}
            height={height}
            compact
            label={`Map of ${sub.nodes.length} records around ${focus?.name ?? focusId}. Use "Show as table" for a list.`}
          />
        </GraphFrame>
      )}
      <GraphLegend clusters={clusters} compact />
    </div>
  )
}
