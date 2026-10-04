'use client'

import type { AtlasNode, Edge, Evidence } from '@/lib/model'
import { edgeSentence, formatDate, RELATION_LABEL, SOURCE_LABEL, SOURCE_PLAIN } from '@/lib/copy'
import { useRole } from '@/components/role/role-provider'
import { useGraph } from '@/lib/queries'
import { BasisBadge, ContradictsBadge, SampleBadge, StatusBadge, TierBadge } from './badges'
import { CitationMarker } from './citation'
import { plainEvidence } from '@/lib/plain-language'

interface Props {
  edge: Edge
  from: AtlasNode
  to: AtlasNode
}

/**
 * Evidence for one edge, rendered for the current detail level:
 *  plain     simple explanation, limits and every source, with original quotations on disclosure
 *  standard  relation type, basis, curator scope, each source with its quote and date
 *  technical tier, status, confidence, ids, raw rows, and what it was built from
 * Contradicting evidence and source scope remain available at every detail level.
 */
export function EvidencePanel({ edge, from, to }: Props) {
  const { detail } = useRole()
  const graph = useGraph()
  const plain = detail === 'plain'
  const sentence = edgeSentence(edge, from, to, plain)

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

  if (plain) {
    const readable = plainEvidence(edge, from, to)
    return (
      <div className="space-y-4" data-testid="plain-evidence">
        <div className="flex flex-wrap items-center gap-1.5">
          <BasisBadge basis={edge.basis} />
          {edge.stance === 'contradicts' && <ContradictsBadge label="Evidence against" />}
          {edge.sample && <SampleBadge />}
          {edge.status !== 'verified' && <StatusBadge status={edge.status} />}
        </div>
        <p className="prose-read">{readable.sentence}</p>
        {readable.warnings.map((warning) => (
          <p key={warning} className="text-ui text-ink-2">
            {warning}
          </p>
        ))}
        {readable.scope && (
          <section>
            <h3 className="meta-label">Where this finding applies · original source limits</h3>
            <p className="mt-1 text-ui text-ink-2">{readable.scope}</p>
          </section>
        )}
        <section>
          <h3 className="meta-label">Where this comes from ({readable.evidence.length})</h3>
          {readable.evidence.length === 0 ? (
            <p className="mt-1 text-ui text-ink-2">No source is attached to this link yet.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {readable.evidence.map((ev) => (
                <li key={ev.id} className="text-ui">
                  <p className="text-ink-2">
                    From {SOURCE_PLAIN[ev.sourceType]}. {ev.sample && <SampleBadge />}
                  </p>
                  {ev.url ? (
                    <a className="link" href={ev.url} target="_blank" rel="noreferrer">
                      {ev.title}
                    </a>
                  ) : (
                    <p className="text-ink-2">{ev.title} · Source link not recorded.</p>
                  )}
                  {ev.stance === 'contradicts' && (
                    <p className="text-contra-ink">This source limits or argues against the link.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        {derived.length > 0 && (
          <section>
            <h3 className="meta-label">Findings this suggestion is built from</h3>
            <ul className="mt-2 space-y-2">
              {derived.map((d) => {
                const a = byId(d.from)
                const b = byId(d.to)
                return (
                  <li key={d.id} className="text-ui text-ink-2">
                    {a && b ? plainEvidence(d, a, b).sentence : d.id} <CitationMarker edge={d} />
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        {contradictions.length > 0 && (
          <section className="border-t border-contra/30 pt-3">
            <h3 className="meta-label">Evidence that limits this connection</h3>
            <ul className="mt-2 space-y-2">
              {contradictions.map((c) => {
                const a = byId(c.from)
                const b = byId(c.to)
                return (
                  <li key={c.id} className="text-ui text-ink-2">
                    {a && b ? plainEvidence(c, a, b).sentence : 'This evidence limits the link.'}{' '}
                    <CitationMarker edge={c} />
                    {c.scope && <p className="mt-1 text-label">{c.scope}</p>}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        <details className="border-t border-line pt-3" data-testid="original-evidence">
          <summary className="cursor-pointer text-ui font-medium text-accent-ink">
            Read original wording and source quotations
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-ui text-ink-2">{readable.scientificSentence}</p>
            <p className="text-label text-ink-3">
              Confidence: {readable.confidence === null ? 'Not scored yet.' : readable.confidence.toFixed(2)}
            </p>
            <ul className="divide-y divide-line">
              {readable.evidence.map((ev) => (
                <EvidenceItem key={ev.id} ev={ev} technical />
              ))}
            </ul>
          </div>
        </details>
      </div>
    )
  }

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
        <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-ui text-ink-2 italic">
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
