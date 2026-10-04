'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

export interface DonutSlice {
  key: string
  label: string
  value: number
}

const COLORS = [
  'var(--c0)',
  'var(--c1)',
  'var(--c2)',
  'var(--c3)',
  'var(--accent)',
  'var(--inferred)',
  'var(--supports)',
  'var(--neutral-node)',
]

/** Keep the biggest slices and fold the tail into one "Other" slice. */
export function topSlices(slices: DonutSlice[], max = COLORS.length): DonutSlice[] {
  const sorted = [...slices].sort((a, b) => b.value - a.value)
  if (sorted.length <= max) return sorted
  const rest = sorted.slice(max - 1)
  return [
    ...sorted.slice(0, max - 1),
    { key: 'other', label: `Other (${rest.length})`, value: rest.reduce((n, s) => n + s.value, 0) },
  ]
}

const CX = 120
const CY = 120
const R_OUT = 108
const R_IN = 64

const pt = (r: number, a: number) => `${CX + r * Math.cos(a)} ${CY + r * Math.sin(a)}`

function arc(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${pt(R_OUT, a0)} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${pt(R_OUT, a1)} L ${pt(R_IN, a1)} A ${R_IN} ${R_IN} 0 ${large} 0 ${pt(R_IN, a0)} Z`
}

const pct = (v: number, total: number) => {
  const p = (v / total) * 100
  return p < 1 ? '<1%' : `${Math.round(p)}%`
}

/**
 * Interactive donut with a legend. Hover, focus or click a slice or a legend row to read it.
 * Colour is never the only signal: every slice is also named in the legend with its value and share.
 */
export function DonutChart({
  slices,
  format,
  caption,
  ariaLabel,
}: {
  slices: DonutSlice[]
  /** How a value is written, for example "$465,915" or "160 records". */
  format: (v: number) => string
  /** Small line under the total in the centre. */
  caption?: string
  ariaLabel: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const total = slices.reduce((n, s) => n + s.value, 0)
  if (total <= 0) return null

  const shapes = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((n, x) => n + x.value, 0)
    const a0 = -Math.PI / 2 + (before / total) * Math.PI * 2
    const sweep = (s.value / total) * Math.PI * 2
    return { s, a0, a1: a0 + sweep, mid: a0 + sweep / 2, color: COLORS[i % COLORS.length]! }
  })
  const current = shapes.find((x) => x.s.key === active)
  const hover = (key: string | null) => ({
    onMouseEnter: () => setActive(key),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(key),
    onBlur: () => setActive(null),
  })

  return (
    <div className="grid items-center gap-8 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-square w-full max-w-[260px]">
        <svg viewBox="0 0 240 240" className="size-full overflow-visible" role="group" aria-label={ariaLabel}>
          {shapes.length === 1 ? (
            <circle
              cx={CX}
              cy={CY}
              r={(R_OUT + R_IN) / 2}
              fill="none"
              stroke={shapes[0]!.color}
              strokeWidth={R_OUT - R_IN}
            />
          ) : (
            shapes.map((x) => {
              const on = x.s.key === active
              const dim = active !== null && !on
              const dx = on ? Math.cos(x.mid) * 7 : 0
              const dy = on ? Math.sin(x.mid) * 7 : 0
              return (
                <path
                  key={x.s.key}
                  d={arc(x.a0, x.a1)}
                  fill={x.color}
                  stroke="var(--paper)"
                  strokeWidth={2}
                  tabIndex={0}
                  role="button"
                  aria-pressed={on}
                  aria-label={`${x.s.label}: ${format(x.s.value)}, ${pct(x.s.value, total)}`}
                  className="cursor-pointer outline-none transition-[transform,opacity] duration-150 focus-visible:[stroke:var(--ink)]"
                  style={{ transform: `translate(${dx}px, ${dy}px)`, opacity: dim ? 0.4 : 1 }}
                  {...hover(x.s.key)}
                  onClick={() => setActive(on ? null : x.s.key)}
                />
              )
            })
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[26%] text-center">
          {current ? (
            <>
              <span className="line-clamp-3 text-meta leading-tight text-ink-2">{current.s.label}</span>
              <span className="mt-1 text-h3 leading-none font-semibold text-ink tabular-nums">
                {format(current.s.value)}
              </span>
              <span className="mt-1 text-label text-ink-2">{pct(current.s.value, total)}</span>
            </>
          ) : (
            <>
              <span className="text-meta text-ink-2">Total</span>
              <span className="mt-1 text-h3 leading-none font-semibold text-ink tabular-nums">{format(total)}</span>
              {caption && <span className="mt-1 text-label text-ink-2">{caption}</span>}
            </>
          )}
        </div>
      </div>

      <ul className="min-w-0 divide-y divide-line border-y border-line">
        {shapes.map((x) => {
          const on = x.s.key === active
          return (
            <li key={x.s.key}>
              <button
                type="button"
                aria-pressed={on}
                {...hover(x.s.key)}
                onClick={() => setActive(on ? null : x.s.key)}
                className={cn(
                  'flex w-full items-center gap-3 px-2 py-2 text-left text-label hover:bg-surface',
                  on && 'bg-accent-weak',
                )}
              >
                <span aria-hidden className="size-3 shrink-0 rounded-xs" style={{ background: x.color }} />
                <span className={cn('min-w-0 flex-1 truncate text-ink', on && 'font-semibold')} title={x.s.label}>
                  {x.s.label}
                </span>
                <span className="shrink-0 text-ink-2 tabular-nums">{format(x.s.value)}</span>
                <span className="w-10 shrink-0 text-right font-medium text-ink tabular-nums">
                  {pct(x.s.value, total)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
