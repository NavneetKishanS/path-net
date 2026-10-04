'use client'

import { useMemo, useState } from 'react'
import type { Coverage } from '@/lib/model'
import { cn } from '@/lib/cn'
import { DonutChart, type DonutSlice } from '@/components/charts/donut-chart'

type View = 'kept' | 'found' | 'gene'

const VIEWS: { id: View; label: string }[] = [
  { id: 'kept', label: 'Kept, by source' },
  { id: 'found', label: 'Found, by source' },
  { id: 'gene', label: 'Kept, by gene' },
]

const SOURCE_NAME: Record<string, string> = {
  pubmed: 'PubMed',
  clinicaltrials: 'ClinicalTrials.gov',
  reporter: 'NIH RePORTER',
}

function slices(coverage: Coverage, view: View): DonutSlice[] {
  const m = new Map<string, DonutSlice>()
  const add = (key: string, label: string, value: number) => {
    const s = m.get(key)
    if (s) s.value += value
    else m.set(key, { key, label, value })
  }
  for (const q of coverage.queries) {
    if (view === 'gene') {
      const gene = coverage.genes.find((g) => q.query.toUpperCase().includes(g.toUpperCase()))
      add(gene ?? 'other', gene ?? 'Other', q.retrieved)
    } else {
      add(q.source, SOURCE_NAME[q.source] ?? q.source, view === 'kept' ? q.retrieved : q.total)
    }
  }
  return [...m.values()].filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
}

/** Where the atlas data comes from: the same numbers as the query table, as shares. */
export function SourceChart({ coverage }: { coverage: Coverage }) {
  const [view, setView] = useState<View>('kept')
  const data = useMemo(() => slices(coverage, view), [coverage, view])
  const sampled = coverage.queries.some((q) => q.truncated)

  return (
    <div className="mt-6" data-testid="source-chart">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-h3 text-ink">Where the data comes from</h3>
          <p className="mt-0.5 text-label text-ink-2">
            Each slice adds up the rows of the table above. Found is what the source returned; kept is what the atlas
            holds.
          </p>
        </div>
        <div role="group" aria-label="Group the chart" className="inline-flex rounded-sm border border-line-strong">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                'px-3 py-1.5 text-label font-medium first:rounded-l-sm last:rounded-r-sm',
                view === v.id ? 'bg-accent text-paper' : 'text-ink hover:bg-surface',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <DonutChart
        key={view}
        slices={data}
        format={(v) => `${v.toLocaleString('en-US')} records`}
        caption={view === 'found' ? 'found at the sources' : 'kept in the atlas'}
        ariaLabel="Donut chart of records by source"
      />
      {sampled && (
        <p className="mt-3 text-label text-ink-3">
          Some sources were sampled, so kept is smaller than found. A big slice in found does not mean a big slice in
          the atlas.
        </p>
      )}
    </div>
  )
}
