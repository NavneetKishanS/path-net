'use client'

import { useEffect, useRef } from 'react'
import cytoscape, { type Core, type ElementDefinition, type StylesheetJson } from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { useTheme } from 'next-themes'
import type { AtlasNode, Cluster, Edge } from '@/lib/model'
import { LABELLED, NODE_SHAPE, edgeLook, nodeColor, readPalette, type Palette } from './graph-style'

cytoscape.use(fcose)

export interface GraphCanvasProps {
  nodes: AtlasNode[]
  edges: Edge[]
  clusters: Cluster[]
  selectedNode?: string | null
  selectedEdge?: string | null
  onSelectNode?: (id: string | null) => void
  onSelectEdge?: (id: string) => void
  height: number
  /** Fewer labels and a tighter layout for small embeds. */
  compact?: boolean
  label: string
}

function elements(nodes: AtlasNode[], edges: Edge[], clusters: Cluster[], p: Palette): ElementDefinition[] {
  const ids = new Set(nodes.map((n) => n.id))
  return [
    ...nodes.map((n) => ({
      group: 'nodes' as const,
      data: {
        id: n.id,
        label: n.name.length > 42 ? `${n.name.slice(0, 40)}…` : n.name,
        size: n.type === 'phenotype' ? 10 : 16 + Math.round(n.centrality * 30),
        shape: NODE_SHAPE[n.type],
        color: nodeColor(n, clusters, p),
        labelled: LABELLED.includes(n.type) ? 1 : 0,
      },
    })),
    ...edges
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => ({ group: 'edges' as const, data: { id: e.id, source: e.from, target: e.to, look: edgeLook(e) } })),
  ]
}

function stylesheet(p: Palette, compact: boolean): StylesheetJson {
  return [
    {
      selector: 'node',
      style: {
        width: 'data(size)',
        height: 'data(size)',
        shape: 'data(shape)' as never,
        'background-color': 'data(color)',
        'border-width': 1.5,
        'border-color': p.paper,
        label: '',
        'font-family': p.font,
        'font-size': compact ? 10 : 11,
        color: p.ink2,
        'text-valign': 'bottom',
        'text-margin-y': 4,
        'text-wrap': 'wrap',
        'text-max-width': '120px',
        'text-background-color': p.paper,
        'text-background-opacity': 0.85,
        'text-background-padding': '1px',
        'overlay-opacity': 0,
      },
    },
    { selector: 'node[labelled = 1]', style: { label: 'data(label)' } },
    { selector: 'node:active, node.hover', style: { label: 'data(label)', 'z-index': 20 } },
    {
      selector: 'node.selected',
      style: {
        label: 'data(label)',
        'border-width': 3,
        'border-color': p.accent,
        color: p.ink,
        'font-weight': 600,
        'z-index': 30,
      },
    },
    { selector: 'node.faded', style: { opacity: 0.22 } },
    {
      selector: 'edge',
      style: {
        width: 1.4,
        'line-color': p.line,
        'curve-style': 'bezier',
        'target-arrow-shape': 'none',
        'overlay-opacity': 0,
      },
    },
    {
      selector: 'edge[look = "inferred"]',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [5, 4], 'line-color': p.inferred, width: 2.2 },
    },
    {
      selector: 'edge[look = "bridge"]',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [9, 4], 'line-color': p.ink3, width: 1.6 },
    },
    {
      selector: 'edge[look = "contradicts"]',
      style: { 'line-color': p.contra, 'target-arrow-shape': 'tee', 'target-arrow-color': p.contra, width: 1.8 },
    },
    { selector: 'edge.hover', style: { width: 3.2, 'z-index': 20 } },
    {
      selector: 'edge.selected',
      style: { width: 3.5, 'line-color': p.accent, 'target-arrow-color': p.accent, 'z-index': 30 },
    },
    { selector: 'edge.faded', style: { opacity: 0.12 } },
  ]
}

function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function GraphCanvas(props: GraphCanvasProps) {
  const {
    nodes,
    edges,
    clusters,
    selectedNode,
    selectedEdge,
    onSelectNode,
    onSelectEdge,
    height,
    compact = false,
    label,
  } = props
  const box = useRef<HTMLDivElement>(null)
  const cy = useRef<Core | null>(null)
  const handlers = useRef({ onSelectNode, onSelectEdge })
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    handlers.current = { onSelectNode, onSelectEdge }
  }, [onSelectNode, onSelectEdge])

  // Build once per element set; styling and selection update in place.
  useEffect(() => {
    if (!box.current) return
    const p = readPalette()
    const instance = cytoscape({
      container: box.current,
      elements: elements(nodes, edges, clusters, p),
      style: stylesheet(p, compact),
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.25,
      boxSelectionEnabled: false,
      autoungrabify: false,
    })
    // fcose has no seed option; a seeded Math.random during the synchronous run keeps the map stable between visits.
    const random = Math.random
    Math.random = seeded(7)
    try {
      instance
        .layout({
          name: 'fcose',
          quality: 'proof',
          randomize: true,
          animate: false,
          nodeRepulsion: () => (compact ? 6000 : 9000),
          idealEdgeLength: () => (compact ? 70 : 95),
          padding: compact ? 16 : 28,
        } as cytoscape.LayoutOptions)
        .run()
    } finally {
      Math.random = random
    }
    instance.on('tap', 'node', (e) => handlers.current.onSelectNode?.(e.target.id()))
    instance.on('tap', 'edge', (e) => handlers.current.onSelectEdge?.(e.target.id()))
    instance.on('tap', (e) => {
      if (e.target === instance) handlers.current.onSelectNode?.(null)
    })
    instance.on('mouseover', 'node, edge', (e) => {
      e.target.addClass('hover')
      if (box.current) box.current.style.cursor = 'pointer'
    })
    instance.on('mouseout', 'node, edge', (e) => {
      e.target.removeClass('hover')
      if (box.current) box.current.style.cursor = ''
    })
    cy.current = instance
    return () => {
      instance.destroy()
      cy.current = null
    }
  }, [nodes, edges, clusters, compact])

  useEffect(() => {
    const c = cy.current
    if (!c) return
    const p = readPalette()
    c.style(stylesheet(p, compact))
    c.nodes().forEach((n) => {
      const src = nodes.find((x) => x.id === n.id())
      if (src) n.data('color', nodeColor(src, clusters, p))
    })
  }, [resolvedTheme, nodes, clusters, compact])

  useEffect(() => {
    const c = cy.current
    if (!c) return
    c.elements().removeClass('selected faded')
    if (selectedNode) {
      const n = c.getElementById(selectedNode)
      if (n.nonempty()) {
        const hood = n.closedNeighborhood()
        c.elements().not(hood).addClass('faded')
        n.addClass('selected')
      }
    }
    if (selectedEdge) c.getElementById(selectedEdge).addClass('selected')
  }, [selectedNode, selectedEdge, nodes, edges])

  return <div ref={box} role="img" aria-label={label} className="w-full" style={{ height }} />
}
