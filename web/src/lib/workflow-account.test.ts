import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const saved = new Map<string, string>()
vi.stubGlobal('window', {})
vi.stubGlobal('localStorage', {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => saved.set(key, value),
  removeItem: (key: string) => saved.delete(key),
})
const { useWorkflow, setWorkflowAccount } = await import('./workflow')

beforeEach(() => {
  saved.clear()
  useWorkflow.persist.setOptions({ name: 'pathnet.workflow.v1' })
  useWorkflow.setState({ plans: {}, lastPlanId: null })
})
afterAll(() => vi.unstubAllGlobals())

describe('private action progress in a shared browser', () => {
  it('restores each account without copying private notes to another account or guest', async () => {
    useWorkflow.getState().setStatus('guest-plan', 'guest-task', 'done')
    await setWorkflowAccount('account-a')
    expect(useWorkflow.getState().plans).toEqual({})
    useWorkflow.getState().setStatus('plan-a', 'task-a', 'closed', 'Private note from A')

    await setWorkflowAccount('account-b')
    expect(useWorkflow.getState().plans).toEqual({})
    useWorkflow.getState().addTask('plan-b', 'Private task from B')

    await setWorkflowAccount('account-a')
    expect(useWorkflow.getState().plans['plan-a']?.tasks['task-a']?.note).toBe('Private note from A')
    expect(useWorkflow.getState().plans['plan-b']).toBeUndefined()

    await setWorkflowAccount(null)
    expect(useWorkflow.getState().plans['guest-plan']?.tasks['guest-task']?.status).toBe('done')
    expect(useWorkflow.getState().plans['plan-a']).toBeUndefined()
    expect(useWorkflow.getState().plans['plan-b']).toBeUndefined()

    await setWorkflowAccount('account-b')
    expect(useWorkflow.getState().plans['plan-b']?.custom[0]?.title).toBe('Private task from B')
    expect(useWorkflow.getState().plans['plan-a']).toBeUndefined()
  })

  it('does not overwrite previously saved progress while hydrating a different account', async () => {
    saved.set(
      'pathnet.workflow.v1:existing-account',
      JSON.stringify({
        state: {
          plans: { retained: { tasks: { done: { status: 'done', at: '2026-10-04' } }, custom: [] } },
          lastPlanId: 'retained',
        },
        version: 0,
      }),
    )
    await setWorkflowAccount('existing-account')
    expect(useWorkflow.getState().lastPlanId).toBe('retained')
    expect(useWorkflow.getState().plans.retained?.tasks.done?.status).toBe('done')
    await setWorkflowAccount('new-account')
    expect(useWorkflow.getState().lastPlanId).toBeNull()
    expect(saved.get('pathnet.workflow.v1:existing-account')).toContain('retained')
  })
})
