import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { Graph } from './types'

const CLUSTER_COLORS = ['#0B7A75', '#B4410C', '#4A5FC1', '#8A6D00']
const NEUTRAL = '#8896A0'
const BRIDGE = '#7B3FA0'

interface Props {
  graph: Graph
  focusIds: Set<string> | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  onNode: (id: string) => void
  onEdge: (id: string) => void
}

export function clusterColor(graph: Graph, nodeId: string): string {
  const mine = graph.node_cluster.filter((nc) => nc.node_id === nodeId).map((nc) => nc.cluster_id)
  if (mine.length === 0) return NEUTRAL
  if (mine.length > 1) return BRIDGE
  const idx = graph.clusters.findIndex((c) => c.id === mine[0])
  return CLUSTER_COLORS[idx % CLUSTER_COLORS.length]
}

export default function GraphView({ graph, focusIds, selectedNodeId, selectedEdgeId, onNode, onEdge }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const fg = useRef<any>(null)
  const [size, setSize] = useState({ w: 600, h: 500 })

  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  // Copy once: the force engine mutates these objects (adds x, y).
  const data = useMemo(
    () => ({
      nodes: graph.nodes.map((n) => ({ ...n })),
      links: graph.edges.map((e) => ({ ...e, source: e.src, target: e.dst })),
    }),
    [graph],
  )

  const dim = (id: string) => focusIds !== null && !focusIds.has(id)

  return (
    <div className="graph" ref={box}>
      <ForceGraph2D
        ref={fg}
        width={size.w}
        height={size.h}
        graphData={data}
        cooldownTicks={80}
        onEngineStop={() => fg.current?.zoomToFit(400, 60)}
        nodeRelSize={6}
        nodeLabel={(n: any) => `${n.name} (${n.type})`}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          const r = node.type === 'disease' ? 7 : 5
          ctx.globalAlpha = dim(node.id) ? 0.2 : 1
          ctx.beginPath()
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
          ctx.fillStyle = clusterColor(graph, node.id)
          ctx.fill()
          if (node.id === selectedNodeId) {
            ctx.lineWidth = 2 / scale
            ctx.strokeStyle = '#12212B'
            ctx.stroke()
          }
          ctx.font = `${11 / scale}px sans-serif`
          ctx.textAlign = 'center'
          ctx.fillStyle = '#12212B'
          ctx.fillText(node.name, node.x, node.y + r + 10 / scale)
          ctx.globalAlpha = 1
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(node.x, node.y, 9, 0, 2 * Math.PI)
          ctx.fill()
        }}
        linkColor={(l: any) => (l.stance === 'contradicts' ? '#C0392B' : l.id === selectedEdgeId ? '#12212B' : '#9AA7AF')}
        linkWidth={(l: any) => (l.id === selectedEdgeId ? 3 : 1.4)}
        linkLineDash={(l: any) => (l.tier === 'C' ? [4, 3] : null)}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkHoverPrecision={6}
        onNodeClick={(n: any) => onNode(n.id)}
        onLinkClick={(l: any) => onEdge(l.id)}
      />
      <ul className="legend" aria-label="Legend">
        {graph.clusters.map((c, i) => (
          <li key={c.id}><i style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }} />{c.label}</li>
        ))}
        <li><i style={{ background: BRIDGE }} />Bridge (in more than one cluster)</li>
        <li><span className="dash" />Dashed edge: inferred (tier C)</li>
        <li><span className="dash red" />Red edge: contradicting evidence</li>
      </ul>
    </div>
  )
}
