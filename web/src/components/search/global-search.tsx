'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useRole } from '@/components/role/role-provider'
import { useHref } from '@/components/role/app-link'
import { useSearch } from '@/lib/queries'
import { NODE_TYPE_LABEL } from '@/lib/copy'
import type { AtlasNode, SearchMatch } from '@/lib/model'
import { PATIENT_TYPES } from '@/lib/engine/atlas'
import { cn } from '@/lib/cn'

export function nodeHref(n: AtlasNode): string {
  return n.type === 'disease' ? `/disease/${n.id}` : `/node/${n.id}`
}

export function MatchedVia({ m, plain }: { m: SearchMatch; plain?: boolean }) {
  const v = m.matchedVia
  if (v.kind === 'name') return null
  const text =
    v.kind === 'synonym'
      ? plain
        ? `also called “${v.value}”`
        : `matched via synonym: ${v.value}`
      : v.kind === 'id'
        ? `matched via id: ${v.value}`
        : v.kind === 'gene'
          ? plain
            ? `caused by changes in ${v.value}`
            : `matched via gene: ${v.value}`
          : `matched via related term: ${v.value} (not an exact synonym)`
  return <span className="text-label text-ink-3">{text}</span>
}

interface Props {
  size?: 'header' | 'hero'
  placeholder?: string
  autoFocus?: boolean
  onPick?: (n: AtlasNode) => void
  /** Restrict results (leader picking a condition). */
  types?: AtlasNode['type'][]
}

/** One search box for every role. Combobox pattern: arrows move, Enter opens, Escape closes. */
export function GlobalSearch({ size = 'header', placeholder, autoFocus, onPick, types }: Props) {
  const { can, isLite, detail } = useRole()
  const router = useRouter()
  const href = useHref()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const lite = isLite('search')
  const plain = detail === 'plain'
  const q = value.trim()
  const res = useSearch(q, lite ? { types: PATIENT_TYPES, resolveGenes: true } : types ? { types } : undefined)
  const matches = res.data?.status === 'ok' ? res.data.matches.slice(0, 7) : []

  useEffect(() => {
    if (size !== 'header') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [size])

  if (!can('search')) return null

  const go = (m?: SearchMatch) => {
    setOpen(false)
    if (m && onPick) return onPick(m.node)
    if (m) return router.push(href(nodeHref(m.node)))
    if (q) router.push(href(`/search?q=${encodeURIComponent(q)}`))
  }

  const hero = size === 'hero'
  const ph =
    placeholder ?? (lite ? 'Type a diagnosis, gene or symptom' : 'Search a disease, gene, symptom, mechanism or group')

  return (
    <div className={cn('relative', hero ? 'w-full' : 'w-full max-w-[520px]')}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          go(open ? matches[active] : undefined)
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          {ph}
        </label>
        <div
          className={cn(
            'flex items-center gap-2',
            hero ? 'h-14 rounded-md bg-paper px-4' : 'h-10 rounded-sm bg-surface px-3',
          )}
        >
          <Search className={cn('shrink-0 text-ink-3', hero ? 'size-5' : 'size-4')} aria-hidden />
          <input
            ref={input}
            id={`${id}-input`}
            data-testid={hero ? 'hero-search' : 'global-search'}
            role="combobox"
            aria-expanded={open && matches.length > 0}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            value={value}
            placeholder={ph}
            onChange={(e) => {
              setValue(e.target.value)
              setActive(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setOpen(true)
                setActive((a) => Math.min(a + 1, matches.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3',
              hero ? 'text-body' : 'text-ui',
            )}
          />
          {!hero && (
            <kbd
              className="hidden rounded-xs border border-line px-1 font-mono text-[11px] text-ink-3 md:inline"
              aria-hidden
            >
              /
            </kbd>
          )}
        </div>
      </form>
      {open && q && (
        <div
          className="absolute inset-x-0 top-full z-30 mt-1 rounded-md border border-line bg-paper p-1 shadow-[0_8px_24px_-12px_oklch(0.2_0.02_255/0.3)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          {matches.length > 0 ? (
            <ul id={`${id}-list`} role="listbox" aria-label="Suggestions">
              {matches.map((m, i) => (
                <li
                  key={`${m.node.id}-${i}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(m)}
                  className={cn(
                    'flex cursor-pointer items-baseline justify-between gap-3 rounded-sm px-2.5 py-2',
                    i === active && 'bg-surface',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ui text-ink">{m.node.name}</span>
                    <MatchedVia m={m} plain={plain} />
                  </span>
                  <span className="shrink-0 text-meta text-ink-3">{NODE_TYPE_LABEL[m.node.type]}</span>
                </li>
              ))}
            </ul>
          ) : res.isFetching ? null : (
            <p className="px-2.5 py-2 text-ui text-ink-2">
              Nothing in the atlas matches “{q}”. Press Enter to see what was searched.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
