'use client'

import { useQueryState } from 'nuqs'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { ErrorNote, Page, PageHeader, Pending } from '@/components/layout/page'
import { GlobalSearch, MatchedVia, nodeHref } from '@/components/search/global-search'
import { NoRouteState } from '@/components/atlas/no-route'
import { useSearch } from '@/lib/queries'
import { NODE_TYPE_LABEL } from '@/lib/copy'
import { PATIENT_TYPES } from '@/lib/engine/atlas'
import { queryParam } from '@/lib/url-state'

export default function SearchPage() {
  const [q] = useQueryState('q', queryParam)
  const { isLite, detail } = useRole()
  const lite = isLite('search')
  const res = useSearch(q, lite ? { types: PATIENT_TYPES, resolveGenes: true } : undefined)
  const plain = detail === 'plain'

  return (
    <Page narrow={lite}>
      <PageHeader title={q ? `Results for “${q}”` : 'Search'} />
      {lite && (
        <div className="mb-8">
          <GlobalSearch size="hero" />
        </div>
      )}
      {!q ? (
        <p className="text-ui text-ink-2">Type a condition, gene, symptom, mechanism or group.</p>
      ) : res.isLoading ? (
        <Pending label="Searching" />
      ) : res.error ? (
        <ErrorNote error={res.error} />
      ) : res.data?.status === 'no_match' ? (
        <NoRouteState query={q} coverage={res.data.coverage} />
      ) : (
        <ol className="divide-y divide-line border-y border-line" data-testid="search-results">
          {res.data?.matches.map((m, i) => (
            <li
              key={`${m.node.id}-${i}`}
              className="flex flex-col gap-0.5 py-3 md:flex-row md:items-baseline md:justify-between md:gap-6"
            >
              <div className="min-w-0">
                <AppLink href={nodeHref(m.node)} className="text-body text-ink hover:underline">
                  {m.node.name}
                </AppLink>
                <MatchedVia m={m} plain={plain} />
              </div>
              <span className="shrink-0 text-label text-ink-3">{NODE_TYPE_LABEL[m.node.type]}</span>
            </li>
          ))}
        </ol>
      )}
    </Page>
  )
}
