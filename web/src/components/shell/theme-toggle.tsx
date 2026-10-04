'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useAccount } from '@/components/account/account-provider'

export function ThemeToggle() {
  const { resolvedTheme } = useTheme()
  const { user, profile, setGuestProfile, saveProfile } = useAccount()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- theme is only known after hydration
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'
  const toggle = () => {
    const theme = dark ? 'light' : 'dark'
    // Route through the account/guest profile (not next-themes' setTheme directly): AccountProvider
    // re-applies the stored profile's theme on every mount, so a bare setTheme() call gets silently
    // reverted on the next reload. Persisting it here is what makes the toggle stick.
    if (user) void saveProfile({ ...profile, theme })
    else setGuestProfile({ theme })
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex size-8 items-center justify-center rounded-sm text-ink-3 hover:bg-surface hover:text-ink"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  )
}
