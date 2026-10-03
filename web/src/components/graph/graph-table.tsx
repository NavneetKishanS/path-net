'use client'

import type { AtlasNode, Edge } from '@/lib/model'
import { AppLink } from '@/components/role/app-link'
import { CitationMarker } from '@/components/evidence/citation'
import { BasisBadge, ContradictsBadge } from '@/components/evidence/badges'
import { RELATION_LABEL } from '@/lib/copy'
import { nodeHref } from '@/components/search/global-search'

/** Table alternative to the map: every link, its type and its source, reachable by keyboard. */
export function GraphTable({ nodes, edges, caption }: { nodes: AtlasNode[]; edges: Edge[]; caption: string }) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const rows = edges.filter((e) => byId.has(e.from) && byId.has(e.to))
  return (
    <div className="overflow-x-auto" data-testid="graph-table">
      <table className="w-full min-w-[640px] text-left text-label">
        <caption className="mb-2 text-left text-ink-3">{caption}</caption>
        <thead className="text-ink-3">
          <tr className="border-b border-line-strong">
            <th scope="col" className="py-2 pr-4 font-medium">
              From
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Link
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              To
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Basis
            </th>
            <th scope="col" className="py-2 font-medium">
              Evidence
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const a = byId.get(e.from)!
            const b = byId.get(e.to)!
            return (
              <tr key={e.id} className="border-b border-line align-top">
                <td className="py-2 pr-4">
                  <AppLink href={nodeHref(a)} className="text-ink hover:underline">
                    {a.name}
                  </AppLink>
                </td>
                <td className="py-2 pr-4 text-ink-2">{RELATION_LABEL[e.relation]}</td>
                <td className="py-2 pr-4">
                  <AppLink href={nodeHref(b)} className="text-ink hover:underline">
                    {b.name}
                  </AppLink>
                </td>
                <td className="py-2 pr-4">
                  <span className="flex flex-wrap gap-1">
                    <BasisBadge basis={e.basis} />
                    {e.stance === 'contradicts' && <ContradictsBadge />}
                  </span>
                </td>
                <td className="py-2">
                  <CitationMarker edge={e} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
