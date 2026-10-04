'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import type { AtlasNode, Route, RouteStep } from '@/lib/model'
import { AppLink } from '@/components/role/app-link'
import { nodeHref } from '@/components/search/global-search'
import { BasisBadge } from '@/components/evidence/badges'
import { NODE_TYPE_LABEL, RELATION_LABEL } from '@/lib/copy'
import { plainNodeLabel } from '@/lib/plain-language'
import { cn } from '@/lib/cn'

interface Hop {
  step: RouteStep
  /** True when the edge points from the right-hand node back to the left-hand one. */
  reversed: boolean
}

/** Walk the route's own steps from the first condition to the last. Null when they do not form one path. */
function findPath(route: Route): { nodes: AtlasNode[]; hops: Hop[] } | null {
  const nodes = new Map<string, AtlasNode>([
    [route.from.id, route.from],
    [route.to.id, route.to],
  ])
  const adj = new Map<string, { next: string; step: RouteStep }[]>()
  const link = (a: AtlasNode, b: AtlasNode, step: RouteStep) => {
    nodes.set(a.id, a)
    nodes.set(b.id, b)
    adj.set(a.id, [...(adj.get(a.id) ?? []), { next: b.id, step }])
  }
  for (const s of route.steps) {
    link(s.subject, s.object, s)
    link(s.object, s.subject, s)
  }
  const prev = new Map<string, { id: string; step: RouteStep }>()
  const seen = new Set([route.from.id])
  const queue = [route.from.id]
  while (queue.length) {
    const id = queue.shift()!
    if (id === route.to.id) break
    for (const { next, step } of adj.get(id) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      prev.set(next, { id, step })
      queue.push(next)
    }
  }
  if (!prev.has(route.to.id)) return null
  const hops: Hop[] = []
  const ids = [route.to.id]
  for (let id = route.to.id; id !== route.from.id;) {
    const p = prev.get(id)!
    hops.unshift({ step: p.step, reversed: p.step.subject.id === id })
    ids.unshift(p.id)
    id = p.id
  }
  return { nodes: ids.map((id) => nodes.get(id)!), hops }
}

/**
 * The route drawn as a path: conditions and the thing they share, joined by the cited steps.
 * Solid line = observed, dashed = inferred. Selecting a step here selects it in the list below.
 */
export function RouteDiagram({
  route,
  selected,
  onSelect,
  plain,
}: {
  route: Route
  selected: string
  onSelect: (edgeId: string) => void
  plain: boolean
}) {
  const path = useMemo(() => findPath(route), [route])
  if (!path || path.hops.length === 0) return null
  const { nodes, hops } = path

  return (
    <figure aria-label="Path from one condition to the other" data-testid="route-diagram" className="min-w-0">
      <div aria-hidden className="mx-[6%] hidden items-center gap-2 md:flex">
        <span className="h-3 flex-1 rounded-tl-md border-t border-l border-dashed border-inferred" />
        <span className="text-meta font-medium text-inferred-ink">Inferred link</span>
        <span className="h-3 flex-1 rounded-tr-md border-t border-r border-dashed border-inferred" />
      </div>
      <ol className="flex flex-col items-stretch md:flex-row md:items-center">
        {nodes.map((n, i) => {
          const hop = hops[i]
          const end = i === 0 || i === nodes.length - 1
          return (
            <li key={n.id} className="contents">
              <div
                className={cn(
                  'min-w-0 rounded-sm border bg-paper px-3 py-2 md:flex-1',
                  end ? 'border-2 border-accent' : 'border-line-strong bg-surface',
                )}
                data-testid="route-node"
              >
                <div className="text-meta text-ink-3">{NODE_TYPE_LABEL[n.type]}</div>
                <AppLink
                  href={nodeHref(n)}
                  className="block text-label leading-snug font-semibold text-ink hover:underline"
                >
                  {plain && n.type !== 'disease' ? plainNodeLabel(n) : n.name}
                </AppLink>
              </div>
              {hop && (
                <Connector
                  hop={hop}
                  index={route.steps.indexOf(hop.step) + 1}
                  selected={selected}
                  onSelect={onSelect}
                />
              )}
            </li>
          )
        })}
      </ol>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-ink-2">
        <BasisBadge basis="observed" />
        <BasisBadge basis="inferred" />
        <span>Select a step to read its source.</span>
      </figcaption>
    </figure>
  )
}

function Connector({
  hop,
  index,
  selected,
  onSelect,
}: {
  hop: Hop
  index: number
  selected: string
  onSelect: (edgeId: string) => void
}) {
  const { step, reversed } = hop
  const inferred = step.edge.basis === 'inferred'
  const contradicts = step.edge.stance === 'contradicts'
  const active = step.edge.id === selected
  const tone = contradicts ? 'text-contra' : inferred ? 'text-inferred' : 'text-ink-2'
  const arrow = 'absolute size-4'
  return (
    <button
      type="button"
      onClick={() => onSelect(step.edge.id)}
      aria-pressed={active}
      aria-label={`Step ${index}: ${RELATION_LABEL[step.edge.relation]}${inferred ? ', inferred' : ''}${contradicts ? ', contradicts' : ''}`}
      data-testid={`route-hop-${index}`}
      className={cn(
        'group flex flex-col items-center justify-center gap-1 rounded-sm px-2 py-2 hover:bg-surface md:min-w-0 md:flex-[1.1]',
        active && 'bg-accent-weak',
      )}
    >
      <span className={cn('text-meta text-center', active ? 'font-semibold text-ink' : 'text-ink-2')}>
        <span className="font-mono text-ink-3">{index}</span> {RELATION_LABEL[step.edge.relation]}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative block h-8 w-0 border-l-2 md:h-0 md:w-full md:border-t-2 md:border-l-0',
          inferred || contradicts ? 'border-dashed' : 'border-solid',
          contradicts ? 'border-contra' : inferred ? 'border-inferred' : 'border-ink-2',
          tone,
        )}
      >
        {reversed ? (
          <>
            <ChevronUp className={cn(arrow, '-top-1.5 left-1/2 -translate-x-1/2 md:hidden')} />
            <ChevronLeft className={cn(arrow, 'top-1/2 -left-2 hidden -translate-y-1/2 md:block')} />
          </>
        ) : (
          <>
            <ChevronDown className={cn(arrow, '-bottom-1.5 left-1/2 -translate-x-1/2 md:hidden')} />
            <ChevronRight className={cn(arrow, 'top-1/2 -right-2 hidden -translate-y-1/2 md:block')} />
          </>
        )}
      </span>
    </button>
  )
}
