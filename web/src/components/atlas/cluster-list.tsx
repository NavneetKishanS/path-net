'use client'

import type { GraphData } from '@/lib/model'
import { EFFECT_LABEL } from '@/lib/copy'
import { cn } from '@/lib/cn'
import { ClusterSwatch } from './node-bits'

/** Mechanism clusters and their member conditions. Selecting a condition focuses it on the map. */
export function ClusterList({
  graph,
  selected,
  onSelect,
}: {
  graph: GraphData
  selected?: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ul className="space-y-5" data-testid="cluster-list">
      {graph.clusters.map((c) => {
        const members = graph.nodes.filter((n) => n.type === 'disease' && n.clusters.includes(c.id))
        return (
          <li key={c.id}>
            <p className="flex items-center gap-2 text-ui font-medium text-ink">
              <ClusterSwatch cluster={c} />
              {c.label}
            </p>
            <p className="text-label text-ink-3">
              {EFFECT_LABEL[c.effect]} · {members.length} condition{members.length === 1 ? '' : 's'}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {members.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(d.id)}
                    aria-pressed={selected === d.id}
                    className={cn(
                      'w-full rounded-xs px-1.5 py-0.5 text-left text-label',
                      selected === d.id ? 'bg-accent-weak text-ink' : 'text-ink-2 hover:bg-surface',
                    )}
                  >
                    {d.name}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
