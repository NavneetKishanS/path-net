'use client'

import { useEffect } from 'react'
import type { ActionPlan, Connection } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { ErrorNote, Page, PageHeader, Pending, Section } from '@/components/layout/page'
import { NoRouteState } from '@/components/atlas/no-route'
import { CitationMarker } from '@/components/evidence/citation'
import { ContradictsBadge, SupportedBadge } from '@/components/evidence/badges'
import { useActionPlan, useCoverage } from '@/lib/queries'
import { useWorkflow, useWorkflowReady } from '@/lib/workflow'
import { AssetList, DuplicateCallout, ExternalLink, PartnerList, StudyList } from './action-parts'
import { Workflow } from './workflow'

export function ActionView({ diseaseId }: { diseaseId: string }) {
  const plan = useActionPlan(diseaseId)
  const ready = useWorkflowReady()
  const setLastPlan = useWorkflow((s) => s.setLastPlan)
  const { detail, can } = useRole()
  const found = !!plan.data
  useEffect(() => {
    if (ready && found) setLastPlan(diseaseId)
  }, [ready, found, diseaseId, setLastPlan])

  if (plan.isLoading || !ready)
    return (
      <Page>
        <Pending label="Building the action plan" lines={12} />
      </Page>
    )
  if (plan.error || !plan.data)
    return (
      <Page>
        <ErrorNote error={plan.error ?? 'Condition not found'} />
      </Page>
    )
  const p = plan.data
  const plain = detail === 'plain'
  return (
    <Page>
      <PageHeader
        kicker={
          <AppLink href={`/disease/${p.disease.id}`} className="hover:text-ink hover:underline">
            {p.disease.name}
          </AppLink>
        }
        title={plain ? 'What you can do next' : 'Action plan'}
        actions={
          <AppLink href="/action?view=all" className="link text-label" data-testid="all-plans">
            All plans
          </AppLink>
        }
      >
        {plain
          ? 'Tick off each step when it is done. Close the ones that do not fit, with a short note.'
          : 'Steps that follow from cited links. Mark them done as you go, or close the ones that do not fit with a note.'}
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">{can('nextStep') && <Workflow plan={p} />}</div>

        <aside className="min-w-0 space-y-10" aria-label="People to work with">
          {p.ownCommunities.length > 0 && (
            <Section title={plain ? 'Your community' : 'Your own community'} id="own">
              <ul className="space-y-2">
                {p.ownCommunities.map((c) => (
                  <li key={c.group.id} className="text-ui">
                    <AppLink href={`/node/${c.group.id}`} className="link">
                      {c.group.name}
                    </AppLink>{' '}
                    {!plain && <CitationMarker edge={c.edge} />}
                    {c.viaParent && <p className="text-label text-ink-3">Serves all of {c.viaParent.name}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {can('people') && p.partners.length > 0 && (
            <Section title="Researchers linked here" id="partners">
              <PartnerList people={p.partners} />
            </Section>
          )}
        </aside>
      </div>

      <div className="mt-14" data-testid="plan-background">
        <h2 className="text-h2 text-ink">{plain ? 'Why these steps' : 'Background for these tasks'}</h2>
        <p className="mt-2 max-w-[68ch] text-ui text-ink-2">
          {plain
            ? 'What the atlas found, and what it could not support.'
            : 'The cited connections, resources and limits the tasks above come from.'}
        </p>
        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">
            {p.viable.length > 0 && (
              <Section
                title={
                  plain ? 'Communities you could work with' : 'Who to work with: shared mechanism, every step cited'
                }
                id="viable"
              >
                <ConnectionBrief items={p.viable} fromId={p.disease.id} />
              </Section>
            )}

            {p.noRoute && <NoRouteBlock plan={p} />}

            {can('assets') && (
              <Section
                title="Shared resources"
                id="assets"
                aside={plain ? undefined : 'Registries, samples and funded projects'}
              >
                <div className="space-y-6">
                  <DuplicateCallout signals={p.duplicates} />
                  <AssetList assets={p.assets} />
                </div>
              </Section>
            )}

            <Section title={plain ? 'Studies' : 'Clinical studies'} id="studies">
              <StudyList studies={plain ? p.studies.filter((s) => s.status === 'RECRUITING') : p.studies} />
            </Section>
          </div>

          <div className="min-w-0 space-y-10">
            {!plain && p.network.length > 0 && (
              <Section title="Shared people, not shared biology" id="network">
                <ConnectionBrief items={p.network} fromId={p.disease.id} />
              </Section>
            )}
            {!plain && p.unsupported.length > 0 && (
              <Section title="Not supported as a route" id="unsupported">
                <ul className="space-y-3">
                  {p.unsupported.map((c) => (
                    <li key={c.disease.id} className="text-ui">
                      <AppLink href={`/disease/${c.disease.id}`} className="font-medium text-ink hover:underline">
                        {c.disease.name}
                      </AppLink>
                      <p className="text-label text-ink-2">{whyNot(c)}</p>
                      {c.qualifiers.length > 0 && (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5">
                          <ContradictsBadge />
                          {c.qualifiers.map((q) => (
                            <CitationMarker key={q.id} edge={q} />
                          ))}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}

function whyNot(c: Connection): string {
  if (c.qualifiers.some((q) => q.from === c.disease.id))
    return 'Cited evidence argues against a uniform shared mechanism for this condition as a whole.'
  if (c.kind === 'phenotype') return 'Only common symptoms are shared. That is not evidence of shared biology.'
  if (c.kind === 'mechanism' && !c.supported) return 'At least one step lacks observed, supporting evidence.'
  return c.reason
}

function ConnectionBrief({ items, fromId }: { items: Connection[]; fromId: string }) {
  const { detail } = useRole()
  return (
    <ul className="space-y-4">
      {items.map((c) => (
        <li key={c.disease.id}>
          <div className="flex flex-wrap items-center gap-2">
            <AppLink
              href={`/disease/${c.disease.id}`}
              className="font-serif text-[17px] font-semibold text-ink hover:underline"
            >
              {c.disease.name}
            </AppLink>
            {c.supported && detail !== 'plain' && <SupportedBadge>Every step cited</SupportedBadge>}
          </div>
          <p className="mt-0.5 text-ui text-ink-2">
            {c.reason} {c.inferredEdge && detail !== 'plain' && <CitationMarker edge={c.inferredEdge} />}
          </p>
          {c.communities.length > 0 && (
            <p className="mt-1 text-label text-ink-2">
              {c.communities.map((k, i) => (
                <span key={k.group.id}>
                  {i > 0 && ', '}
                  <AppLink href={`/node/${k.group.id}`} className="link">
                    {k.group.name}
                  </AppLink>
                  {k.viaParent && <span className="text-ink-3"> (via {k.viaParent.name})</span>}
                </span>
              ))}
            </p>
          )}
          {c.kind !== 'phenotype' && (
            <AppLink href={`/route?from=${fromId}&to=${c.disease.id}`} className="link mt-1 inline-block text-label">
              Why connected
            </AppLink>
          )}
        </li>
      ))}
    </ul>
  )
}

function NoRouteBlock({ plan }: { plan: ActionPlan }) {
  const coverage = useCoverage()
  const own = plan.ownCommunities[0]
  if (!plan.noRoute || !coverage.data) return null
  return (
    <div className="space-y-4">
      <NoRouteState noRoute={plan.noRoute} coverage={coverage.data} />
      {own && typeof own.group.props.url === 'string' && (
        <p className="text-ui text-ink-2">
          Meanwhile, your own community is the strongest link:{' '}
          <ExternalLink href={own.group.props.url}>{own.group.name}</ExternalLink>
        </p>
      )}
    </div>
  )
}
