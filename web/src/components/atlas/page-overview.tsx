import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface Stat {
  label: string
  /** A count taken from the data. Never an estimate. */
  value: number
  hint?: ReactNode
  /** Section id on the same page. Without it the tile is not a link. */
  href?: string
}

/** Counts that exist in the data, shown at a glance. Each tile jumps to the section it counts. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null
  return (
    <dl
      className={cn(
        'mt-6 grid grid-cols-2 gap-3',
        stats.length >= 4 ? 'md:grid-cols-4' : stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2',
      )}
      data-testid="stat-strip"
    >
      {stats.map((s) => {
        const body = (
          <>
            <dd className="text-h2 leading-none font-semibold text-ink tabular-nums">{s.value}</dd>
            <dt className="mt-1.5 text-label font-medium text-ink">{s.label}</dt>
            {s.hint && <p className="mt-0.5 text-meta text-ink-2">{s.hint}</p>}
          </>
        )
        const tile = 'rounded-sm border border-line bg-paper px-4 py-3'
        return s.href ? (
          <a key={s.label} href={`#${s.href}`} className={cn(tile, 'block hover:border-accent hover:bg-surface')}>
            {body}
          </a>
        ) : (
          <div key={s.label} className={tile}>
            {body}
          </div>
        )
      })}
    </dl>
  )
}

/** In-page jump links. Not sticky on purpose: it must not depend on the header height. */
export function PageNav({ items }: { items: { id: string; label: string }[] }) {
  if (items.length < 2) return null
  return (
    <nav aria-label="On this page" className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-label">
      <span className="meta-label">On this page</span>
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className="link">
          {i.label}
        </a>
      ))}
    </nav>
  )
}
