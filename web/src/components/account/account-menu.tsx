'use client'

import { useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { BookOpen, Check, ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { AppLink } from '@/components/role/app-link'
import { useRole } from '@/components/role/role-provider'
import { Button } from '@/components/ui/button'
import { useAccount } from './account-provider'

export function AccountMenu() {
  const account = useAccount()
  const { role, detail } = useRole()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toggleLanguage = async () => {
    if (busy) return
    const next = detail === 'plain' ? 'technical' : 'plain'
    setBusy(true)
    try {
      if (account.user) await account.saveProfile({ ...account.profile, role: 'patient', detail: next, landing: '/' })
      else account.setGuestProfile({ role: 'patient', detail: next, landing: '/' })
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save language preference.')
    } finally {
      setBusy(false)
    }
  }
  const logout = async () => {
    setBusy(true)
    try {
      await account.logout()
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  if (!account.ready) return <span className="h-8 w-8 rounded-sm bg-surface" aria-hidden />
  return (
    <div className="flex items-center gap-1">
      {role === 'patient' && (
        <button
          type="button"
          aria-label="Simple language"
          aria-pressed={detail === 'plain'}
          disabled={busy}
          onClick={() => void toggleLanguage()}
          title={detail === 'plain' ? 'Switch to academic language' : 'Switch to simple language'}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-label text-accent-ink hover:bg-band disabled:opacity-50"
        >
          <BookOpen className="size-4" aria-hidden />
          <span className="hidden xl:inline">{detail === 'plain' ? 'Simple language' : 'Academic language'}</span>
        </button>
      )}
      {!account.user ? (
        <Button size="sm" variant="secondary" onClick={() => account.openOnboarding('login')}>
          <UserRound className="size-4" aria-hidden />
          <span className="hidden sm:inline">Sign in</span>
          <span className="sr-only sm:hidden">Sign in</span>
        </Button>
      ) : (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            disabled={busy}
            aria-label={`Account: ${account.profile.displayName || account.user.email}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line px-2 text-label text-ink hover:bg-surface"
          >
            <UserRound className="size-4" aria-hidden />
            <span className="hidden max-w-[110px] truncate lg:inline">{account.profile.displayName || 'Account'}</span>
            <ChevronDown className="size-3.5" aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-[270px] rounded-md border border-line bg-paper p-1 shadow-lg"
            >
              <DropdownMenu.Label className="break-words px-3 py-2 text-label">
                <span className="block font-semibold">{account.profile.displayName || 'Your account'}</span>
                <span className="block text-meta font-normal text-ink-3">{account.user.email}</span>
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item asChild>
                <AppLink
                  href="/account"
                  className="flex cursor-default items-center gap-2 rounded-sm px-3 py-2 text-label outline-none data-[highlighted]:bg-surface"
                >
                  <Settings className="size-4" aria-hidden />
                  Profile & preferences
                </AppLink>
              </DropdownMenu.Item>
              {role === 'patient' && (
                <DropdownMenu.CheckboxItem
                  checked={detail === 'plain'}
                  disabled={busy}
                  onCheckedChange={() => void toggleLanguage()}
                  className="flex cursor-default items-center gap-2 rounded-sm px-3 py-2 text-label outline-none data-[highlighted]:bg-surface"
                >
                  <BookOpen className="size-4" aria-hidden />
                  Simple language
                  <DropdownMenu.ItemIndicator className="ml-auto">
                    <Check className="size-4 text-accent-ink" aria-hidden />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.CheckboxItem>
              )}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                disabled={busy}
                onSelect={() => void logout()}
                className="flex cursor-default items-center gap-2 rounded-sm px-3 py-2 text-label outline-none data-[highlighted]:bg-surface"
              >
                <LogOut className="size-4" aria-hidden />
                {busy ? 'Signing out…' : 'Sign out'}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
      {error && (
        <p
          role="alert"
          className="absolute top-full right-4 max-w-[360px] rounded-sm border border-contra bg-contra-weak p-3 text-label text-contra-ink"
        >
          {error}
        </p>
      )}
    </div>
  )
}
