'use client'

import { useQueryState } from 'nuqs'
import type { Edge, Evidence } from '@/lib/model'
import { edgeParam } from '@/lib/url-state'
import { cn } from '@/lib/cn'

export function shortSource(ev: Evidence): string {
  if (ev.pmid) return `PMID ${ev.pmid}`
  const nct = ev.url.match(/NCT\d+/)?.[0]
  if (nct) return nct
  const rep = ev.url.match(/project-details\/(\d+)/)?.[1]
  if (rep) return `RePORTER ${rep}`
  const mondo = ev.title.match(/MONDO:\d+/)?.[0]
  if (mondo) return mondo
  if (ev.sourceType === 'HPO') return 'HPO'
  if (ev.sourceType === 'Orphanet') return ev.title.match(/ORPHA:\d+/)?.[0] ?? 'Orphanet'
  if (ev.sourceType === 'ClinVar') return ev.title.replace('ClinVar variation ', 'ClinVar ')
  try {
    return new URL(ev.url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

/** Inline citation: names its source and opens the evidence drawer for the edge. */
export function CitationMarker({ edge, className }: { edge: Edge; className?: string }) {
  const [, setEdge] = useQueryState('edge', edgeParam)
  const first = edge.evidence[0]
  const label = edge.basis === 'inferred' ? 'inferred' : first ? shortSource(first) : 'no source'
  const more = edge.basis === 'observed' && edge.evidence.length > 1 ? ` +${edge.evidence.length - 1}` : ''
  return (
    <button
      type="button"
      onClick={() => void setEdge(edge.id)}
      className={cn(
        // The pseudo-element widens the hit area to 24px without changing the chip's size.
        'relative inline-flex translate-y-[-1px] items-center rounded-xs border px-1 align-baseline font-mono text-[11px] leading-4 whitespace-nowrap transition-colors before:absolute before:-inset-y-1 before:-inset-x-0.5 before:content-[""]',
        edge.stance === 'contradicts'
          ? 'border-contra/40 text-contra-ink hover:bg-contra-weak'
          : edge.basis === 'inferred'
            ? 'border-dashed border-inferred/70 text-inferred-ink hover:bg-inferred-weak'
            : 'border-line-strong text-accent-ink hover:bg-accent-weak',
        className,
      )}
      aria-label={`Open evidence: ${label}${more}`}
    >
      {label}
      {more}
    </button>
  )
}
