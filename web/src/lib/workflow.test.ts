import { beforeEach, describe, expect, it } from 'vitest'
import { createMockClient } from '@/lib/api/mock'
import { memoryOverrideStore } from '@/lib/api/atlas-client'
import { statusOf, summarise, tasksFor, useWorkflow } from './workflow'

const api = createMockClient(memoryOverrideStore())

beforeEach(() => useWorkflow.setState({ plans: {}, lastPlanId: null }))

describe('action plan workflow', () => {
  it('turns a plan into cited tasks, with the outreach draft on the write-to task', async () => {
    const plan = await api.getActionPlan('dis_scn8a')
    const tasks = tasksFor(plan)
    expect(tasks.map((t) => t.id)).toContain('write-partner')
    expect(tasks.find((t) => t.id === 'write-partner')?.outreach).toBe(true)
    for (const t of tasks) expect(t.edgeIds.length, t.title).toBeGreaterThan(0)
    expect(new Set(tasks.map((t) => t.group))).toEqual(new Set(['week', 'experiment']))
  })

  it('tracks done, closed with a note, and restored tasks', async () => {
    const plan = await api.getActionPlan('dis_scn8a')
    const { setStatus } = useWorkflow.getState()
    setStatus('dis_scn8a', 'write-partner', 'done')
    setStatus('dis_scn8a', 'read-registry', 'closed', 'Registry is SCN2A only; not useful for us yet')

    let progress = useWorkflow.getState().plans['dis_scn8a']
    expect(statusOf(progress, 'write-partner').status).toBe('done')
    expect(statusOf(progress, 'read-registry')).toMatchObject({ status: 'closed', note: /SCN2A only/ })

    const tasks = tasksFor(plan, progress)
    const sum = summarise(tasks, progress)
    expect(sum).toMatchObject({ done: 1, closed: 1, total: tasks.length, active: tasks.length - 1 })
    expect(sum.share).toBeCloseTo(1 / (tasks.length - 1))

    setStatus('dis_scn8a', 'read-registry', 'todo')
    progress = useWorkflow.getState().plans['dis_scn8a']
    expect(statusOf(progress, 'read-registry').status).toBe('todo')
    expect(progress?.tasks['read-registry']).toBeUndefined()
  })

  it('keeps tasks the user adds, per plan', async () => {
    const plan = await api.getActionPlan('dis_scn8a')
    useWorkflow.getState().addTask('dis_scn8a', 'Book a call with the registry team')
    const progress = useWorkflow.getState().plans['dis_scn8a']
    const own = tasksFor(plan, progress).filter((t) => t.group === 'own')
    expect(own).toHaveLength(1)
    expect(own[0]).toMatchObject({ title: 'Book a call with the registry team', edgeIds: [] })
    expect(useWorkflow.getState().plans['dis_stxbp1']).toBeUndefined()
  })
})
