import { useEffect, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ActionPlan } from './model'

export type TaskStatus = 'todo' | 'done' | 'closed'
export type TaskGroup = 'week' | 'experiment' | 'own'

export interface WorkflowTask {
  id: string
  group: TaskGroup
  title: string
  detail: string | null
  /** Cited edges the task rests on. Empty only for tasks the user added. */
  edgeIds: string[]
  url: string | null
  /** The task that the draft outreach message belongs to. */
  outreach: boolean
}

export interface TaskState {
  status: TaskStatus
  /** Why the task was closed. Required to close. */
  note?: string
  /** ISO time of the last status change. */
  at: string
}

export interface CustomTask {
  id: string
  title: string
  createdAt: string
}

export interface PlanProgress {
  tasks: Record<string, TaskState>
  custom: CustomTask[]
}

const EMPTY: PlanProgress = { tasks: {}, custom: [] }

/** Tasks for a plan: this week's steps, then experiments, then the user's own. */
export function tasksFor(plan: ActionPlan, progress: PlanProgress = EMPTY): WorkflowTask[] {
  return [
    ...plan.doThisWeek.map((a) => ({
      id: a.id,
      group: 'week' as const,
      title: a.title,
      detail: a.detail,
      edgeIds: a.edgeIds,
      url: a.url,
      outreach: a.id === 'write-partner',
    })),
    ...plan.nextExperiments.map((a) => ({
      id: a.id,
      group: 'experiment' as const,
      title: a.title,
      detail: a.detail,
      edgeIds: a.edgeIds,
      url: a.url,
      outreach: false,
    })),
    ...progress.custom.map((c) => ({
      id: c.id,
      group: 'own' as const,
      title: c.title,
      detail: null,
      edgeIds: [],
      url: null,
      outreach: false,
    })),
  ]
}

export function statusOf(progress: PlanProgress | undefined, taskId: string): TaskState {
  return progress?.tasks[taskId] ?? { status: 'todo', at: '' }
}

export function summarise(tasks: WorkflowTask[], progress: PlanProgress | undefined) {
  const count = { todo: 0, done: 0, closed: 0 }
  for (const t of tasks) count[statusOf(progress, t.id).status]++
  // Closed tasks are out of scope, so progress is done out of what is still wanted.
  const active = count.todo + count.done
  return { ...count, total: tasks.length, active, share: active ? count.done / active : 0 }
}

interface WorkflowStore {
  plans: Record<string, PlanProgress>
  lastPlanId: string | null
  setStatus: (planId: string, taskId: string, status: TaskStatus, note?: string) => void
  addTask: (planId: string, title: string) => void
  setLastPlan: (planId: string) => void
}

const now = () => new Date().toISOString()
let changingScope = false

export const useWorkflow = create<WorkflowStore>()(
  persist(
    (set) => ({
      plans: {},
      lastPlanId: null,
      setStatus: (planId, taskId, status, note) =>
        set((s) => {
          const plan = s.plans[planId] ?? EMPTY
          const tasks = { ...plan.tasks }
          if (status === 'todo') delete tasks[taskId]
          else tasks[taskId] = { status, at: now(), ...(note ? { note } : {}) }
          return { plans: { ...s.plans, [planId]: { ...plan, tasks } } }
        }),
      addTask: (planId, title) =>
        set((s) => {
          const plan = s.plans[planId] ?? EMPTY
          const task = { id: `own-${Date.now().toString(36)}`, title, createdAt: now() }
          return { plans: { ...s.plans, [planId]: { ...plan, custom: [...plan.custom, task] } } }
        }),
      setLastPlan: (planId) => set({ lastPlanId: planId }),
    }),
    // Rehydrated after mount so server and first client render agree.
    {
      name: 'pathnet.workflow.v1',
      skipHydration: true,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') throw new Error('Browser storage is unavailable on the server.')
        return {
          getItem: (name) => localStorage.getItem(name),
          setItem: (name, value) => {
            if (!changingScope) localStorage.setItem(name, value)
          },
          removeItem: (name) => localStorage.removeItem(name),
        }
      }),
    },
  ),
)

/** Keep private task notes apart when people share a browser; retain the original guest store. */
export async function setWorkflowAccount(userId: string | null): Promise<void> {
  const name = userId ? `pathnet.workflow.v1:${userId}` : 'pathnet.workflow.v1'
  if (useWorkflow.persist.getOptions().name === name) return
  changingScope = true
  try {
    useWorkflow.persist.setOptions({ name })
    useWorkflow.setState({ plans: {}, lastPlanId: null })
    await useWorkflow.persist.rehydrate()
  } finally {
    changingScope = false
  }
}

/** Loads saved progress from this browser once, and reports when it is ready. */
export function useWorkflowReady(): boolean {
  useEffect(() => {
    if (!useWorkflow.persist.hasHydrated()) void useWorkflow.persist.rehydrate()
  }, [])
  return useSyncExternalStore(
    (cb) => useWorkflow.persist.onFinishHydration(cb),
    () => useWorkflow.persist.hasHydrated(),
    // No browser storage on the server, so `persist` is absent there.
    () => false,
  )
}
