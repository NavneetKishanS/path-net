'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Route, RouteStep } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { CitationMarker } from '@/components/evidence/citation'
import { EvidencePanel } from '@/components/evidence/evidence-panel'
import { BasisBadge, ContradictsBadge } from '@/components/evidence/badges'
import { edgeSentence } from '@/lib/copy'
import { plainEdgeSentence } from '@/lib/plain-language'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/use-media-query'

/**
 * "Why connected": each step is one cited edge. The selected step's evidence sits beside it
 * (below it on narrow screens). The inferred summary is labelled as inferred, never as fact.
 */
export function RouteExplainer({ route }: { route: Route }) {
  const { detail, isLite } = useRole()
  const plain = detail === 'plain'
  const lite = isLite('explain')
  const all = [...route.steps, ...route.communitySteps]
  const [selected, setSelected] = useState<string>(all[0]?.edge.id ?? '')
  const current = all.find((s) => s.edge.id === selected)
  const wide = useMediaQuery('(min-width: 1024px)')

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="min-w-0 space-y-8">
        {route.inferredEdge && (
          <div className="border-l-2 border-dashed border-inferred pl-4" data-testid="route-summary">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <BasisBadge basis="inferred" />
              <span className="text-label text-ink-3">
                {route.kind === 'mechanism' ? 'Hypothesis built from cited findings' : 'Network overlap'}
              </span>
            </div>
            <p className="prose-read text-ink">
              {plain
                ? plainEdgeSentence(route.inferredEdge, route.from, route.to)
                : edgeSentence(route.inferredEdge, route.from, route.to, false)}
            </p>
          </div>
        )}

        <StepList
          title={plain ? 'How the atlas got there' : 'Why: each step and its source'}
          steps={route.steps}
          selected={selected}
          onSelect={setSelected}
          plain={plain}
          offset={0}
          inline={!wide}
        />

        {route.communitySteps.length > 0 && !lite && (
          <StepList
            title={plain ? 'Who is already working on it' : 'Who is already working on it, and what they built'}
            steps={route.communitySteps}
            selected={selected}
            onSelect={setSelected}
            plain={plain}
            offset={route.steps.length}
            inline={!wide}
          />
        )}

        {route.qualifiers.length > 0 && (
          <section aria-labelledby="limits">
            <h2 id="limits" className="mb-2 flex items-center gap-2 text-h3">
              What limits this link
            </h2>
            <ul className="space-y-2">
              {route.qualifiers.map((q) => (
                <li key={q.id} className="flex flex-wrap items-start gap-2 text-ui text-ink-2">
                  <ContradictsBadge />
                  <span className="min-w-0 flex-1">
                    {plain
                      ? 'This finding limits how broadly the connection can be used.'
                      : (q.scope ?? 'Contradicting evidence.')}{' '}
                    <CitationMarker edge={q} />
                    {plain && q.scope && (
                      <details className="mt-1 text-label">
                        <summary className="cursor-pointer text-accent-ink">Read the original limit</summary>
                        <p className="mt-1">{q.scope}</p>
                      </details>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!lite && (
          <div className="grid gap-8 md:grid-cols-2">
            <section aria-labelledby="differs">
              <h2 id="differs" className="mb-2 text-h3">
                {plain ? 'What is different' : 'What differs between them'}
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-ui text-ink-2 marker:text-ink-3">
                {route.differences.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="check">
              <h2 id="check" className="mb-2 text-h3">
                {plain ? 'What still needs checking' : 'What must be checked before joining forces'}
              </h2>
              <ul
                className="list-disc space-y-1.5 pl-5 text-ui text-ink-2 marker:text-ink-3"
                data-testid="open-questions"
              >
                {route.openQuestions.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>

      {wide && (
        <aside aria-label="Evidence for the selected step">
          <div className="sticky top-28 border-l border-line pl-6">
            <p className="meta-label mb-3">Evidence for step {all.findIndex((s) => s.edge.id === selected) + 1}</p>
            <AnimatePresence mode="wait" initial={false}>
              {current && (
                <motion.div
                  key={current.edge.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <EvidencePanel edge={current.edge} from={current.subject} to={current.object} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      )}
    </div>
  )
}

function StepList({
  title,
  steps,
  selected,
  onSelect,
  plain,
  offset,
  inline,
}: {
  title: string
  steps: RouteStep[]
  selected: string
  onSelect: (id: string) => void
  plain: boolean
  offset: number
  /** Narrow screens: evidence opens under the step instead of beside the list. */
  inline: boolean
}) {
  return (
    <section>
      <h2 className="mb-3 text-h3">{title}</h2>
      <ol className="relative space-y-1" data-testid="route-steps">
        {steps.map((s, i) => {
          const active = s.edge.id === selected
          return (
            <li key={s.edge.id}>
              <div
                className={cn(
                  'grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-sm px-2 py-3 transition-colors',
                  active ? 'bg-surface' : 'hover:bg-surface/60',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex size-6 items-center justify-center rounded-full border font-mono text-[11px]',
                    s.edge.basis === 'inferred'
                      ? 'border-dashed border-inferred text-inferred-ink'
                      : 'border-line-strong text-ink-2',
                    active && 'border-accent text-accent-ink',
                  )}
                >
                  {offset + i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-ui text-ink">
                    {plain
                      ? plainEdgeSentence(s.edge, s.subject, s.object)
                      : edgeSentence(s.edge, s.subject, s.object, false)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {(!plain || s.edge.basis === 'inferred') && <BasisBadge basis={s.edge.basis} />}
                    <CitationMarker edge={s.edge} />
                    <button
                      type="button"
                      onClick={() => onSelect(s.edge.id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-xs px-1 text-label',
                        active ? 'text-ink-3' : 'text-accent-ink hover:underline',
                      )}
                    >
                      {active ? 'Evidence shown' : 'Show evidence'}
                      <span className="sr-only"> for step {offset + i + 1}</span>
                    </button>
                  </div>
                </div>
              </div>
              {active && inline && (
                <div className="mt-2 mb-4 ml-11 border-l border-line pl-4">
                  <EvidencePanel edge={s.edge} from={s.subject} to={s.object} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
