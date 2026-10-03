'use client'

import type { Coverage, NoRoute } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { formatDate } from '@/lib/copy'
import { Ident } from './node-bits'

interface Props {
  /** Known condition with no supported route. */
  noRoute?: NoRoute
  /** Query that matched nothing in the atlas. */
  query?: string
  coverage: Coverage
}

/** Honest empty state: what was searched, what is missing, and what would answer it. */
export function NoRouteState({ noRoute, query, coverage }: Props) {
  const { detail } = useRole()
  const plain = detail === 'plain'
  const technical = detail === 'technical'

  const title = query
    ? plain
      ? `“${query}” is not in this atlas yet`
      : `No supported route: “${query}” is not in the atlas`
    : plain
      ? 'No well-supported link to another community yet'
      : 'No supported route to another community'

  const searched = noRoute?.searched ?? [
    `Names, synonyms and ontology ids for ${coverage.counts.nodes} records`,
    `Related terms from MONDO for each condition`,
    `Gene symbols for the ${coverage.genes.length} genes in scope`,
  ]
  const scope = `conditions linked to ${coverage.genes.length} genes (${coverage.genes.join(', ')})`
  const missing = noRoute?.missing ?? [`This atlas covers ${scope}. Nothing in it is named or indexed as “${query}”.`]
  const next =
    noRoute?.nextQuestions ??
    (plain
      ? [
          'Check the spelling, or try the gene name from the genetic test report.',
          'Ask the atlas team to add this condition. The same sources (MONDO, HPO, PubMed, NIH RePORTER) can be searched for it.',
        ]
      : [
          'Try a synonym, gene symbol or MONDO id.',
          `Extend the slice beyond ${coverage.genes.join(', ')} by running the same source queries for this term.`,
        ])

  return (
    <section
      aria-labelledby="no-route-title"
      data-testid="no-route"
      className="max-w-[760px] border-l-2 border-line-strong pl-5"
    >
      <p className="meta-label mb-1">{plain ? 'Result' : 'No supported route'}</p>
      <h2 id="no-route-title" className="text-h2 text-ink">
        {title}
      </h2>
      {noRoute && (
        <p className="mt-3 text-body text-ink-2">
          {plain
            ? `We looked for other conditions linked to ${noRoute.from.name} by the same cause in the body. We found none with good evidence, so we are not showing a guess.`
            : noRoute.reason === 'only_broad_phenotypes'
              ? `${noRoute.from.name} shares only common symptoms with other conditions here. Common symptoms are not enough to suggest shared biology, so no route is shown.`
              : `No other condition in the atlas shares a cited mechanism with ${noRoute.from.name}.`}
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <List title={plain ? 'What we checked' : 'What was searched'} items={searched} />
        <List title={plain ? 'What is missing' : 'What is missing'} items={missing} />
        <List title={plain ? 'What could help' : 'What would answer it'} items={next} />
      </div>

      <p className="mt-6 text-label text-ink-3">
        This atlas covers {scope}. Sources retrieved {formatDate(coverage.snapshotDate)}.
      </p>

      {technical && coverage.queries.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-label">
            <caption className="mb-2 text-left text-ink-3">Source queries behind this slice</caption>
            <thead className="text-ink-3">
              <tr className="border-b border-line">
                <th className="py-1.5 pr-4 font-medium">Source</th>
                <th className="py-1.5 pr-4 font-medium">Query</th>
                <th className="py-1.5 pr-4 text-right font-medium">Found</th>
                <th className="py-1.5 text-right font-medium">Kept</th>
              </tr>
            </thead>
            <tbody>
              {coverage.queries.map((q) => (
                <tr key={`${q.source}-${q.query}`} className="border-b border-line">
                  <td className="py-1.5 pr-4 text-ink-2">{q.source}</td>
                  <td className="py-1.5 pr-4">
                    <Ident className="text-ink-2">{q.query}</Ident>
                  </td>
                  <td className="py-1.5 pr-4 text-right">{q.total}</td>
                  <td className="py-1.5 text-right">
                    {q.retrieved}
                    {q.truncated && <span className="text-ink-3"> (sampled)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 font-sans text-ui font-semibold text-ink">{title}</h3>
      <ul className="space-y-1.5 text-ui text-ink-2">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  )
}
