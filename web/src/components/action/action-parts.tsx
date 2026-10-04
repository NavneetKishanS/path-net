'use client'

import { ArrowUpRight, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ActionItem, AssetCategory, AssetRecord, DuplicateSignal, InvestigatorRecord } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { CitationMarker } from '@/components/evidence/citation'
import { SampleBadge } from '@/components/evidence/badges'
import { useGraphIndex } from '@/lib/queries'
import { isOpenStudy, studyStatusText } from '@/lib/copy'

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-0.5">
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

export function EdgeCitations({ ids, max = 4 }: { ids: string[]; max?: number }) {
  const { edges } = useGraphIndex()
  const seen = new Set<string>()
  // Several edges often rest on the same source; show each source once.
  const list = ids
    .map((id) => edges.get(id))
    .filter((e) => !!e)
    .filter((e) => {
      const key = e.basis === 'inferred' ? e.id : (e.evidence[0]?.url ?? e.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  if (list.length === 0) return null
  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.slice(0, max).map((e) => (
        <CitationMarker key={e.id} edge={e} />
      ))}
      {list.length > max && <span className="text-meta text-ink-3">+{list.length - max} more</span>}
    </span>
  )
}

/** The few concrete steps for this week, each tied to the links that justify it. */
export function DoThisWeek({
  items,
  doneIds = [],
  hiddenIds = [],
}: {
  items: ActionItem[]
  /** Steps marked done in the action plan. */
  doneIds?: string[]
  /** Steps closed in the action plan. */
  hiddenIds?: string[]
}) {
  const { detail } = useRole()
  const shown = items.filter((a) => !hiddenIds.includes(a.id))
  if (shown.length === 0)
    return <p className="text-ui text-ink-2">No concrete step can be justified from the cited links yet.</p>
  return (
    <ol className="space-y-5" data-testid="do-this-week">
      {shown.map((a, i) => (
        <li key={a.id} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
          <span aria-hidden className="pt-0.5 font-mono text-label text-ink-3">
            {doneIds.includes(a.id) ? <Check className="size-4" /> : `${i + 1}.`}
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                'text-[18px] leading-snug font-semibold',
                doneIds.includes(a.id) ? 'text-ink-3 line-through decoration-ink-3/60' : 'text-ink',
              )}
            >
              {a.title}
              {doneIds.includes(a.id) && <span className="sr-only"> (done)</span>}
            </p>
            <p className="mt-1 max-w-[68ch] text-ui text-ink-2">{a.detail}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
              {detail !== 'plain' && (
                <span className="inline-flex items-center gap-1.5 text-ink-3">
                  Based on <EdgeCitations ids={a.edgeIds} />
                </span>
              )}
              {a.url && (
                <ExternalLink href={a.url}>{detail === 'plain' ? 'Visit their website' : 'Public page'}</ExternalLink>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  patient_data: 'Registries and natural history data',
  biosamples: 'Sample collections',
  funded_research: 'Funded research',
  study: 'Clinical studies',
}

export function AssetList({ assets }: { assets: AssetRecord[] }) {
  const { detail } = useRole()
  const groups = (['patient_data', 'biosamples', 'funded_research'] as AssetCategory[])
    .map((c) => ({ c, items: assets.filter((a) => a.category === c) }))
    .filter((g) => g.items.length > 0)
  if (groups.length === 0)
    return <p className="text-ui text-ink-2">No shared registries, samples or funded projects are linked here yet.</p>
  return (
    <div className="space-y-6" data-testid="asset-list">
      {groups.map((g) => (
        <div key={g.c}>
          <h3 className="meta-label mb-2">{CATEGORY_LABEL[g.c]}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {g.items.map((a) => (
              <li key={a.node.id} className="grid gap-1 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <AppLink href={`/node/${a.node.id}`} className="text-ui font-medium text-ink hover:underline">
                      {a.node.name}
                    </AppLink>
                    {a.node.sample && <SampleBadge />}
                  </div>
                  <p className="text-label text-ink-3">
                    For {a.diseases.map((d) => d.name).join('; ')}
                    {a.access && detail !== 'plain' ? ` · Access: ${a.access}` : ''}
                    {a.reuse && detail === 'technical' ? ` · Reuse: ${a.reuse}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-label">
                  <CitationMarker edge={a.edge} />
                  {a.url && <ExternalLink href={a.url}>Source</ExternalLink>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Possible duplicate effort. Worded as a prompt to compare, never as a finding. */
export function DuplicateCallout({ signals }: { signals: DuplicateSignal[] }) {
  if (signals.length === 0) return null
  return (
    <div className="space-y-3" data-testid="duplicates">
      {signals.map((s) => (
        <div key={`${s.clusterId}-${s.category}`} className="border-l-2 border-inferred pl-4">
          <p className="meta-label">Possible overlap in effort</p>
          <p className="mt-1 max-w-[68ch] text-ui text-ink-2">{s.note}</p>
          <ul className="mt-2 space-y-1 text-label">
            {s.assets.map((a) => (
              <li key={a.node.id} className="flex flex-wrap items-center gap-2">
                <AppLink href={`/node/${a.node.id}`} className="link">
                  {a.node.name}
                </AppLink>
                <span className="text-ink-3">({a.diseases.map((d) => d.name).join('; ')})</span>
                <CitationMarker edge={a.edge} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function StudyList({ studies }: { studies: AssetRecord[] }) {
  const { detail } = useRole()
  if (studies.length === 0) return <p className="text-ui text-ink-2">No clinical studies are linked here.</p>
  return (
    <ul className="divide-y divide-line border-y border-line" data-testid="study-list">
      {studies.map((s) => {
        const open = isOpenStudy(s.status)
        return (
          <li key={s.node.id} className="grid gap-1 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:gap-4">
            <div className="min-w-0">
              <AppLink href={`/node/${s.node.id}`} className="text-ui font-medium text-ink hover:underline">
                {s.node.name}
              </AppLink>
              <p className="text-label text-ink-3">
                <span className={open ? 'font-medium text-ink-2' : undefined}>{studyStatusText(s.status)}</span> ·{' '}
                {s.diseases.map((d) => d.name).join('; ')}
              </p>
            </div>
            <div className="flex items-center gap-3 text-label">
              {detail !== 'plain' && <CitationMarker edge={s.edge} />}
              {s.url && open && (
                <ExternalLink href={s.url}>
                  {detail === 'plain' ? 'See who can take part' : 'Eligibility on ClinicalTrials.gov'}
                </ExternalLink>
              )}
              {s.url && !open && detail !== 'plain' && <ExternalLink href={s.url}>Record</ExternalLink>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function PartnerList({ people, compact }: { people: InvestigatorRecord[]; compact?: boolean }) {
  const { detail } = useRole()
  if (people.length === 0) return <p className="text-ui text-ink-2">No investigators are linked here.</p>
  return (
    <ul className="divide-y divide-line border-y border-line" data-testid="partner-list">
      {people.map((p) => (
        <li key={p.node.id} className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <AppLink href={`/node/${p.node.id}`} className="text-ui font-medium text-ink hover:underline">
              {p.node.name}
            </AppLink>
            {p.sharedAcrossClusters && (
              <span className="rounded-xs border border-accent/40 px-1.5 text-meta font-medium text-accent-ink">
                Works across mechanisms
              </span>
            )}
          </div>
          <p className="text-label text-ink-3">
            {p.organization ? `${p.organization} · ` : ''}
            {p.diseases.map((d) => d.name).join('; ')}
          </p>
          {!compact && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
              {detail !== 'plain' && <EdgeCitations ids={p.edges.map((e) => e.id)} max={3} />}
              {p.profileUrl && <ExternalLink href={p.profileUrl}>NIH award record</ExternalLink>}
              <span className="text-ink-3">Contact through their institution’s public pages.</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
