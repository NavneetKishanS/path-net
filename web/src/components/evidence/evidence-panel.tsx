'use client'

import type { AtlasNode, Edge, Evidence } from '@/lib/model'
import { edgeSentence, formatDate, RELATION_LABEL, SOURCE_LABEL, SOURCE_PLAIN } from '@/lib/copy'
import { useRole } from '@/components/role/role-provider'
import { useGraph } from '@/lib/queries'
import { BasisBadge, ContradictsBadge, SampleBadge, StatusBadge, TierBadge } from './badges'
import { CitationMarker } from './citation'

interface Props {
  edge: Edge
  from: AtlasNode
  to: AtlasNode
}

/**
 * Evidence for one edge, rendered for the current detail level:
 *  plain     one sentence and a link to the source
 *  standard  relation type, basis, curator scope, each source with its quote and date
 *  technical tier, status, confidence, ids, raw rows, and what it was built from
 * Contradicting evidence that touches this edge is always shown beside it (except in plain).
 */
export function EvidencePanel({ edge, from, to }: Props) {
  const { detail } = useRole()
  const graph = useGraph()
  const plain = detail === 'plain'
  const sentence = edgeSentence(edge, from, to, plain)

  if (plain) {
    const ev = edge.evidence[0]
    return (
      <div className="space-y-3">
        <p className="prose-read">{sentence}</p>
        {edge.basis === 'inferred' && (
          <p className="text-ui text-ink-2">
            The atlas worked this out by joining two separate findings. It is a lead to check with a specialist, not a
            proven fact.
          </p>
        )}
        {ev && ev.url ? (
          <p className="text-ui text-ink-2">
            Where this comes from: {SOURCE_PLAIN[ev.sourceType]}.{' '}
            <a className="link" href={ev.url} target="_blank" rel="noreferrer">
              Open the source
            </a>
          </p>
        ) : (
          <p className="text-ui text-ink-2">No source is attached to this link yet.</p>
        )}
      </div>
    )
  }

  const technical = detail === 'technical'
  const nodes = graph.data?.nodes ?? []
  const byId = (id: string) => nodes.find((n) => n.id === id)
  const derived = (edge.derivedFrom ?? [])
    .map((id) => graph.data?.edges.find((e) => e.id === id))
    .filter((e): e is Edge => !!e)
  const touch = new Set([edge.from, edge.to, ...derived.flatMap((d) => [d.from, d.to])])
  const mechanismLink = [
    'disease_mechanism',
    'gene_variant_mechanism',
    'shares_mechanism_with',
    'subgroup_of',
  ].includes(edge.relation)
  const contradictions =
    edge.stance === 'contradicts' || !mechanismLink
      ? []
      : (graph.data?.edges ?? []).filter(
          (e) => e.stance === 'contradicts' && e.id !== edge.id && (touch.has(e.to) || touch.has(e.from)),
        )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="meta-label mr-1">{RELATION_LABEL[edge.relation]}</span>
        <BasisBadge basis={edge.basis} />
        {edge.stance === 'contradicts' && <ContradictsBadge />}
        {edge.sample && <SampleBadge />}
        {technical && <TierBadge tier={edge.tier} />}
        {technical && <StatusBadge status={edge.status} />}
      </div>

      <p className="prose-read">{sentence}</p>

      {edge.scope && (
        <div>
          <h3 className="meta-label">What this does and does not claim</h3>
          <p className="mt-1 max-w-[68ch] text-ui text-ink-2">{edge.scope}</p>
        </div>
      )}

      {technical && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-label">
          <dt className="text-ink-3">Confidence</dt>
          <dd>
            {edge.confidence === null
              ? 'Not scored yet. No calibrated score exists for this edge.'
              : edge.confidence.toFixed(2)}
          </dd>
          <dt className="text-ink-3">Edge id</dt>
          <dd className="font-mono break-all">{edge.id}</dd>
          <dt className="text-ink-3">Direction</dt>
          <dd>
            <span className="font-mono">{from.id}</span> → <span className="font-mono">{to.id}</span>
          </dd>
        </dl>
      )}

      {derived.length > 0 && (
        <section>
          <h3 className="meta-label">Built from these observed links</h3>
          <ol className="mt-2 space-y-2 border-l border-dashed border-inferred/60 pl-3">
            {derived.map((d) => {
              const a = byId(d.from)
              const b = byId(d.to)
              return (
                <li key={d.id} className="text-ui">
                  {a && b ? edgeSentence(d, a, b, false) : d.id} <CitationMarker edge={d} />
                </li>
              )
            })}
          </ol>
          <p className="mt-2 text-label text-ink-3">
            An inferred link is only as strong as the links it joins. Read each one.
          </p>
        </section>
      )}

      {edge.basis === 'observed' && (
        <section>
          <h3 className="meta-label">Sources ({edge.evidence.length})</h3>
          {edge.evidence.length === 0 ? (
            <p className="mt-1 text-ui text-contra-ink">No evidence is attached to this edge yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {edge.evidence.map((ev) => (
                <EvidenceItem key={ev.id} ev={ev} technical={technical} />
              ))}
            </ul>
          )}
        </section>
      )}

      {contradictions.length > 0 && (
        <section className="border-t border-contra/30 pt-4">
          <h3 className="flex items-center gap-2">
            <ContradictsBadge label="Contradicting or limiting evidence" />
          </h3>
          <ul className="mt-2 space-y-2">
            {contradictions.map((c) => {
              const a = byId(c.from)
              const b = byId(c.to)
              return (
                <li key={c.id} className="text-ui">
                  {a && b ? edgeSentence(c, a, b, false) : c.id} <CitationMarker edge={c} />
                  {c.scope && <p className="mt-1 text-label text-ink-3">{c.scope}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function EvidenceItem({ ev, technical }: { ev: Evidence; technical: boolean }) {
  const raw = ev.sourceType === 'HPO' && ev.snippet?.includes('\t')
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="meta-label">{SOURCE_LABEL[ev.sourceType]}</span>
        <span className="text-meta text-ink-3">Retrieved {formatDate(ev.date)}</span>
      </div>
      {ev.url ? (
        <a className="link mt-0.5 block text-ui" href={ev.url} target="_blank" rel="noreferrer">
          {ev.title}
        </a>
      ) : (
        <p className="mt-0.5 text-ui text-contra-ink">{ev.title}</p>
      )}
      {ev.authors && <p className="text-meta text-ink-3">{ev.authors.join(', ')} et al.</p>}
      {ev.snippet && !raw && (
        <blockquote className="mt-2 border-l-2 border-line-strong pl-3 font-serif text-ui text-ink-2 italic">
          “{ev.snippet}”
        </blockquote>
      )}
      {ev.snippet && raw && technical && (
        <pre className="mt-2 overflow-x-auto rounded-xs bg-sunken p-2 font-mono text-[11px] leading-4 text-ink-2">
          {ev.snippet}
        </pre>
      )}
      {ev.snippet && raw && !technical && (
        <p className="mt-1 text-label text-ink-3">Structured annotation row (shown in technical view).</p>
      )}
      {technical && (
        <p className="mt-1 font-mono text-[11px] text-ink-3">
          {ev.id}
          {ev.pmid ? ` · PMID ${ev.pmid}` : ''}
        </p>
      )}
    </li>
  )
}
