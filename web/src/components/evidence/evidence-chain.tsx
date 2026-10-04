import type { Connection, Edge } from '@/lib/model'
import { cn } from '@/lib/cn'

/** What a connection is built from, counted from the graph. No score: only how many steps and of what kind. */
export interface Chain {
  /** Steps that are observed and support the link, each with its own source. */
  cited: number
  /** Steps the link is built from that are not observed supporting evidence. */
  other: number
  /** The link itself is a hypothesis built from those steps. */
  inferred: boolean
  /** Contradicting findings that limit the link. */
  limits: number
}

export function chainOf(c: Connection, edgeById: Map<string, Edge>): Chain {
  let cited = 0
  let other = 0
  for (const id of c.inferredEdge?.derivedFrom ?? []) {
    const e = edgeById.get(id)
    if (!e) continue
    if (e.basis === 'observed' && e.stance === 'supports' && e.status !== 'rejected') cited++
    else other++
  }
  return { cited, other, inferred: !!c.inferredEdge, limits: c.qualifiers.length }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function chainText(ch: Chain): string {
  if (!ch.inferred) return 'No cited route: shared symptoms only'
  const parts = [plural(ch.cited, 'cited step')]
  if (ch.other > 0) parts.push(plural(ch.other, 'unconfirmed step'))
  const steps = parts.join(', ')
  return `${steps} → 1 inferred link${ch.limits > 0 ? ` · ${plural(ch.limits, 'limit')}` : ''}`
}

const SEG = 'h-2 w-5 rounded-xs'

/** One bar per step: solid = cited, dashed = inferred. Shape and text carry the meaning, not colour alone. */
export function EvidenceChain({ chain }: { chain: Chain }) {
  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-ink-2"
      data-testid="evidence-chain"
    >
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {!chain.inferred && <span className={cn(SEG, 'border border-dotted border-ink-3')} />}
        {Array.from({ length: chain.cited }, (_, i) => (
          <span key={`c${i}`} className={cn(SEG, 'bg-accent')} />
        ))}
        {Array.from({ length: chain.other }, (_, i) => (
          <span key={`o${i}`} className={cn(SEG, 'border border-dashed border-ink-3')} />
        ))}
        {chain.inferred && (
          <>
            <span className="mx-0.5 text-meta leading-none text-ink-3">→</span>
            <span className={cn(SEG, 'border border-dashed border-inferred bg-inferred-weak')} />
          </>
        )}
        {Array.from({ length: chain.limits }, (_, i) => (
          <span key={`l${i}`} className="ml-1 size-2 rounded-full border-2 border-contra" />
        ))}
      </span>
      <span>{chainText(chain)}</span>
    </span>
  )
}

/** Key for the bars above, printed once under a list. */
export function EvidenceChainLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-label text-ink-2" aria-label="Key to the bars">
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className={cn(SEG, 'bg-accent')} />
        Cited step
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className={cn(SEG, 'border border-dashed border-inferred bg-inferred-weak')} />
        Inferred link
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full border-2 border-contra" />
        Limit from contradicting evidence
      </li>
    </ul>
  )
}
