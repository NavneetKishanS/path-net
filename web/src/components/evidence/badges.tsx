import type { ReactNode } from 'react'
import type { Edge } from '@/lib/model'
import { TIER_LABEL } from '@/lib/copy'
import { cn } from '@/lib/cn'

function Tag({ className, children, title }: { className?: string; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs border px-1.5 py-px text-meta leading-5 font-medium whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Line sample matching the graph: solid for observed, dashed for inferred. */
function LineMark({ dashed, className }: { dashed?: boolean; className?: string }) {
  return (
    <svg width="14" height="6" aria-hidden className={className}>
      <line
        x1="0"
        y1="3"
        x2="14"
        y2="3"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={dashed ? '3 2.5' : undefined}
      />
    </svg>
  )
}

export function BasisBadge({ basis }: { basis: Edge['basis'] }) {
  return basis === 'inferred' ? (
    <Tag
      className="border-inferred/50 bg-inferred-weak text-inferred-ink"
      title="Built by the graph from other links. A hypothesis, not a published finding."
    >
      <LineMark dashed />
      Inferred
    </Tag>
  ) : (
    <Tag className="border-line-strong text-ink-2" title="Stated directly by a cited source.">
      <LineMark />
      Observed
    </Tag>
  )
}

export function ContradictsBadge({ label = 'Contradicts' }: { label?: string }) {
  return (
    <Tag className="border-contra/50 bg-contra-weak text-contra-ink">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2.2" y1="7.8" x2="7.8" y2="2.2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      {label}
    </Tag>
  )
}

export function TierBadge({ tier }: { tier: Edge['tier'] }) {
  return (
    <Tag className="border-line text-ink-2" title={TIER_LABEL[tier]}>
      <span className="font-mono">Tier {tier}</span>
      <span className="text-ink-3">{TIER_LABEL[tier]}</span>
    </Tag>
  )
}

export function SampleBadge() {
  return (
    <Tag className="border-dashed border-ink-3 text-ink-2" title="Sample record for demonstration. Not a real source.">
      Sample
    </Tag>
  )
}

export function StatusBadge({ status }: { status: Edge['status'] }) {
  const text = {
    verified: 'Checked against source',
    unverified: 'Not yet reviewed',
    rejected: 'Rejected',
    pending: 'Pending review',
  }[status]
  return <Tag className="border-line text-ink-3">{text}</Tag>
}

export function SupportedBadge({ children = 'Supported route' }: { children?: ReactNode }) {
  return (
    <Tag className="border-supports/50 bg-supports-weak text-ink">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d="M1.5 5.2 4 7.5 8.5 2.5" fill="none" stroke="var(--supports)" strokeWidth="1.6" />
      </svg>
      {children}
    </Tag>
  )
}
