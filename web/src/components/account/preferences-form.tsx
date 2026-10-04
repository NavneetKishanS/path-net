'use client'

import { useId, useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { useGraph } from '@/lib/queries'
import { canAccess, isLite, ROLE_CONFIG, type PanelId } from '@/lib/roles'
import type { AccountProfile } from '@/lib/account'
import { cn } from '@/lib/cn'

export const ACCOUNT_INPUT =
  'w-full rounded-sm border border-line-strong bg-paper px-3 py-2 text-ui text-ink disabled:bg-surface disabled:text-ink-3'

const LANDINGS: { value: AccountProfile['landing']; label: string; panel?: PanelId; full?: boolean }[] = [
  { value: '/', label: 'My role home' },
  { value: '/explore', label: 'Explore the map', panel: 'graph' },
  { value: '/action', label: 'Action plans', panel: 'action', full: true },
  { value: '/mechanisms', label: 'Mechanism rankings', panel: 'mechanismRanking' },
  { value: '/people', label: 'People and collaborators', panel: 'people' },
]

/** These are existing atlas views, filtered by the selected presentation role. */
export function profileLandings(profile: AccountProfile) {
  const config = ROLE_CONFIG[profile.role]
  return LANDINGS.filter(
    (item) => !item.panel || (canAccess(config, item.panel) && !(item.full && isLite(config, item.panel))),
  )
}

export function PreferencesForm({
  value,
  onChange,
  disabled = false,
}: {
  value: AccountProfile
  onChange: (profile: AccountProfile) => void
  disabled?: boolean
}) {
  const id = useId()
  const graph = useGraph()
  const [query, setQuery] = useState('')
  const choices = useMemo(
    () => (graph.data?.nodes ?? []).filter((node) => ['disease', 'gene', 'mechanism'].includes(node.type)),
    [graph.data],
  )
  const search = query.trim().toLowerCase()
  const matches = choices
    .filter(
      (node) =>
        !value.interests.includes(node.id) &&
        (!search || [node.name, ...node.synonyms].some((name) => name.toLowerCase().includes(search))),
    )
    .slice(0, 6)
  const selected = value.interests.map((nodeId) => ({
    id: nodeId,
    name: choices.find((node) => node.id === nodeId)?.name ?? nodeId,
  }))
  const update = (patch: Partial<AccountProfile>) => onChange({ ...value, ...patch })
  const assistantAvailable = ROLE_CONFIG[value.role].assistant

  return (
    <div className="space-y-6">
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="mb-1 text-ui font-semibold text-ink">How would you like to read?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ['plain', 'Simple language', 'Short explanations, with scientific terms explained.'],
              ['standard', 'Standard', 'A clear overview with research detail when needed.'],
              ['technical', 'Academic language', 'Mechanisms, evidence tiers and technical detail.'],
            ] as const
          ).map(([detail, label, description]) => (
            <label
              key={detail}
              className={cn(
                'relative flex cursor-pointer gap-2 rounded-sm border p-3',
                value.detail === detail ? 'border-accent bg-band' : 'border-line bg-paper hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                name={`${id}-detail`}
                value={detail}
                checked={value.detail === detail}
                onChange={() => update({ detail })}
                className="mt-1 shrink-0"
              />
              <span>
                <span className="block text-label font-semibold">{label}</span>
                <span className="mt-1 block text-meta text-ink-2">{description}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-meta text-ink-3">
          Original source names, citations and uncertainty stay available in every mode.
        </p>
      </fieldset>

      <fieldset disabled={disabled} className="space-y-3">
        <legend className="mb-1 text-ui font-semibold text-ink">
          What would you like to follow? <span className="font-normal text-ink-3">Optional</span>
        </legend>
        <p id={`${id}-interest-help`} className="text-label text-ink-2">
          Follow up to 20 diseases, genes or mechanisms in this atlas. An interest is not a diagnosis.
        </p>
        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Selected interests">
            {selected.map((node) => (
              <li
                key={node.id}
                className="inline-flex max-w-full items-center gap-2 rounded-sm border border-accent bg-band py-1 pr-1 pl-2 text-label text-accent-ink"
              >
                <span className="break-words">{node.name}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => update({ interests: value.interests.filter((nodeId) => nodeId !== node.id) })}
                  className="shrink-0 rounded-sm p-1 hover:bg-paper"
                  aria-label={`Remove ${node.name}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-ink-3" aria-hidden />
          <input
            id={`${id}-interests`}
            aria-label="Search interests"
            aria-describedby={`${id}-interest-help`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a disease, gene or mechanism"
            className={cn(ACCOUNT_INPUT, 'pl-9')}
          />
        </div>
        {graph.isLoading ? (
          <p className="text-label text-ink-3" role="status">
            Loading atlas topics…
          </p>
        ) : graph.isError ? (
          <p className="text-label text-ink-3">Topics could not be loaded. You can add interests later.</p>
        ) : matches.length ? (
          <ul className="divide-y divide-line rounded-sm border border-line" aria-label="Available interests">
            {matches.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  disabled={disabled || value.interests.length >= 20}
                  onClick={() => {
                    update({ interests: [...value.interests, node.id] })
                    setQuery('')
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface disabled:cursor-default disabled:opacity-50"
                >
                  <span className="min-w-0 text-label text-ink">
                    {node.name}
                    <span className="ml-2 text-meta text-ink-3">{node.type}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-meta text-accent-ink">
                    <Check className="size-3.5" aria-hidden />
                    Follow
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-label text-ink-3">
            {search ? 'No matching topic in the current atlas.' : 'All available topics are already selected.'}
          </p>
        )}
      </fieldset>

      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-ui font-semibold text-ink">Make this workspace yours</legend>
        <label htmlFor={`${id}-landing`} className="space-y-1.5 text-label font-medium">
          Start page
          <select
            id={`${id}-landing`}
            value={value.landing}
            onChange={(event) => update({ landing: event.target.value as AccountProfile['landing'] })}
            className={ACCOUNT_INPUT}
          >
            {profileLandings(value).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-theme`} className="space-y-1.5 text-label font-medium">
          Appearance
          <select
            id={`${id}-theme`}
            value={value.theme}
            onChange={(event) => update({ theme: event.target.value as AccountProfile['theme'] })}
            className={ACCOUNT_INPUT}
          >
            <option value="system">Use device setting</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        {canAccess(ROLE_CONFIG[value.role], 'graph') && (
          <label htmlFor={`${id}-graph`} className="space-y-1.5 text-label font-medium">
            Map view
            <select
              id={`${id}-graph`}
              value={value.graphView}
              onChange={(event) => update({ graphView: event.target.value as AccountProfile['graphView'] })}
              className={ACCOUNT_INPUT}
            >
              <option value="graph">Interactive graph</option>
              <option value="table">Accessible table</option>
            </select>
          </label>
        )}
        {assistantAvailable && (
          <label className="flex items-start gap-2 self-end rounded-sm border border-line bg-surface p-3 text-label">
            <input
              type="checkbox"
              checked={value.showAssistant}
              onChange={(event) => update({ showAssistant: event.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Show Ask the atlas</span>
              <span className="block text-meta text-ink-2">Keep the existing evidence assistant at hand.</span>
            </span>
          </label>
        )}
      </fieldset>
    </div>
  )
}
