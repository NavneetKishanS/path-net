'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Gate, Page, PageHeader, Pending, Section } from '@/components/layout/page'
import { AppLink, withRole } from '@/components/role/app-link'
import { useRole } from '@/components/role/role-provider'
import { useActionPlan, useDiseases } from '@/lib/queries'
import { summarise, tasksFor, useWorkflow, useWorkflowReady } from '@/lib/workflow'

/** The Action plan tab: opens the plan in use, or lists plans when there is none (or on request). */
export function PlansPage() {
  return (
    <Gate panel="action" what="The action plan">
      <Plans />
    </Gate>
  )
}

function Plans() {
  const ready = useWorkflowReady()
  const lastPlanId = useWorkflow((s) => s.lastPlanId)
  const plans = useWorkflow((s) => s.plans)
  const diseases = useDiseases()
  const router = useRouter()
  const { role } = useRole()
  const listAll = useSearchParams().get('view') === 'all'
  const redirect = ready && !listAll && !!lastPlanId

  useEffect(() => {
    if (redirect) router.replace(withRole(`/action/${lastPlanId}`, role))
  }, [redirect, lastPlanId, router, role])

  if (!ready || redirect || diseases.isLoading)
    return (
      <Page>
        <Pending label="Opening your action plan" lines={8} />
      </Page>
    )

  const started = [...new Set([...(lastPlanId ? [lastPlanId] : []), ...Object.keys(plans)])]
  const rest = (diseases.data ?? []).filter((d) => !started.includes(d.id))
  return (
    <Page>
      <PageHeader title="Action plans">
        Each condition has its own plan: the steps the atlas can justify from cited links, plus any you add. Pick up
        where you left off, or start a plan for another condition.
      </PageHeader>
      <div className="max-w-[760px] space-y-10">
        {started.length > 0 && (
          <Section title="Your plans" id="your-plans">
            <ul className="divide-y divide-line border-y border-line" data-testid="your-plans">
              {started.map((id) => (
                <PlanRow key={id} id={id} />
              ))}
            </ul>
          </Section>
        )}
        <Section title={started.length ? 'Start another plan' : 'Start a plan'} id="start-plan">
          <ul className="divide-y divide-line border-y border-line" data-testid="start-plan">
            {rest.map((d) => (
              <li key={d.id}>
                <AppLink
                  href={`/action/${d.id}`}
                  className="flex items-center justify-between gap-4 py-3 text-ui text-ink hover:text-accent-ink"
                >
                  <span>{d.name}</span>
                  <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                </AppLink>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </Page>
  )
}

function PlanRow({ id }: { id: string }) {
  const plan = useActionPlan(id)
  const progress = useWorkflow((s) => s.plans[id])
  if (!plan.data) return null
  const sum = summarise(tasksFor(plan.data, progress), progress)
  return (
    <li>
      <AppLink
        href={`/action/${id}`}
        className="grid gap-2 py-3 hover:text-accent-ink md:grid-cols-[minmax(0,1fr)_200px]"
      >
        <span className="text-ui font-medium text-ink">{plan.data.disease.name}</span>
        <span className="flex items-center gap-3 text-label text-ink-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden>
            <span className="block h-full bg-accent" style={{ width: `${Math.round(sum.share * 100)}%` }} />
          </span>
          {sum.done} of {sum.active} done
        </span>
      </AppLink>
    </li>
  )
}
