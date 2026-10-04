'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRole } from '@/components/role/role-provider'
import { useAccount } from '@/components/account/account-provider'
import { Button } from '@/components/ui/button'
import { ROLE_CONFIG, roleWithFull, type PanelId } from '@/lib/roles'
import { cn } from '@/lib/cn'

export function Page({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-8 md:px-6 md:py-10',
        narrow ? 'max-w-[760px]' : 'max-w-[1280px]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  kicker,
  title,
  children,
  actions,
}: {
  kicker?: ReactNode
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="title-band -mt-8 mb-8 flex flex-col gap-4 pt-8 pb-7 md:-mt-10 md:flex-row md:items-end md:justify-between md:pt-10">
      <div className="min-w-0">
        {kicker && <div className="mb-2 text-label text-ink-3">{kicker}</div>}
        <h1 className="text-h2 text-ink md:text-h1">{title}</h1>
        {children && <div className="mt-3 max-w-[68ch] text-body text-ink-2">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Section({
  title,
  id,
  aside,
  children,
  className,
}: {
  title: ReactNode
  id?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={cn('border-t border-line pt-5', className)}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={id} className="scroll-mt-24 text-h3 text-ink">
          {title}
        </h2>
        {aside && <div className="text-label text-ink-3">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

/** Static placeholder that reserves space. No shimmer. */
export function Pending({ label = 'Loading', lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2" style={{ minHeight: lines * 24 }}>
      <span className="text-label text-ink-3">{label}…</span>
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <div role="alert" className="border-l-2 border-contra pl-3 text-ui text-ink-2">
      The data could not be loaded. {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

/** Shown when the current role does not include a panel. Points to a role that has it. */
export function NotInView({ panel, what }: { panel: PanelId; what: string }) {
  const { config } = useRole()
  const account = useAccount()
  const path = usePathname()
  const other = roleWithFull(panel)
  if (panel === 'admin')
    return (
      <Page narrow>
        <h1 className="text-h2 text-ink">Administration requires an assigned role</h1>
        <p className="mt-3 text-body text-ink-2">
          This area is available to signed-in accounts with an administrator role. Changing a viewing preference does
          not grant access.
        </p>
        {!account.user && (
          <Button className="mt-5" onClick={() => account.openOnboarding('login')}>
            Sign in
          </Button>
        )}
        <Link href="/" className="link mt-5 ml-4 inline-block">
          Return home
        </Link>
      </Page>
    )
  return (
    <Page narrow>
      <h1 className="text-h2 text-ink">{what} is not part of this view</h1>
      <p className="mt-3 text-body text-ink-2">
        The {config.label} view keeps to what helps most at this stage. {what} is available when viewing as{' '}
        <Link className="link" href={`${path}?role=${other}`}>
          {ROLE_CONFIG[other].label}
        </Link>
        .
      </p>
    </Page>
  )
}

export function Gate({ panel, what, children }: { panel: PanelId; what: string; children: ReactNode }) {
  const { can } = useRole()
  return can(panel) ? <>{children}</> : <NotInView panel={panel} what={what} />
}
