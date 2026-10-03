'use client'

import { useEffect, useState } from 'react'
import type { ReviewItem } from '@/lib/model'
import { useAddedSynonyms, useAdminMutations, useCoverage, useGraph, useMeta, useReviewQueue } from '@/lib/queries'
import { useAdminPrefs } from '@/lib/admin-store'
import { ErrorNote, Pending, Section } from '@/components/layout/page'
import { CitationMarker } from '@/components/evidence/citation'
import { BasisBadge, SampleBadge, TierBadge } from '@/components/evidence/badges'
import { Ident } from '@/components/atlas/node-bits'
import { Button } from '@/components/ui/button'
import { SOURCE_LABEL, edgeSentence, formatDate } from '@/lib/copy'

export function AdminView() {
  const queries = [useMeta(), useCoverage(), useReviewQueue(), useGraph(), useAddedSynonyms()]
  // One paint once everything is ready, so sections do not shift each other.
  if (queries.some((q) => q.isLoading)) return <Pending label="Loading administration" lines={12} />
  return (
    <div className="space-y-12">
      <BuilderStatus />
      <ReviewQueue />
      <div className="grid gap-12 lg:grid-cols-2">
        <SynonymEditor />
        <ConfidenceThreshold />
      </div>
      <SourceCoverage />
    </div>
  )
}

function BuilderStatus() {
  const meta = useMeta()
  const queue = useReviewQueue()
  const coverage = useCoverage()
  if (!meta.data || !coverage.data) return <Pending label="Reading builder status" />
  const m = meta.data
  const q = queue.data ?? []
  const open = q.filter((i) => i.decision === null).length
  const rows: [string, React.ReactNode][] = [
    ['Data source', `${m.label} (${m.source})`],
    ['Snapshot', m.snapshotDate ? formatDate(m.snapshotDate) : 'Not recorded'],
    ['Source commit', m.sourceCommit ? <Ident key="c">{m.sourceCommit.slice(0, 12)}</Ident> : 'Not recorded'],
    ['Records', m.counts.nodes],
    ['Cited links', m.counts.edges],
    ['Evidence items', m.counts.evidence],
    ['Mechanism clusters', m.counts.clusters],
    ['Inferred links built', q.filter((i) => i.origin === 'inferred').length],
    ['Awaiting review', open],
    ['Scored links', `${coverage.data.scoredEdges} of ${m.counts.edges}`],
  ]
  return (
    <Section title="Graph builder status" id="builder" aside="Inference runs over the pinned slice when the app loads">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="builder-status">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-label text-ink-3">{k}</dt>
            <dd className="mt-0.5 font-mono text-ui text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

function ReviewQueue() {
  const queue = useReviewQueue()
  const { review } = useAdminMutations()
  if (queue.isLoading) return <Pending label="Loading review queue" />
  if (queue.error) return <ErrorNote error={queue.error} />
  const items = queue.data ?? []
  return (
    <Section title="Edge review queue" id="review" aside={`${items.filter((i) => i.decision === null).length} open`}>
      <p className="mb-4 max-w-[80ch] text-label text-ink-3">
        Inferred links and contributed links wait here. Rejecting one removes it from every view, including connections
        and action plans. Decisions are stored in this browser only.
      </p>
      <ul className="divide-y divide-line border-y border-line" data-testid="review-queue">
        {items.map((item) => (
          <ReviewRow
            key={item.edge.id}
            item={item}
            busy={review.isPending}
            onDecide={(decision) => review.mutate({ edgeId: item.edge.id, decision })}
          />
        ))}
      </ul>
    </Section>
  )
}

function ReviewRow({
  item,
  busy,
  onDecide,
}: {
  item: ReviewItem
  busy: boolean
  onDecide: (d: 'approved' | 'rejected' | null) => void
}) {
  const { edge, from, to, decision } = item
  return (
    <li className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="text-ui text-ink">
          {edgeSentence(edge, from, to, false)} <CitationMarker edge={edge} />
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-label text-ink-3">
            {item.origin === 'inferred' ? 'Inferred by the graph' : 'Contributed'}
          </span>
          <BasisBadge basis={edge.basis} />
          <TierBadge tier={edge.tier} />
          {edge.sample && <SampleBadge />}
          {edge.derivedFrom && (
            <span className="text-meta text-ink-3">from {edge.derivedFrom.length} observed links</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {decision ? (
          <>
            <span
              className={
                decision === 'approved' ? 'text-label font-medium text-ink' : 'text-label font-medium text-contra-ink'
              }
            >
              {decision === 'approved' ? 'Approved' : 'Rejected'}
            </span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide(null)}>
              Undo
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onDecide('approved')}
              aria-label={`Approve: ${from.name} to ${to.name}`}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onDecide('rejected')}
              aria-label={`Reject: ${from.name} to ${to.name}`}
            >
              Reject
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

function SynonymEditor() {
  const graph = useGraph()
  const added = useAddedSynonyms()
  const { addSynonym, removeSynonym } = useAdminMutations()
  const [nodeId, setNodeId] = useState('')
  const [value, setValue] = useState('')
  const options = (graph.data?.nodes ?? [])
    .filter((n) => ['disease', 'gene', 'mechanism'].includes(n.type))
    .sort((a, b) => a.name.localeCompare(b.name))
  const selected = options.find((n) => n.id === nodeId)
  const entries = Object.entries(added.data ?? {}).flatMap(([id, list]) => list.map((s) => ({ id, s })))
  const name = (id: string) => options.find((n) => n.id === id)?.name ?? id

  return (
    <Section title="Synonyms" id="synonyms">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!nodeId || !value.trim()) return
          addSynonym.mutate({ nodeId, synonym: value.trim() }, { onSuccess: () => setValue('') })
        }}
      >
        <div>
          <label htmlFor="syn-node" className="mb-1 block text-label text-ink-3">
            Record
          </label>
          <select
            id="syn-node"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            className="h-9 w-full rounded-sm border border-line-strong bg-paper px-2 text-ui text-ink"
          >
            <option value="">Choose a condition, gene or mechanism</option>
            {options.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        {selected && selected.synonyms.length > 0 && (
          <p className="text-label text-ink-3">Already known as: {selected.synonyms.join('; ')}</p>
        )}
        <div>
          <label htmlFor="syn-value" className="mb-1 block text-label text-ink-3">
            New synonym
          </label>
          <div className="flex gap-2">
            <input
              id="syn-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-sm border border-line-strong bg-paper px-2 text-ui text-ink focus:border-accent focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={!nodeId || !value.trim() || addSynonym.isPending}
            >
              Add
            </Button>
          </div>
        </div>
        <p className="text-label text-ink-3">
          Search uses added synonyms straight away. They are stored in this browser and are not sent to the shared
          dataset.
        </p>
      </form>
      {entries.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {entries.map(({ id, s }) => (
            <li key={`${id}-${s}`} className="flex items-center justify-between gap-3 py-2 text-ui">
              <span>
                <span className="text-ink">{s}</span> <span className="text-label text-ink-3">for {name(id)}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => removeSynonym.mutate({ nodeId: id, synonym: s })}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function ConfidenceThreshold() {
  const coverage = useCoverage()
  const meta = useMeta()
  const { confidenceThreshold, setConfidenceThreshold } = useAdminPrefs()
  useEffect(() => {
    void useAdminPrefs.persist.rehydrate()
  }, [])
  const scored = coverage.data?.scoredEdges ?? 0
  const total = meta.data?.counts.edges ?? 0
  return (
    <Section title="Confidence threshold" id="threshold">
      <label htmlFor="threshold" className="mb-2 flex items-baseline justify-between text-label text-ink-3">
        <span>Links scored below this need review before they show</span>
        <span className="font-mono text-ui text-ink">{confidenceThreshold.toFixed(2)}</span>
      </label>
      <input
        id="threshold"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={confidenceThreshold}
        onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
      <p className="mt-3 border-l-2 border-inferred pl-3 text-ui text-ink-2" data-testid="threshold-note">
        {scored} of {total} links have a calibrated confidence score, so this setting changes nothing yet. The atlas
        will not invent a score; once scoring lands, links under the threshold will move to the review queue.
      </p>
    </Section>
  )
}

function SourceCoverage() {
  const coverage = useCoverage()
  if (!coverage.data) return <Pending label="Loading coverage" />
  const c = coverage.data
  return (
    <Section title="Source coverage" id="coverage" aside={`Retrieved ${formatDate(c.snapshotDate)}`}>
      <p className="mb-4 max-w-[80ch] text-ui text-ink-2">
        <span className="text-ink-3">Why this slice (data team note): </span>
        {c.scope}
      </p>
      <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div>
          <table className="w-full text-left text-label" data-testid="coverage-by-source">
            <caption className="mb-2 text-left text-ink-3">Evidence items by source</caption>
            <tbody>
              {c.evidenceBySource.map((s) => (
                <tr key={s.sourceType} className="border-b border-line">
                  <th scope="row" className="py-1.5 pr-4 font-normal text-ink-2">
                    {SOURCE_LABEL[s.sourceType]}
                  </th>
                  <td className="py-1.5 text-right font-mono text-ink">{s.count}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-1.5 pr-4 font-normal text-ink-3">
                  Records with ontology ids
                </th>
                <td className="py-1.5 text-right font-mono text-ink">
                  {c.nodesWithOntologyIds} of {c.counts.nodes}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-label">
            <caption className="mb-2 text-left text-ink-3">Queries behind the slice</caption>
            <thead className="text-ink-3">
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-1.5 pr-4 font-medium">
                  Source
                </th>
                <th scope="col" className="py-1.5 pr-4 font-medium">
                  Query
                </th>
                <th scope="col" className="py-1.5 pr-4 text-right font-medium">
                  Found
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Kept
                </th>
              </tr>
            </thead>
            <tbody>
              {c.queries.map((q) => (
                <tr key={`${q.source}-${q.query}`} className="border-b border-line">
                  <td className="py-1.5 pr-4 text-ink-2">{q.source}</td>
                  <td className="py-1.5 pr-4">
                    <Ident className="text-ink-2">{q.query}</Ident>
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono">{q.total}</td>
                  <td className="py-1.5 text-right font-mono">
                    {q.retrieved}
                    {q.truncated && <span className="font-sans text-ink-3"> sampled</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {c.limitations.length > 0 && (
        <div className="mt-6">
          <h3 className="meta-label mb-2">Known limitations</h3>
          <ul className="list-disc space-y-1 pl-5 text-ui text-ink-2 marker:text-ink-3">
            {c.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}
