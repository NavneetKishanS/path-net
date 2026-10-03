'use client'

import type { RankedCluster } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { CitationMarker } from '@/components/evidence/citation'
import { ContradictsBadge } from '@/components/evidence/badges'
import { ClusterSwatch } from '@/components/atlas/node-bits'
import { isOpenStudy } from '@/lib/copy'

export const RANK_RULE =
  'Ranked by the number of conditions with cited evidence for the mechanism, then whether a registry or natural history study exists, then the number of patient groups, then the number of linked investigators. There is no composite score.'

export function RankedClusters({ items }: { items: RankedCluster[] }) {
  const { can } = useRole()
  if (items.length === 0)
    return <p className="text-ui text-ink-2">No cluster in the atlas has cited evidence for this mechanism.</p>
  return (
    <div>
      <p className="mb-4 max-w-[80ch] text-label text-ink-3">{RANK_RULE}</p>
      <ol className="space-y-6" data-testid="ranked-clusters">
        {items.map((r) => {
          const supporting = r.mechanismEdges.filter((e) => e.stance === 'supports')
          const registries = r.infrastructure.filter((a) => a.category === 'patient_data')
          const recruiting = r.studies.filter((s) => isOpenStudy(s.status))
          return (
            <li key={r.cluster.id} className="grid gap-4 border-t border-line pt-4 md:grid-cols-[40px_minmax(0,1fr)]">
              <span className="font-mono text-h3 text-ink-3" aria-label={`Rank ${r.rank}`}>
                {r.rank}
              </span>
              <div className="min-w-0 space-y-3">
                <div>
                  <h3 className="flex items-center gap-2 text-h3 text-ink">
                    <ClusterSwatch cluster={r.cluster} className="size-3" />
                    {r.cluster.label}
                  </h3>
                  <p className="mt-1 text-label text-ink-3">{r.cluster.scope}</p>
                </div>

                <dl className="grid gap-x-8 gap-y-3 text-ui sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Conditions with cited evidence" value={r.diseases.length}>
                    {r.diseases.map((d) => {
                      const e = supporting.find((x) => x.from === d.id)
                      return (
                        <span key={d.id} className="block">
                          <AppLink href={`/disease/${d.id}`} className="link">
                            {d.name}
                          </AppLink>{' '}
                          {e && <CitationMarker edge={e} />}
                        </span>
                      )
                    })}
                  </Stat>
                  <Stat label="Registries and natural history" value={registries.length}>
                    {registries.map((a) => (
                      <span key={a.node.id} className="block">
                        <AppLink href={`/node/${a.node.id}`} className="link">
                          {a.node.name}
                        </AppLink>{' '}
                        <CitationMarker edge={a.edge} />
                      </span>
                    ))}
                  </Stat>
                  <Stat label="Patient groups" value={r.groups.length}>
                    {r.groups.map((g) => (
                      <span key={g.id} className="block">
                        <AppLink href={`/node/${g.id}`} className="link">
                          {g.name}
                        </AppLink>
                      </span>
                    ))}
                  </Stat>
                  <Stat label={can('people') ? 'Linked investigators' : 'Investigators'} value={r.contacts.length}>
                    {r.contacts.slice(0, 4).map((c) => (
                      <span key={c.node.id} className="block">
                        <AppLink href={`/node/${c.node.id}`} className="link">
                          {c.node.name}
                        </AppLink>
                      </span>
                    ))}
                    {r.contacts.length > 4 && (
                      <span className="block text-label text-ink-3">and {r.contacts.length - 4} more</span>
                    )}
                  </Stat>
                </dl>

                <p className="text-label text-ink-2">
                  Studies: {r.studies.length} linked, {recruiting.length} open to enrolment.
                </p>

                {r.qualifiers.length > 0 && (
                  <div className="flex flex-wrap items-start gap-2">
                    <ContradictsBadge label="Limits" />
                    <span className="min-w-0 flex-1 text-label text-ink-2">
                      {r.qualifiers.map((q) => (
                        <span key={q.id} className="block">
                          {q.scope ?? 'Contradicting evidence.'} <CitationMarker edge={q} />
                        </span>
                      ))}
                    </span>
                  </div>
                )}

                {r.unmetNeeds.length > 0 && (
                  <div>
                    <p className="meta-label">Gaps in this cluster</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-label text-ink-2 marker:text-ink-3">
                      {r.unmetNeeds.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Stat({ label, value, children }: { label: string; value: number; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-ink-3">{label}</dt>
      <dd>
        <span className="font-mono text-body text-ink">{value}</span>
        <div className="mt-1 text-label">{children}</div>
      </dd>
    </div>
  )
}
