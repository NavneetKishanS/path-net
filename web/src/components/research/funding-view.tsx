'use client'

import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { ErrorNote, Pending, Section } from '@/components/layout/page'
import { ExternalLink } from '@/components/action/action-parts'
import { Ident } from '@/components/atlas/node-bits'
import { useFunding } from '@/lib/queries'
import { formatMoney } from '@/lib/copy'
import { FundingChart } from './funding-chart'

/** NIH awards linked to conditions in the slice, and the conditions with none linked. */
export function FundingView() {
  const funding = useFunding()
  const { isLite, detail } = useRole()
  if (funding.isLoading) return <Pending label="Loading funding" lines={8} />
  if (funding.error || !funding.data) return <ErrorNote error={funding.error} />
  const { records, gaps } = funding.data
  const lite = isLite('funding')
  const technical = detail === 'technical'

  return (
    <div className="space-y-10">
      <Section title="Awards linked to these conditions" aside={`${records.length} from NIH RePORTER`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-label" data-testid="funding-table">
            <caption className="mb-2 text-left text-ink-3">
              A sample of awards retrieved from NIH RePORTER. Other funders are not covered yet.
            </caption>
            <thead className="text-ink-3">
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Project
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Funder
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Year
                </th>
                {!lite && (
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Award amount
                  </th>
                )}
                <th scope="col" className="py-2 pr-4 font-medium">
                  Conditions
                </th>
                {!lite && (
                  <th scope="col" className="py-2 font-medium">
                    Investigators
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.award.id} className="border-b border-line align-top">
                  <td className="py-2 pr-4">
                    <AppLink href={`/node/${r.award.id}`} className="text-ink hover:underline">
                      {r.award.name}
                    </AppLink>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-meta text-ink-3">
                      {r.organization && <span>{r.organization}</span>}
                      {technical && r.projectNumber && <Ident>{r.projectNumber}</Ident>}
                      {r.url && <ExternalLink href={r.url}>RePORTER</ExternalLink>}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-ink-2">
                    {r.funder}
                    {r.institute ? ` ${r.institute}` : ''}
                  </td>
                  <td className="py-2 pr-4 text-right text-ink-2">{r.fiscalYear ?? 'Not recorded'}</td>
                  {!lite && <td className="py-2 pr-4 text-right text-ink-2">{formatMoney(r.totalCost)}</td>}
                  <td className="py-2 pr-4 text-ink-2">{r.diseases.map((d) => d.name).join('; ')}</td>
                  {!lite && <td className="py-2 text-ink-2">{r.investigators.map((i) => i.name).join('; ')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!lite && <FundingChart records={records} />}
      </Section>

      {gaps.length > 0 && (
        <Section title="Conditions with no award linked" aside="Gaps in the sample, not proof of no funding">
          <ul className="space-y-2 text-ui">
            {gaps.map((g) => (
              <li key={g.disease.id}>
                <AppLink href={`/disease/${g.disease.id}`} className="link">
                  {g.disease.name}
                </AppLink>
                <span className="block text-label text-ink-3">{g.note}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
