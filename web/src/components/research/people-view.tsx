'use client'

import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { ErrorNote, Pending, Section } from '@/components/layout/page'
import { EdgeCitations, ExternalLink, PartnerList } from '@/components/action/action-parts'
import { usePeople } from '@/lib/queries'

/** Key investigators. People linked to conditions in more than one mechanism cluster come first. */
export function PeopleView() {
  const people = usePeople()
  const { isLite, detail } = useRole()
  if (people.isLoading) return <Pending label="Loading investigators" lines={8} />
  if (people.error) return <ErrorNote error={people.error} />
  const all = people.data ?? []
  const shared = all.filter((p) => p.sharedAcrossClusters)
  const rest = all.filter((p) => !p.sharedAcrossClusters)

  if (isLite('people')) {
    return (
      <div className="space-y-10">
        <Section title="Shared across mechanism clusters" aside={`${shared.length}`}>
          <PartnerList people={shared} compact />
        </Section>
        <Section title="Everyone linked in this atlas" aside={`${all.length}`}>
          <PartnerList people={rest} compact />
        </Section>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <Section title="Shared across mechanism clusters" aside={`${shared.length} people`}>
        <PartnerList people={shared} />
      </Section>
      <Section title="All investigators" aside={`${all.length} people`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-label" data-testid="people-table">
            <caption className="mb-2 text-left text-ink-3">
              Principal investigators listed on NIH awards linked to conditions in this atlas. Contact details are not
              stored.
            </caption>
            <thead className="text-ink-3">
              <tr className="border-b border-line-strong">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Name
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Organization
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Conditions
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Awards
                </th>
                <th scope="col" className="py-2 font-medium">
                  Evidence
                </th>
              </tr>
            </thead>
            <tbody>
              {all.map((p) => (
                <tr key={p.node.id} className="border-b border-line align-top">
                  <td className="py-2 pr-4">
                    <AppLink href={`/node/${p.node.id}`} className="text-ink hover:underline">
                      {p.node.name}
                    </AppLink>
                    {p.sharedAcrossClusters && (
                      <span className="block text-meta text-accent-ink">Works across mechanisms</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-ink-2">{p.organization ?? 'Not recorded'}</td>
                  <td className="py-2 pr-4 text-ink-2">{p.diseases.map((d) => d.name).join('; ')}</td>
                  <td className="py-2 pr-4">
                    {p.awards.map((a) => (
                      <AppLink key={a.id} href={`/node/${a.id}`} className="link block">
                        {a.name}
                      </AppLink>
                    ))}
                  </td>
                  <td className="py-2">
                    <EdgeCitations ids={p.edges.map((e) => e.id)} max={detail === 'technical' ? 6 : 2} />
                    {p.profileUrl && (
                      <span className="mt-1 block">
                        <ExternalLink href={p.profileUrl}>RePORTER</ExternalLink>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
