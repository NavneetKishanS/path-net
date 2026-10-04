'use client'

import { ArrowRight } from 'lucide-react'
import type { NodeDetail } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { ErrorNote, Pending, Section } from '@/components/layout/page'
import { CitationMarker } from '@/components/evidence/citation'
import { ContradictsBadge } from '@/components/evidence/badges'
import { DoThisWeek } from '@/components/action/action-parts'
import { useActionPlan, useConnections, useCoverage, useGraph, useNode } from '@/lib/queries'
import { statusOf, summarise, tasksFor, useWorkflow, useWorkflowReady } from '@/lib/workflow'
import type { ActionPlan } from '@/lib/model'
import { EFFECT_LABEL, effectOf } from '@/lib/copy'
import { plainNodeLabel } from '@/lib/plain-language'
import { cn } from '@/lib/cn'
import { ConnectionList } from './connection-list'
import { NoRouteState } from './no-route'
import { ClusterTag, ExternalIds, Ident, TypeLabel } from './node-bits'
import { MiniMap } from '@/components/graph/mini-map'

/** Condition page: what it is, how it is caused, who serves it, what it connects to, what to do. */
export function DiseaseOverview({ id, note }: { id: string; note?: React.ReactNode }) {
  const detail = useNode(id)
  if (detail.isLoading) return <Pending label="Loading condition" lines={8} />
  if (detail.error || !detail.data) return <ErrorNote error={detail.error ?? `No condition with id ${id}`} />
  return <Overview d={detail.data} note={note} />
}

function Overview({ d, note }: { d: NodeDetail; note?: React.ReactNode }) {
  const { can, detail, role } = useRole()
  const graph = useGraph()
  const conns = useConnections(d.node.id)
  const plan = useActionPlan(can('nextStep') ? d.node.id : null)
  const coverage = useCoverage()
  const node = d.node
  const plain = detail === 'plain'
  const clusters = (graph.data?.clusters ?? []).filter((c) => node.clusters.includes(c.id))
  const mech = d.edges.filter((e) => e.relation === 'disease_mechanism' && e.from === node.id)
  const gene = d.edges.find((e) => e.relation === 'disease_gene' && e.from === node.id)
  const parent = d.edges.find((e) => e.relation === 'subgroup_of' && e.from === node.id)
  const phen = d.edges.filter((e) => e.relation === 'disease_phenotype' && e.from === node.id)
  const groups = d.edges.filter((e) => e.relation === 'group_disease' && e.to === node.id)
  const nb = (nid: string) => d.neighbours.find((n) => n.id === nid)
  const progress = useWorkflow((s) => s.plans[node.id])
  const workflowReady = useWorkflowReady()
  // Render in one pass so sections do not push each other down as their queries resolve.
  if (conns.isLoading || plan.isLoading || !workflowReady) return <Pending label="Loading condition" lines={8} />
  const routable = (conns.data ?? []).filter((c) => c.kind !== 'phenotype')
  return (
    <div className="space-y-10">
      <header className="title-band -mt-8 pt-8 pb-8 md:-mt-10 md:pt-10">
        {note}
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <TypeLabel node={node} />
          {clusters.map((c) => (
            <ClusterTag key={c.id} cluster={c} />
          ))}
        </div>
        <h1 className="text-h2 text-ink md:text-h1" data-testid="disease-title">
          {node.name}
        </h1>
        {node.synonyms.length > 0 && (
          <p className="mt-2 text-ui text-ink-2">
            <span className="text-ink-3">Also known as </span>
            {node.synonyms.slice(0, plain ? 2 : 5).join('; ')}
          </p>
        )}
        <div className="mt-4 grid gap-x-10 gap-y-3 text-ui md:grid-cols-[auto_auto_1fr]">
          {gene && nb(gene.to) && (
            <Fact label={plain ? 'Gene' : 'Caused by variants in'}>
              <AppLink href={`/node/${gene.to}`} className="link">
                <Ident>{nb(gene.to)!.name}</Ident>
              </AppLink>{' '}
              <CitationMarker edge={gene} />
            </Fact>
          )}
          {parent && nb(parent.to) && (
            <Fact label="Part of">
              <AppLink href={`/disease/${parent.to}`} className="link">
                {nb(parent.to)!.name}
              </AppLink>{' '}
              <CitationMarker edge={parent} />
            </Fact>
          )}
          {mech.length > 0 && (
            <Fact label={plain ? 'What goes wrong' : 'Mechanism'}>
              <ul className="space-y-1">
                {mech.map((e) => {
                  const m = nb(e.to)
                  if (!m) return null
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-1.5">
                      {e.stance === 'contradicts' && <ContradictsBadge label="Evidence against" />}
                      <AppLink
                        href={`/node/${m.id}`}
                        className={cn('link', e.stance === 'contradicts' && 'text-ink-2')}
                      >
                        {plain ? plainNodeLabel(m) : m.name}
                      </AppLink>
                      {!plain && detail === 'technical' && (
                        <span className="text-label text-ink-3">({EFFECT_LABEL[effectOf(m)]})</span>
                      )}
                      <CitationMarker edge={e} />
                    </li>
                  )
                })}
              </ul>
            </Fact>
          )}
        </div>
        {!plain && (
          <div className="mt-4">
            <ExternalIds node={node} />
          </div>
        )}
      </header>

      {can('community') && (
        <Section title={plain ? 'Families and groups for this condition' : 'Patient community'} id="community">
          {groups.length > 0 ? (
            <ul className="space-y-1.5">
              {groups.map((g) => (
                <li key={g.id} className="text-ui">
                  <AppLink href={`/node/${g.from}`} className="link">
                    {nb(g.from)?.name}
                  </AppLink>{' '}
                  <CitationMarker edge={g} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="max-w-[68ch] text-ui text-ink-2" data-testid="no-own-group">
              No patient organization is linked to {node.name} in this atlas.
              {parent && nb(parent.to)
                ? ` Groups for ${nb(parent.to)!.name} may serve these families; see the connections below.`
                : ''}
            </p>
          )}
        </Section>
      )}

      {can('nextStep') && plan.data && plan.data.doThisWeek.length > 0 && (
        <Section
          title="Do this week"
          id="dtw"
          aside={
            can('action') ? (
              <span className="inline-flex items-center gap-3">
                {progress && <PlanProgressNote plan={plan.data} />}
                <AppLink
                  href={`/action/${node.id}`}
                  className="link inline-flex items-center gap-1"
                  data-testid="open-action"
                >
                  Open the action plan <ArrowRight className="size-3.5" aria-hidden />
                </AppLink>
              </span>
            ) : undefined
          }
        >
          <DoThisWeek
            items={plan.data.doThisWeek.slice(0, 3)}
            doneIds={plan.data.doThisWeek.map((a) => a.id).filter((t) => statusOf(progress, t).status === 'done')}
            hiddenIds={plan.data.doThisWeek.map((a) => a.id).filter((t) => statusOf(progress, t).status === 'closed')}
          />
        </Section>
      )}

      <div className={cn('grid gap-10', can('graph') && 'xl:grid-cols-[minmax(0,1fr)_420px]')}>
        <Section title={plain ? 'Related conditions' : 'Closest connections'} id="connections">
          {conns.isLoading ? (
            <Pending label="Finding connections" />
          ) : routable.length > 0 ? (
            <ConnectionList fromId={node.id} connections={conns.data ?? []} />
          ) : coverage.data ? (
            <NoRouteFor id={node.id} />
          ) : null}
        </Section>
        {can('graph') && (
          <Section
            title="Map"
            id="map"
            aside={
              <AppLink className="link" href={`/explore?node=${node.id}`}>
                Open full map
              </AppLink>
            }
          >
            <MiniMap focusId={node.id} />
          </Section>
        )}
      </div>

      {phen.length > 0 && (role !== 'patient' || !plain) && (
        <Section title="Recorded symptoms" id="symptoms" aside={`${phen.length} recorded features`}>
          <ul className="grid gap-x-8 gap-y-1.5 text-ui sm:grid-cols-2 lg:grid-cols-3">
            {phen.slice(0, detail === 'technical' ? undefined : 12).map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-2 border-b border-line py-1">
                <span className="text-ink-2">{nb(e.to) && plain ? plainNodeLabel(nb(e.to)!) : nb(e.to)?.name}</span>
                <CitationMarker edge={e} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="meta-label">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

function PlanProgressNote({ plan }: { plan: ActionPlan }) {
  const progress = useWorkflow((s) => s.plans[plan.disease.id])
  const sum = summarise(tasksFor(plan, progress), progress)
  return (
    <span className="text-ink-3" data-testid="plan-progress-note">
      {sum.done} of {sum.active} done
    </span>
  )
}

function NoRouteFor({ id }: { id: string }) {
  const plan = useActionPlan(id)
  const coverage = useCoverage()
  if (!plan.data?.noRoute || !coverage.data) return <Pending />
  return <NoRouteState noRoute={plan.data.noRoute} coverage={coverage.data} />
}
