'use client'

import dynamic from 'next/dynamic'
import type { GraphCanvasProps } from './graph-canvas'

/** Cytoscape loads only when a map is on screen. The placeholder reserves the same height. */
export const LazyGraph = dynamic<GraphCanvasProps>(() => import('./graph-canvas'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-surface text-label text-ink-3" role="status">
      Loading map…
    </div>
  ),
})

export function GraphFrame({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-line bg-paper" style={{ minHeight: height }}>
      {children}
    </div>
  )
}
