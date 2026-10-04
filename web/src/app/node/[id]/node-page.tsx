'use client'

import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { ErrorNote, Page, Pending, Section } from '@/components/layout/page'
import { CitationMarker } from '@/components/evidence/citation'
import { ExternalLink } from '@/components/action/action-parts'
import { ExternalIds, TypeLabel, mechanismPlain } from '@/components/atlas/node-bits'
import { nodeHref } from '@/components/search/global-search'
import { DiseasePage } from '@/app/disease/[id]/disease-page'
import { useNode } from '@/lib/queries'
import { RELATION_LABEL, edgeSentence, studyStatusText } from '@/lib/copy'
import type { Edge } from '@/lib/model'
import { PLAIN_RELATION_LABEL, plainEdgeSentence, plainNodeLabel, plainTerm } from '@/lib/plain-language'

/** Any record that is not a condition: gene, mechanism, group, registry, study, award, person, symptom. */
export function NodePage({ id }: { id: string }) {
  const q = useNode(id)
  const { detail } = useRole()
  if (q.isLoading)
    return (
      <Page>
        <Pending lines={6} />
      </Page>
    )
  if (q.error || !q.data)
    return (
      <Page>
        <ErrorNote error={q.error ?? `No record with id ${id}`} />
      </Page>
    )
  const { node, edges, neighbours } = q.data
  if (node.type === 'disease') return <DiseasePage id={id} />
  const plain = detail === 'plain'
  const term = plainTerm(node)
  const nb = new Map(neighbours.map((n) => [n.id, n]))
  const url =
    typeof node.props.url === 'string'
      ? node.props.url
      : typeof node.props.source_url === 'string'
        ? node.props.source_url
        : null
  const byRelation = new Map<string, Edge[]>()
  for (const e of edges) byRelation.set(e.relation, [...(byRelation.get(e.relation) ?? []), e])

  return (
    <Page>
      <header className="mb-10">
        <div className="mb-2">
          <TypeLabel node={node} />
        </div>
        <h1 className="text-h2 text-ink md:text-h1">{plain ? plainNodeLabel(node) : node.name}</h1>
        {plain && term && (
          <div className="mt-3 max-w-[68ch]">
            <p className="text-body text-ink-2">{term.explanation}</p>
            {term.label !== node.name && <p className="mt-1 text-label text-ink-3">Medical term: {node.name}</p>}
            {term.readingUrl && (
              <a className="link mt-1 inline-block text-label" href={term.readingUrl} target="_blank" rel="noreferrer">
                Read about this term
              </a>
            )}
          </div>
        )}
        {node.synonyms.length > 0 && (
          <p className="mt-2 text-ui text-ink-2">
            <span className="text-ink-3">Also known as </span>
            {node.synonyms.join('; ')}
          </p>
        )}
        {node.type === 'mechanism' && !plain && (
          <p className="mt-3 max-w-[68ch] text-body text-ink-2">{mechanismPlain(node)}</p>
        )}
        {node.type !== 'mechanism' && node.summary && !plain && (
          <p className="mt-3 max-w-[68ch] text-body text-ink-2">{node.summary}</p>
        )}
        {plain && node.summary && (
          <details className="mt-3 max-w-[68ch] text-ui">
            <summary className="cursor-pointer text-accent-ink">Original description and limits</summary>
            <p className="mt-2 text-ink-2">{node.summary}</p>
            <div className="mt-2">
              <ExternalIds node={node} />
            </div>
          </details>
        )}
        {typeof node.props.next_step === 'string' && (
          <p className="mt-2 max-w-[68ch] text-ui text-ink-2">Next step: {node.props.next_step}</p>
        )}
        {node.type === 'study' && (
          <p className="mt-2 text-ui text-ink-2">
            Status: {studyStatusText(String(node.props.status ?? node.props.recruitment_status ?? '') || null)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-ui">
          {url && <ExternalLink href={url}>Public page</ExternalLink>}
          {!plain && <ExternalIds node={node} />}
        </div>
      </header>

      <div className="space-y-8">
        {[...byRelation.entries()].map(([rel, list]) => (
          <Section
            key={rel}
            title={capitalise((plain ? PLAIN_RELATION_LABEL : RELATION_LABEL)[rel as Edge['relation']] ?? rel)}
            aside={`${list.length}`}
          >
            <ul className="divide-y divide-line border-y border-line">
              {list.map((e) => {
                const other = nb.get(e.from === node.id ? e.to : e.from)
                const a = nb.get(e.from) ?? (e.from === node.id ? node : undefined)
                const b = nb.get(e.to) ?? (e.to === node.id ? node : undefined)
                return (
                  <li
                    key={e.id}
                    className="flex flex-col gap-1 py-2.5 md:flex-row md:items-baseline md:justify-between md:gap-6"
                  >
                    <span className="text-ui text-ink-2">
                      {a && b ? (plain ? plainEdgeSentence(e, a, b) : edgeSentence(e, a, b, false)) : e.id}{' '}
                      {other && (
                        <AppLink href={nodeHref(other)} className="link whitespace-nowrap">
                          Open
                        </AppLink>
                      )}
                    </span>
                    <CitationMarker edge={e} className="self-start" />
                  </li>
                )
              })}
            </ul>
          </Section>
        ))}
      </div>
    </Page>
  )
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
