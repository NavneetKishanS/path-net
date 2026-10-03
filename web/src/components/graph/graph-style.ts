import type { AtlasNode, Cluster, Edge, NodeType } from '@/lib/model'

/** Shape carries node type so colour is never the only signal. Mirrored in the legend. */
export const NODE_SHAPE: Record<NodeType, string> = {
  disease: 'ellipse',
  gene: 'round-rectangle',
  variant: 'round-rectangle',
  mechanism: 'diamond',
  phenotype: 'ellipse',
  patientGroup: 'hexagon',
  paper: 'rectangle',
  asset: 'rectangle',
  funding: 'rectangle',
  study: 'rectangle',
  investigator: 'triangle',
}

export const LABELLED: NodeType[] = ['disease', 'mechanism', 'patientGroup']

export type EdgeLook = 'observed' | 'inferred' | 'bridge' | 'contradicts'

export function edgeLook(e: Edge): EdgeLook {
  if (e.stance === 'contradicts') return 'contradicts'
  if (e.basis === 'inferred') return 'inferred'
  if (e.bridge) return 'bridge'
  return 'observed'
}

/** Resolve a CSS colour (including oklch and var()) to rgb() by painting one pixel. */
export function resolveColor(cssVar: string): string {
  if (typeof document === 'undefined') return '#888'
  const probe = document.createElement('span')
  probe.style.color = `var(${cssVar})`
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return computed
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${g}, ${b})`
}

export function readPalette() {
  const v = (n: string) => resolveColor(n)
  return {
    paper: v('--paper'),
    ink: v('--ink'),
    ink2: v('--ink-2'),
    ink3: v('--ink-3'),
    line: v('--line-strong'),
    accent: v('--accent'),
    inferred: v('--inferred'),
    contra: v('--contra'),
    neutral: v('--neutral-node'),
    clusters: [v('--c0'), v('--c1'), v('--c2'), v('--c3')],
    font: typeof document === 'undefined' ? 'sans-serif' : getComputedStyle(document.body).fontFamily,
  }
}
export type Palette = ReturnType<typeof readPalette>

export function nodeColor(n: AtlasNode, clusters: Cluster[], p: Palette): string {
  const c = clusters.find((x) => n.clusters.includes(x.id))
  if (c && (n.type === 'disease' || n.type === 'mechanism')) return p.clusters[c.hue] ?? p.neutral
  return p.neutral
}
