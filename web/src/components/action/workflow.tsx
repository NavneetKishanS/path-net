'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Check, Plus, RotateCcw, X } from 'lucide-react'
import type { ActionPlan } from '@/lib/model'
import { useRole } from '@/components/role/role-provider'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/copy'
import { useRoute } from '@/lib/queries'
import { cn } from '@/lib/cn'
import {
  statusOf,
  summarise,
  tasksFor,
  useWorkflow,
  type PlanProgress,
  type TaskGroup,
  type WorkflowTask,
} from '@/lib/workflow'
import { EdgeCitations, ExternalLink } from './action-parts'
import { DraftOutreach } from './draft-outreach'

const FILTERS = ['todo', 'done', 'closed', 'all'] as const
type Filter = (typeof FILTERS)[number]
const FILTER_LABEL: Record<Filter, string> = { todo: 'To do', done: 'Done', closed: 'Closed', all: 'All' }
const showParam = parseAsStringLiteral(FILTERS).withDefault('todo')

const GROUPS: { id: TaskGroup; title: string; plain: string }[] = [
  { id: 'week', title: 'This week', plain: 'This week' },
  { id: 'experiment', title: 'Ask researchers about', plain: 'Questions for researchers' },
  { id: 'own', title: 'Your own tasks', plain: 'Your own tasks' },
]

export function Workflow({ plan }: { plan: ActionPlan }) {
  const planId = plan.disease.id
  const progress = useWorkflow((s) => s.plans[planId])
  const [show, setShow] = useQueryState('show', showParam.withOptions({ history: 'replace' }))
  const [announce, setAnnounce] = useState('')
  const tasks = tasksFor(plan, progress)
  const sum = summarise(tasks, progress)
  const visible = (t: WorkflowTask) => show === 'all' || statusOf(progress, t.id).status === show

  return (
    <div data-testid="workflow">
      <Progress sum={sum} />

      <div role="group" aria-label="Show tasks" className="mt-5 flex flex-wrap gap-1" data-testid="workflow-filters">
        {FILTERS.map((f) => {
          const n = f === 'all' ? sum.total : sum[f]
          return (
            <button
              key={f}
              type="button"
              aria-pressed={show === f}
              onClick={() => void setShow(f)}
              className={cn(
                'rounded-sm border px-2.5 py-1 text-label',
                show === f
                  ? 'border-accent bg-accent text-paper'
                  : 'border-line text-ink-2 hover:border-line-strong hover:text-ink',
              )}
            >
              {FILTER_LABEL[f]} <span className="font-mono">{n}</span>
            </button>
          )
        })}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div className="mt-6 space-y-8">
        {GROUPS.map((g) => {
          const all = tasks.filter((t) => t.group === g.id)
          const list = all.filter(visible)
          if (g.id !== 'own' && all.length === 0) return null
          return (
            <section key={g.id} aria-labelledby={`group-${g.id}`}>
              <h2 id={`group-${g.id}`} className="mb-2 flex items-baseline gap-2 text-h3 text-ink">
                {g.title}
                <span className="font-mono text-label font-normal text-ink-3">
                  {all.filter((t) => statusOf(progress, t.id).status === 'done').length}/
                  {all.filter((t) => statusOf(progress, t.id).status !== 'closed').length}
                </span>
              </h2>
              {list.length > 0 ? (
                <ul className="divide-y divide-line border-y border-line">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} plan={plan} progress={progress} onChange={setAnnounce} />
                  ))}
                </ul>
              ) : (
                all.length > 0 && (
                  <p className="text-label text-ink-3">No {FILTER_LABEL[show].toLowerCase()} tasks here.</p>
                )
              )}
              {g.id === 'own' && <AddTask planId={planId} onAdd={setAnnounce} />}
            </section>
          )
        })}
      </div>

      <p className="mt-6 text-label text-ink-3">
        Progress and notes are saved in this browser only. They are not shared with your team yet.
      </p>
    </div>
  )
}

function Progress({ sum }: { sum: ReturnType<typeof summarise> }) {
  const pct = Math.round(sum.share * 100)
  return (
    <div data-testid="plan-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ui text-ink">
          <span className="font-semibold">
            {sum.done} of {sum.active}
          </span>{' '}
          tasks done
          {sum.closed > 0 && <span className="text-ink-2"> · {sum.closed} closed</span>}
        </p>
        <p className="text-label text-ink-3">
          {sum.todo === 0 && sum.active > 0 ? 'Nothing left to do' : `${sum.todo} to do`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Tasks done"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"
      >
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TaskRow({
  task,
  plan,
  progress,
  onChange,
}: {
  task: WorkflowTask
  plan: ActionPlan
  progress: PlanProgress | undefined
  onChange: (msg: string) => void
}) {
  const { detail } = useRole()
  const setStatus = useWorkflow((s) => s.setStatus)
  const state = statusOf(progress, task.id)
  const [closing, setClosing] = useState(false)
  const id = useId()
  const planId = plan.disease.id
  const done = state.status === 'done'
  const closed = state.status === 'closed'

  return (
    <li className="py-4" data-testid={`task-${task.id}`} data-status={state.status}>
      <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3">
        <div className="pt-0.5">
          {closed ? (
            <X className="size-4 text-ink-3" aria-hidden />
          ) : (
            <input
              id={id}
              type="checkbox"
              checked={done}
              onChange={(e) => {
                setStatus(planId, task.id, e.target.checked ? 'done' : 'todo')
                onChange(`${e.target.checked ? 'Marked done' : 'Marked to do'}: ${task.title}`)
              }}
              className="size-4 accent-[var(--accent)]"
            />
          )}
        </div>

        <div className="min-w-0">
          <label
            htmlFor={closed ? undefined : id}
            className={cn(
              'block text-[18px] leading-snug font-semibold',
              closed || done ? 'text-ink-3' : 'text-ink',
              done && 'line-through decoration-ink-3/60',
              !closed && 'cursor-pointer',
            )}
          >
            {task.title}
          </label>
          {task.detail && !closed && <p className="mt-1 max-w-[68ch] text-ui text-ink-2">{task.detail}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
            {task.group === 'own' ? (
              <span className="text-ink-3">Added by you</span>
            ) : (
              detail !== 'plain' && (
                <span className="inline-flex items-center gap-1.5 text-ink-3">
                  Based on <EdgeCitations ids={task.edgeIds} />
                </span>
              )
            )}
            {task.url && !closed && <ExternalLink href={task.url}>Public page</ExternalLink>}
            {done && (
              <span className="inline-flex items-center gap-1 text-ink-2">
                <Check className="size-3.5" aria-hidden />
                Done {formatDate(state.at)}
              </span>
            )}
          </div>

          {closed && (
            <p className="mt-2 border-l-2 border-line-strong pl-3 text-label text-ink-2" data-testid="close-note">
              <span className="text-ink-3">Closed {formatDate(state.at)}: </span>
              {state.note}
            </p>
          )}

          {task.outreach && !closed && detail !== 'plain' && <OutreachDraft plan={plan} />}

          {closing && (
            <CloseForm
              onCancel={() => setClosing(false)}
              onClose={(note) => {
                setStatus(planId, task.id, 'closed', note)
                setClosing(false)
                onChange(`Closed: ${task.title}`)
              }}
            />
          )}
        </div>

        <div className="flex items-start">
          {closed ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Restore: ${task.title}`}
              onClick={() => {
                setStatus(planId, task.id, 'todo')
                onChange(`Restored: ${task.title}`)
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Restore
            </Button>
          ) : (
            !done &&
            !closing && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Close task: ${task.title}`}
                onClick={() => setClosing(true)}
              >
                Close task
              </Button>
            )
          )}
        </div>
      </div>
    </li>
  )
}

function CloseForm({ onClose, onCancel }: { onClose: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState('')
  const id = useId()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (note.trim()) onClose(note.trim())
  }
  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="mt-3 rounded-sm border border-line bg-surface p-3"
      data-testid="close-form"
    >
      <label htmlFor={id} className="text-label font-medium text-ink">
        Why are you closing this task?
      </label>
      <p className="text-label text-ink-3">The note stays with the task, so you can see later why it was dropped.</p>
      <textarea
        id={id}
        autoFocus
        required
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-2 w-full resize-y rounded-sm border border-line-strong bg-paper px-3 py-2 text-ui text-ink"
      />
      <div className="mt-2 flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={!note.trim()}>
          Close task
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function OutreachDraft({ plan }: { plan: ActionPlan }) {
  const top = plan.viable[0]
  const route = useRoute(plan.disease.id, top?.disease.id ?? null)
  if (!top || !route.data) return null
  return (
    <details className="group mt-3" data-testid="outreach-details">
      <summary className="link cursor-pointer text-label">Draft message</summary>
      <div className="mt-3">
        <DraftOutreach plan={plan} route={route.data} />
      </div>
    </details>
  )
}

function AddTask({ planId, onAdd }: { planId: string; onAdd: (msg: string) => void }) {
  const addTask = useWorkflow((s) => s.addTask)
  const [title, setTitle] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    addTask(planId, t)
    setTitle('')
    onAdd(`Added: ${t}`)
    input.current?.focus()
  }
  return (
    <form onSubmit={submit} className="mt-3 flex gap-2" data-testid="add-task">
      <label htmlFor={id} className="sr-only">
        New task
      </label>
      <input
        id={id}
        ref={input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task, for example: book a call with the registry team"
        className="h-9 min-w-0 flex-1 rounded-sm border border-line-strong bg-paper px-3 text-ui text-ink placeholder:text-ink-3"
      />
      <Button type="submit" variant="secondary" disabled={!title.trim()}>
        <Plus className="size-4" aria-hidden />
        Add task
      </Button>
    </form>
  )
}
