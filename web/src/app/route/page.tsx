'use client'

import { useQueryState } from 'nuqs'
import { ArrowRight } from 'lucide-react'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { ErrorNote, Gate, Page, PageHeader, Pending } from '@/components/layout/page'
import { RouteExplainer } from '@/components/atlas/route-explainer'
import { NoRouteState } from '@/components/atlas/no-route'
import { useActionPlan, useCoverage, useNode, useRoute } from '@/lib/queries'

export default function RoutePage() {
  return (
    <Gate panel="explain" what="The explanation of a connection">
      <RouteView />
    </Gate>
  )
}

function RouteView() {
  const [from] = useQueryState('from')
  const [to] = useQueryState('to')
  const { detail, can } = useRole()
  const route = useRoute(from, to)
  const a = useNode(from)
  const b = useNode(to)
  const plain = detail === 'plain'

  if (!from || !to)
    return (
      <Page>
        <ErrorNote error="Pick two conditions to compare." />
      </Page>
    )
  if (route.isLoading || a.isLoading || b.isLoading)
    return (
      <Page>
        <Pending label="Tracing the connection" lines={8} />
      </Page>
    )
  if (route.error)
    return (
      <Page>
        <ErrorNote error={route.error} />
      </Page>
    )
  const fromName = a.data?.node.name ?? from
  const toName = b.data?.node.name ?? to

  return (
    <Page>
      <PageHeader
        kicker={
          <AppLink href={`/disease/${from}`} className="hover:text-ink hover:underline">
            {fromName}
          </AppLink>
        }
        title={plain ? `How ${fromName} and ${toName} may be related` : `Why ${fromName} connects to ${toName}`}
        actions={
          can('action') && route.data ? (
            <AppLink
              href={`/action/${from}`}
              className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-2 text-label font-medium text-paper hover:bg-accent-ink"
              data-testid="to-action"
            >
              {plain ? 'What I can do' : 'Turn this into an action plan'}
              <ArrowRight className="size-3.5" aria-hidden />
            </AppLink>
          ) : undefined
        }
      >
        {plain
          ? 'Each step below comes from a source you can open.'
          : 'Each step is one link in the atlas with its own source. Select a step to read its evidence.'}
      </PageHeader>
      {route.data ? <RouteExplainer route={route.data} /> : <NoRouteFor from={from} />}
    </Page>
  )
}

function NoRouteFor({ from }: { from: string }) {
  const plan = useActionPlan(from)
  const coverage = useCoverage()
  if (!coverage.data || plan.isLoading) return <Pending />
  return plan.data?.noRoute ? (
    <NoRouteState noRoute={plan.data.noRoute} coverage={coverage.data} />
  ) : (
    <p className="text-ui text-ink-2">
      These two conditions are not linked through a shared mechanism or investigator in the atlas.
    </p>
  )
}
