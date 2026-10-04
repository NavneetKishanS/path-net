'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Connection, Edge } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { CitationMarker } from '@/components/evidence/citation'
import { BasisBadge, ContradictsBadge, SupportedBadge } from '@/components/evidence/badges'
import { EvidenceChain, EvidenceChainLegend, chainOf } from '@/components/evidence/evidence-chain'
import { edgeSentence } from '@/lib/copy'
import { plainEdgeSentence, plainNodeLabel } from '@/lib/plain-language'
import { useGraph } from '@/lib/queries'
import { Ident } from './node-bits'

const KIND_LABEL = {
  mechanism: 'Shared mechanism',
  investigator: 'Shared investigator',
  phenotype: 'Overlapping symptoms only',
} as const

/** Ranked connections from one condition. The ranking rule is stated, not scored. */
export function ConnectionList({
  fromId,
  connections,
  limit,
}: {
  fromId: string
  connections: Connection[]
  limit?: number
}) {
  const { detail } = useRole()
  const graph = useGraph()
  const edgeById = useMemo(() => new Map<string, Edge>((graph.data?.edges ?? []).map((e) => [e.id, e])), [graph.data])
  const shown = limit ? connections.slice(0, limit) : connections
  if (connections.length === 0) {
    return (
      <p className="text-ui text-ink-2">
        No other condition in this atlas connects to this one through a mechanism, an investigator or a shared symptom.
      </p>
    )
  }
  return (
    <div>
      <ol className="divide-y divide-line border-y border-line" data-testid="connection-list">
        {shown.map((c) => (
          <ConnectionRow
            key={c.disease.id}
            fromId={fromId}
            c={c}
            edgeById={edgeById}
            plain={detail === 'plain'}
            technical={detail === 'technical'}
          />
        ))}
      </ol>
      <div className="mt-3">
        <EvidenceChainLegend />
      </div>
      <p className="mt-2 text-label text-ink-3">
        Ordered by kind of link: shared mechanism first, then shared investigator, then symptom overlap. Within each,
        links with fewer contradictions come first. There is no numeric score.
      </p>
    </div>
  )
}

function ConnectionRow({
  fromId,
  c,
  edgeById,
  plain,
  technical,
}: {
  fromId: string
  c: Connection
  edgeById: Map<string, Edge>
  plain: boolean
  technical: boolean
}) {
  const graph = useGraph()
  const routable = c.kind !== 'phenotype'
  const nodes = graph.data?.nodes ?? []
  return (
    <li className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <AppLink href={`/disease/${c.disease.id}`} className="text-[18px] font-semibold text-ink hover:underline">
            {c.disease.name}
          </AppLink>
          <span className="text-label text-ink-3">{KIND_LABEL[c.kind]}</span>
          {c.kind === 'mechanism' && c.supported && <SupportedBadge>Every step cited</SupportedBadge>}
          {c.inferredEdge && <BasisBadge basis="inferred" />}
        </div>
        {c.kind !== 'phenotype' && <EvidenceChain chain={chainOf(c, edgeById)} />}
        <p className="text-ui text-ink-2">
          {plain && c.inferredEdge
            ? plainEdgeSentence(
                c.inferredEdge,
                nodes.find((n) => n.id === c.inferredEdge!.from) ?? c.disease,
                nodes.find((n) => n.id === c.inferredEdge!.to) ?? c.disease,
              )
            : c.reason}{' '}
          {c.inferredEdge && <CitationMarker edge={c.inferredEdge} />}
        </p>
        {c.kind === 'mechanism' && (
          <p className="text-label text-ink-3">
            Through <span className="text-ink-2">{plain ? plainNodeLabel(c.via[0]!) : c.via[0]!.name}</span>
          </p>
        )}
        {c.sharedPhenotypes.length > 0 && !plain && (
          <details className="text-label text-ink-3">
            <summary className="cursor-pointer text-ink-2 hover:text-ink">
              Shared symptoms ({c.sharedPhenotypes.length})
            </summary>
            <p className="mt-1">
              {c.sharedPhenotypes.map((p, i) => (
                <span key={p.node.id}>
                  {i > 0 && ', '}
                  <AppLink
                    href={`/node/${p.node.id}`}
                    className={
                      p.informative
                        ? 'text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink'
                        : 'underline decoration-line underline-offset-2 hover:text-ink'
                    }
                  >
                    {p.node.name}
                  </AppLink>
                  {technical && (
                    <Ident className="text-ink-3">
                      {' '}
                      ({p.diseaseCount}/{p.annotatedTotal})
                    </Ident>
                  )}
                </span>
              ))}
              {!technical && c.sharedPhenotypes.every((p) => !p.informative) && ' (common across these conditions)'}
            </p>
          </details>
        )}
        {c.communities.length > 0 && (
          <p className="text-label text-ink-2">
            Community:{' '}
            {c.communities.map((k, i) => (
              <span key={k.group.id}>
                {i > 0 && ', '}
                <AppLink href={`/node/${k.group.id}`} className="link">
                  {k.group.name}
                </AppLink>
                {k.viaParent && <span className="text-ink-3"> (serves all of {k.viaParent.name})</span>}
              </span>
            ))}
          </p>
        )}
        {c.qualifiers.length > 0 && (
          <div className="flex flex-wrap items-start gap-2 pt-1">
            <ContradictsBadge label="Limited by" />
            <span className="min-w-0 flex-1 text-label text-ink-2">
              {c.qualifiers.map((q) => {
                const a = nodes.find((n) => n.id === q.from)
                const b = nodes.find((n) => n.id === q.to)
                return (
                  <span key={q.id} className="block">
                    {a && b ? (plain ? plainEdgeSentence(q, a, b) : edgeSentence(q, a, b, false)) : q.id}{' '}
                    <CitationMarker edge={q} />
                  </span>
                )
              })}
            </span>
          </div>
        )}
      </div>
      {routable && (
        <div className="md:pt-1">
          <AppLink
            href={`/route?from=${fromId}&to=${c.disease.id}`}
            className="inline-flex items-center gap-1.5 rounded-sm border border-line-strong px-2.5 py-1.5 text-label font-medium text-ink hover:bg-surface"
            data-testid={`why-${c.disease.id}`}
          >
            Why connected
            <ArrowRight className="size-3.5" aria-hidden />
          </AppLink>
        </div>
      )}
    </li>
  )
}
