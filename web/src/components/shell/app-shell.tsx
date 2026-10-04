'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { useRole } from '@/components/role/role-provider'
import { AppLink } from '@/components/role/app-link'
import { GlobalSearch } from '@/components/search/global-search'
import { EvidenceDrawer } from '@/components/evidence/evidence-drawer'
import { useMeta } from '@/lib/queries'
import { formatDate } from '@/lib/copy'
import type { PanelId } from '@/lib/roles'
import { cn } from '@/lib/cn'
import { ChatDock, CHAT_WIDTH } from '@/components/chat/chat-dock'
import { useChat } from '@/components/chat/chat-store'
import { RoleSwitcher } from './role-switcher'
import { ThemeToggle } from './theme-toggle'

const NAV: { href: string; label: string; panel: PanelId }[] = [
  { href: '/explore', label: 'Map', panel: 'graph' },
  { href: '/mechanisms', label: 'Mechanisms', panel: 'mechanismRanking' },
  { href: '/people', label: 'People', panel: 'people' },
  { href: '/funding', label: 'Funding', panel: 'funding' },
  { href: '/admin', label: 'Admin', panel: 'admin' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { can, role, detail, config } = useRole()
  const path = usePathname()
  const chatOpen = useChat((s) => s.open) && config.assistant
  const nav = NAV.filter((n) => can(n.panel))
  return (
    <div className={cn('flex min-h-dvh flex-col', chatOpen && CHAT_WIDTH)}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-paper">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 md:px-6">
          <AppLink href="/" className="flex shrink-0 items-baseline gap-2" aria-label="PathNet home">
            <span className="font-serif text-[19px] font-semibold tracking-tight text-ink">PathNet</span>
            <span className="hidden text-label text-ink-3 sm:inline">Rare disease atlas</span>
          </AppLink>
          {role !== 'patient' && (
            <div className="hidden flex-1 justify-center md:flex">
              <GlobalSearch />
            </div>
          )}
          <div className={cn('ml-auto flex items-center gap-1', role === 'patient' && 'flex-1 justify-end')}>
            {role === 'patient' && path !== '/' && (
              <AppLink
                href="/"
                className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-label text-ink-2 hover:bg-surface hover:text-ink"
              >
                <Search className="size-4" aria-hidden />
                <span className="hidden sm:inline">New search</span>
                <span className="sr-only sm:hidden">New search</span>
              </AppLink>
            )}
            <ChatDock />
            <RoleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        {nav.length > 0 && (
          <nav aria-label="Sections" className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-4 pb-1.5 md:px-6">
            <NavLink href="/" active={path === '/'}>
              Home
            </NavLink>
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href} active={path.startsWith(n.href)}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
        {role !== 'patient' && (
          <div className="border-t border-line px-4 py-2 md:hidden">
            <GlobalSearch />
          </div>
        )}
      </header>
      {/* Content arrives after hydration; keeping the footer below the fold avoids a layout shift. */}
      <main id="main" className="min-h-dvh flex-1">
        {children}
      </main>
      <DataFooter plain={detail === 'plain'} />
      <EvidenceDrawer />
    </div>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <AppLink
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-sm px-2.5 py-1 text-label whitespace-nowrap',
        active ? 'bg-surface font-medium text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink',
      )}
    >
      {children}
    </AppLink>
  )
}

function DataFooter({ plain }: { plain: boolean }) {
  const meta = useMeta()
  const m = meta.data
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-4 py-5 text-label text-ink-3 md:flex-row md:justify-between md:px-6">
        <p>
          {plain
            ? 'This atlas helps you find people and research. It is not medical advice.'
            : 'PathNet prototype. Connections are research leads, not medical advice.'}
        </p>
        <p data-testid="data-source">
          {m
            ? `Data: ${m.label}${m.snapshotDate ? `, retrieved ${formatDate(m.snapshotDate)}` : ''} · ${m.counts.nodes} records, ${m.counts.edges} cited links · records marked Sample are not real sources`
            : 'Loading data…'}
        </p>
      </div>
    </footer>
  )
}
