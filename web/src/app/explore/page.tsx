'use client'

import { useMemo, useState } from 'react'
import { useQueryState } from 'nuqs'
import { ArrowRight } from 'lucide-react'
import type { AtlasNode, GraphData, NodeType } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { Gate, Page, PageHeader, Pending } from '@/components/layout/page'
import { GraphFrame, LazyGraph } from '@/components/graph/lazy-graph'
import { GraphLegend } from '@/components/graph/graph-legend'
import { GraphTable } from '@/components/graph/graph-table'
import { ClusterList } from '@/components/atlas/cluster-list'
import { CitationMarker } from '@/components/evidence/citation'
import { ExternalIds, TypeLabel } from '@/components/atlas/node-bits'
import { nodeHref } from '@/components/search/global-search'
import { useGraph } from '@/lib/queries'
import { edgeParam, nodeParam } from '@/lib/url-state'
import { edgeSentence } from '@/lib/copy'
import { cn } from '@/lib/cn'
import { useAccount } from '@/components/account/account-provider'

const FILTERS: { id: string; label: string; types: NodeType[]; on: boolean }[] = [
  { id: 'disease', label: 'Conditions', types: ['disease'], on: true },
  { id: 'mechanism', label: 'Mechanisms', types: ['mechanism'], on: true },
  { id: 'gene', label: 'Genes and variants', types: ['gene', 'variant'], on: true },
  { id: 'community', label: 'Groups and resources', types: ['patientGroup', 'asset', 'study'], on: true },
  { id: 'people', label: 'People and awards', types: ['investigator', 'funding'], on: false },
  { id: 'phenotype', label: 'Symptoms', types: ['phenotype'], on: false },
]
const LITE_TYPES: NodeType[] = ['disease', 'mechanism', 'patientGroup']

export default function ExplorePage() {
  return (
    <Gate panel="graph" what="The map">
      <Explore />
    </Gate>
  )
}

function Explore() {
  const graph = useGraph()
  const { profile } = useAccount()
  const { isLite, can } = useRole()
  const [node, setNode] = useQueryState('node', nodeParam)
  const [edge, setEdge] = useQueryState('edge', edgeParam)
  const [on, setOn] = useState(() => new Set(FILTERS.filter((f) => f.on).map((f) => f.id)))
  const [inferred, setInferred] = useState(true)
  const [viewOverride, setViewOverride] = useState<boolean | null>(null)
  const asTable = viewOverride ?? profile.graphView === 'table'
  const lite = isLite('graph')

  const view = useMemo<GraphData | null>(() => {
    const g = graph.data
    if (!g) return null
    const types = new Set<NodeType>(lite ? LITE_TYPES : FILTERS.filter((f) => on.has(f.id)).flatMap((f) => f.types))
    const nodes = g.nodes.filter((n) => types.has(n.type))
    const ids = new Set(nodes.map((n) => n.id))
    const edges = g.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && (inferred || e.basis !== 'inferred'))
    return { nodes, edges, clusters: g.clusters }
  }, [graph.data, on, inferred, lite])

  const selected = node ? graph.data?.nodes.find((n) => n.id === node) : undefined

  return (
    <Page>
      <PageHeader title="Map" kicker="Organized by mechanism">
        Conditions sit near the mechanisms they are cited for. Dashed amber lines are inferred; long-dashed lines bridge
        two clusters. Select a node for details or a line for its evidence.
      </PageHeader>

      {!lite && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2" role="group" aria-label="Map filters">
          {FILTERS.map((f) => (
            <label key={f.id} className="inline-flex items-center gap-1.5 text-label text-ink-2">
              <input
                type="checkbox"
                checked={on.has(f.id)}
                onChange={() =>
                  setOn((prev) => {
                    const next = new Set(prev)
                    if (next.has(f.id)) next.delete(f.id)
                    else next.add(f.id)
                    return next
                  })
                }
                className="accent-[var(--accent)]"
              />
              {f.label}
            </label>
          ))}
          <label className="inline-flex items-center gap-1.5 text-label text-ink-2">
            <input
              type="checkbox"
              checked={inferred}
              onChange={() => setInferred((v) => !v)}
              className="accent-[var(--accent)]"
            />
            Inferred links
          </label>
          <button
            type="button"
            className="link ml-auto text-label"
            onClick={() => setViewOverride(!asTable)}
            aria-pressed={asTable}
          >
            {asTable ? 'Show as map' : 'Show as table'}
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {!view ? (
            <GraphFrame height={560}>
              <Pending label="Loading map" />
            </GraphFrame>
          ) : asTable ? (
            <GraphTable
              nodes={view.nodes}
              edges={view.edges}
              caption={`${view.edges.length} links between ${view.nodes.length} records`}
            />
          ) : (
            <GraphFrame height={560}>
              <LazyGraph
                nodes={view.nodes}
                edges={view.edges}
                clusters={view.clusters}
                selectedNode={node}
                selectedEdge={edge}
                onSelectNode={(id) => void setNode(id)}
                onSelectEdge={(id) => void setEdge(id)}
                height={560}
                label={`Map of ${view.nodes.length} records and ${view.edges.length} links. Use "Show as table" or the cluster list for keyboard access.`}
              />
            </GraphFrame>
          )}
          {view && <GraphLegend clusters={view.clusters} />}
        </div>

        <aside className="min-w-0" aria-label={selected ? 'Selected record' : 'Mechanism clusters'}>
          {selected && graph.data ? (
            <Selected node={selected} graph={graph.data} onClear={() => void setNode(null)} />
          ) : (
            graph.data &&
            can('clusters') && (
              <div>
                <h2 className="meta-label mb-3">Mechanism clusters</h2>
                <ClusterList graph={graph.data} selected={node} onSelect={(id) => void setNode(id)} />
              </div>
            )
          )}
        </aside>
      </div>
    </Page>
  )
}

function Selected({ node, graph, onClear }: { node: AtlasNode; graph: GraphData; onClear: () => void }) {
  const edges = graph.edges.filter((e) => e.from === node.id || e.to === node.id)
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const clusters = graph.clusters.filter((c) => node.clusters.includes(c.id))
  return (
    <div className="space-y-4" data-testid="selected-node">
      <div className="flex items-start justify-between gap-3">
        <TypeLabel node={node} />
        <button type="button" onClick={onClear} className="text-label text-ink-3 hover:text-ink">
          Clear
        </button>
      </div>
      <h2 className="text-h3 text-ink">{node.name}</h2>
      {clusters.length > 0 && <p className="text-label text-ink-3">{clusters.map((c) => c.label).join('; ')}</p>}
      <ExternalIds node={node} limit={3} />
      <AppLink
        href={nodeHref(node)}
        className={cn('inline-flex items-center gap-1 text-ui font-medium text-accent-ink hover:underline')}
      >
        Open {node.type === 'disease' ? 'condition' : 'record'} <ArrowRight className="size-3.5" aria-hidden />
      </AppLink>
      <div>
        <p className="meta-label mb-2">Links ({edges.length})</p>
        <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {edges.slice(0, 40).map((e) => {
            const a = byId.get(e.from)
            const b = byId.get(e.to)
            return (
              <li key={e.id} className="text-label text-ink-2">
                {a && b ? edgeSentence(e, a, b, false) : e.id} <CitationMarker edge={e} />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
