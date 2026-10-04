'use client'

import { useMemo, useState } from 'react'
import type { FundingRecord } from '@/lib/model'
import { formatMoney } from '@/lib/copy'
import { cn } from '@/lib/cn'
import { DonutChart, topSlices, type DonutSlice } from '@/components/charts/donut-chart'

type By = 'funder' | 'condition' | 'project'

const MODES: { id: By; label: string }[] = [
  { id: 'funder', label: 'By funder' },
  { id: 'condition', label: 'By condition' },
  { id: 'project', label: 'By project' },
]

/** Sum award amounts per group. Awards with no recorded amount are left out, never guessed. */
function group(records: FundingRecord[], by: By): DonutSlice[] {
  const m = new Map<string, DonutSlice>()
  const add = (key: string, label: string, value: number) => {
    const s = m.get(key)
    if (s) s.value += value
    else m.set(key, { key, label, value })
  }
  for (const r of records) {
    const cost = r.totalCost
    if (cost == null || cost <= 0) continue
    if (by === 'funder') {
      const label = `${r.funder}${r.institute ? ` ${r.institute}` : ''}`
      add(label, label, cost)
    } else if (by === 'condition') {
      // An award linked to several conditions is split evenly between them, so the total stays true.
      if (r.diseases.length === 0) add('none', 'No condition linked', cost)
      for (const d of r.diseases) add(d.id, d.name, cost / r.diseases.length)
    } else add(r.award.id, r.award.name, cost)
  }
  return topSlices([...m.values()])
}

/** Donut of award money, shown under the funding table. */
export function FundingChart({ records }: { records: FundingRecord[] }) {
  const [by, setBy] = useState<By>('funder')
  const slices = useMemo(() => group(records, by), [records, by])
  const total = slices.reduce((n, s) => n + s.value, 0)
  const missing = records.filter((r) => r.totalCost == null || r.totalCost <= 0).length
  if (total <= 0) return null
  const counted = records.length - missing

  return (
    <div className="mt-10 border-t border-line pt-6" data-testid="funding-chart">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-h3 text-ink">Where the award money goes</h3>
          <p className="mt-0.5 text-label text-ink-2">
            Share of the {formatMoney(Math.round(total))} in the awards above that have an amount recorded.
          </p>
        </div>
        <div role="group" aria-label="Group the chart" className="inline-flex rounded-sm border border-line-strong">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={by === m.id}
              onClick={() => setBy(m.id)}
              className={cn(
                'px-3 py-1.5 text-label font-medium first:rounded-l-sm last:rounded-r-sm',
                by === m.id ? 'bg-accent text-paper' : 'text-ink hover:bg-surface',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <DonutChart
        key={by}
        slices={slices}
        format={(v) => formatMoney(Math.round(v))}
        caption={`${counted} award${counted === 1 ? '' : 's'}`}
        ariaLabel="Donut chart of award money"
      />

      <p className="mt-3 text-label text-ink-3">
        {by === 'condition' && 'An award linked to more than one condition is split evenly between them. '}
        {missing > 0 &&
          `${missing} award${missing === 1 ? ' has' : 's have'} no amount recorded and ${missing === 1 ? 'is' : 'are'} left out. `}
        NIH RePORTER sample only; other funders are not covered.
      </p>
    </div>
  )
}
