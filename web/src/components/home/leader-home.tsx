'use client'

import { useQueryState } from 'nuqs'
import { useRole } from '@/components/role/role-provider'
import { GlobalSearch } from '@/components/search/global-search'
import { DiseaseOverview } from '@/components/atlas/disease-overview'
import { Page, Pending } from '@/components/layout/page'
import { useDiseases } from '@/lib/queries'
import { focusParam } from '@/lib/url-state'
import { Ident } from '@/components/atlas/node-bits'

/** Patient Group Leader: pick your condition once; the home becomes its overview and plan. */
export function LeaderHome() {
  const [focus, setFocus] = useQueryState('focus', focusParam.withOptions({ history: 'push' }))
  if (focus) {
    return (
      <Page>
        <div className="mb-6 flex flex-wrap items-baseline gap-x-3 text-label text-ink-3">
          <span>Your condition</span>
          <button type="button" className="link" onClick={() => void setFocus(null)}>
            Change
          </button>
        </div>
        <DiseaseOverview id={focus} />
      </Page>
    )
  }
  return <ConditionPicker onPick={(id) => void setFocus(id)} />
}

function ConditionPicker({ onPick }: { onPick: (id: string) => void }) {
  const diseases = useDiseases()
  const { config } = useRole()
  return (
    <Page narrow className="md:py-16">
      <div className="title-band -mt-8 pt-8 pb-10 md:-mt-16 md:pt-16 md:pb-12">
        <p className="meta-label mb-2">{config.label}</p>
        <h1 className="text-h2 text-ink md:text-h1">Which condition does your group serve?</h1>
        <p className="mt-3 max-w-[60ch] text-body text-ink-2">
          Start from your condition. The atlas shows which other communities share its mechanism, the evidence for each
          link, and what you could do this week.
        </p>
        <div className="mt-8">
          <GlobalSearch
            size="hero"
            types={['disease']}
            placeholder="Condition name, synonym or gene"
            onPick={(n) => onPick(n.id)}
            autoFocus
          />
        </div>
      </div>
      <section className="mt-10" aria-labelledby="in-atlas">
        <h2 id="in-atlas" className="meta-label mb-3">
          Conditions in this atlas
        </h2>
        {diseases.isLoading ? (
          <Pending lines={6} />
        ) : (
          <ul className="divide-y divide-line border-y border-line" data-testid="condition-list">
            {(diseases.data ?? []).map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onPick(d.id)}
                  className="flex w-full items-baseline justify-between gap-4 px-1 py-3 text-left hover:bg-surface"
                >
                  <span className="text-ui text-ink">{d.name}</span>
                  {typeof d.props.gene_symbol === 'string' && (
                    <Ident className="text-label text-ink-3">{d.props.gene_symbol}</Ident>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  )
}
