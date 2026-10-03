'use client'

import { useMemo } from 'react'
import { useGraph, usePeople } from '@/lib/queries'
import { AppLink } from '@/components/role/app-link'
import { CitationMarker } from '@/components/evidence/citation'
import { ContradictsBadge } from '@/components/evidence/badges'
import { ClusterTag, Ident } from '@/components/atlas/node-bits'
import { Pending } from '@/components/layout/page'
import { EFFECT_LABEL, effectOf } from '@/lib/copy'

/** Researcher: every mechanism, the conditions it is cited for under all their names, and who works on them. */
export function MechanismIndex() {
  const graph = useGraph()
  const people = usePeople()
  const rows = useMemo(() => {
    const g = graph.data
    if (!g) return []
    const node = new Map(g.nodes.map((n) => [n.id, n]))
    return g.nodes
      .filter((n) => n.type === 'mechanism')
      .map((m) => {
        const edges = g.edges.filter((e) => e.relation === 'disease_mechanism' && e.to === m.id)
        const diseaseIds = new Set(edges.map((e) => e.from))
        return {
          m,
          supports: edges.filter((e) => e.stance === 'supports').map((e) => ({ e, d: node.get(e.from)! })),
          against: edges.filter((e) => e.stance === 'contradicts').map((e) => ({ e, d: node.get(e.from)! })),
          variants: g.edges
            .filter((e) => e.relation === 'gene_variant_mechanism' && e.to === m.id)
            .map((e) => ({ e, v: node.get(e.from)! })),
          people: (people.data ?? []).filter((p) => p.diseases.some((d) => diseaseIds.has(d.id))),
          clusters: g.clusters.filter((c) => c.mechanismIds.includes(m.id)),
        }
      })
      .sort((a, b) => b.supports.length - a.supports.length || a.m.name.localeCompare(b.m.name))
  }, [graph.data, people.data])

  if (graph.isLoading) return <Pending label="Loading mechanisms" lines={8} />
  return (
    <ol className="space-y-8" data-testid="mechanism-index">
      {rows.map(({ m, supports, against, variants, people: ppl, clusters }) => (
        <li key={m.id} className="border-t border-line pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="text-h3 text-ink">
              <AppLink href={`/node/${m.id}`} className="hover:underline">
                {m.name}
              </AppLink>
            </h3>
            <span className="text-label text-ink-3">
              {EFFECT_LABEL[effectOf(m)]}
              {clusters.map((c) => (
                <span key={c.id} className="ml-3">
                  <ClusterTag cluster={c} />
                </span>
              ))}
            </span>
          </div>
          {typeof m.props.scope === 'string' && (
            <p className="mt-1 max-w-[80ch] text-label text-ink-3">Scope: {m.props.scope}</p>
          )}

          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div>
              <p className="meta-label mb-1.5">Cited in ({supports.length})</p>
              <ul className="space-y-2 text-ui">
                {supports.map(({ e, d }) => (
                  <li key={e.id}>
                    <AppLink href={`/disease/${d.id}`} className="link">
                      {d.name}
                    </AppLink>{' '}
                    <CitationMarker edge={e} />
                    {d.synonyms.length > 0 && (
                      <span className="block text-label text-ink-3">also {d.synonyms.slice(0, 3).join(', ')}</span>
                    )}
                  </li>
                ))}
              </ul>
              {variants.length > 0 && (
                <p className="mt-2 text-label text-ink-3">
                  Variants:{' '}
                  {variants.map(({ e, v }) => (
                    <span key={e.id} className="mr-2 inline-flex items-center gap-1">
                      <Ident>{v.name}</Ident> <CitationMarker edge={e} />
                    </span>
                  ))}
                </p>
              )}
            </div>
            <div>
              <p className="meta-label mb-1.5">Evidence against ({against.length})</p>
              {against.length === 0 ? (
                <p className="text-label text-ink-3">None recorded in this slice.</p>
              ) : (
                <ul className="space-y-2 text-ui">
                  {against.map(({ e, d }) => (
                    <li key={e.id}>
                      <ContradictsBadge /> {d.name} <CitationMarker edge={e} />
                      {e.scope && <span className="block text-label text-ink-3">{e.scope}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="meta-label mb-1.5">Investigators on these conditions ({ppl.length})</p>
              <ul className="space-y-1 text-ui">
                {ppl.slice(0, 6).map((p) => (
                  <li key={p.node.id}>
                    <AppLink href={`/node/${p.node.id}`} className="link">
                      {p.node.name}
                    </AppLink>
                    {p.organization && <span className="text-label text-ink-3"> · {p.organization}</span>}
                  </li>
                ))}
                {ppl.length > 6 && (
                  <li>
                    <AppLink href="/people" className="text-label text-ink-3 hover:underline">
                      and {ppl.length - 6} more
                    </AppLink>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
