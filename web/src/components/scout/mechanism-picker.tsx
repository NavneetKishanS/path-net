'use client'

import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import type { MechanismEffect } from '@/lib/model'
import { useMechanisms, useRankedClusters } from '@/lib/queries'
import { EFFECT_LABEL, effectOf } from '@/lib/copy'
import { Pending } from '@/components/layout/page'
import { cn } from '@/lib/cn'
import { RankedClusters } from './ranked-clusters'

const MODALITIES = {
  boost: {
    label: 'Replace or boost the gene',
    hint: 'Gene replacement, upregulation. Fits loss of function.',
    effects: ['loss_of_function'] as MechanismEffect[],
  },
  dampen: {
    label: 'Silence or dampen the gene',
    hint: 'Antisense, channel blockers. Fits gain of function and dominant negative.',
    effects: ['gain_of_function', 'dominant_negative'] as MechanismEffect[],
  },
} as const
type Modality = keyof typeof MODALITIES

const params = {
  modality: parseAsStringLiteral(['boost', 'dampen'] as const),
  mechanism: parseAsString,
}

/** Biotech Scout: pick a modality or a mechanism, see every cluster it could reach. */
export function MechanismPicker() {
  const [{ modality, mechanism }, set] = useQueryStates(params)
  const mechs = useMechanisms()
  const active: Modality | null = mechanism ? null : (modality ?? 'dampen')
  const ranked = useRankedClusters(
    mechanism ? { mechanismId: mechanism } : { effects: [...MODALITIES[active ?? 'dampen'].effects] },
  )

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="meta-label mb-2">Your modality</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(MODALITIES) as Modality[]).map((m) => {
            const on = active === m
            return (
              <label
                key={m}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-sm border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                  on ? 'border-accent bg-accent-weak' : 'border-line-strong hover:bg-surface',
                )}
              >
                <input
                  type="radio"
                  name="modality"
                  value={m}
                  checked={on}
                  onChange={() => void set({ modality: m, mechanism: null })}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-ui font-medium text-ink">{MODALITIES[m].label}</span>
                  <span className="block text-label text-ink-3">{MODALITIES[m].hint}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="mech-select" className="text-label text-ink-3">
          Or one mechanism
        </label>
        <select
          id="mech-select"
          value={mechanism ?? ''}
          onChange={(e) => void set({ mechanism: e.target.value || null, modality: null })}
          className="h-9 min-w-0 max-w-full rounded-sm border border-line-strong bg-paper px-2 text-ui text-ink"
        >
          <option value="">Any matching the modality</option>
          {(mechs.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({EFFECT_LABEL[effectOf(m)]})
            </option>
          ))}
        </select>
      </div>

      {ranked.isLoading ? <Pending label="Ranking clusters" /> : <RankedClusters items={ranked.data ?? []} />}
    </div>
  )
}
