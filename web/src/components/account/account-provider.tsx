'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useQueryClient } from '@tanstack/react-query'
import { resetApiClient } from '@/api'
import { isRole } from '@/lib/roles'
import {
  accountClient,
  defaultProfile,
  NO_ACCOUNT_PERMISSIONS,
  type AccountPermissions,
  type AccountProfile,
  type AccountSession,
  type AccountUser,
} from '@/lib/account'
import { setWorkflowAccount } from '@/lib/workflow'
import { setBrowserOverrideAccount } from '@/lib/api/atlas-client'
import { useChat } from '@/components/chat/chat-store'
import { useLanding } from '@/components/landing/landing-store'

const VISITED = 'pathnet.initialized.v1'
const GUEST_PROFILE = 'pathnet.guest-preferences.v1'
const SESSION_CHANGED = 'pathnet.session-changed.v1'

interface AccountContextValue {
  ready: boolean
  configured: boolean
  user: AccountUser | null
  profile: AccountProfile
  permissions: AccountPermissions
  roleStatus: 'active' | 'pending'
  onboardingOpen: boolean
  onboardingMode: 'register' | 'login'
  openOnboarding: (mode?: 'register' | 'login') => void
  closeOnboarding: () => void
  continueAsGuest: () => void
  register: (email: string, password: string, profile: AccountProfile) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  saveProfile: (profile: AccountProfile) => Promise<void>
  setGuestProfile: (profile: Partial<AccountProfile>) => void
}

const AccountContext = createContext<AccountContextValue | null>(null)

function readGuestProfile(): AccountProfile {
  try {
    const value = JSON.parse(localStorage.getItem(GUEST_PROFILE) ?? 'null') as Partial<AccountProfile> | null
    if (!value || !isRole(value.role) || value.role === 'admin') return defaultProfile()
    return {
      ...defaultProfile(value.role),
      ...value,
      detail: ['plain', 'standard', 'technical'].includes(value.detail ?? '')
        ? value.detail!
        : defaultProfile(value.role).detail,
      interests: Array.isArray(value.interests)
        ? value.interests.filter((id): id is string => typeof id === 'string').slice(0, 30)
        : [],
    }
  } catch {
    return defaultProfile()
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<AccountSession>({ configured: false, user: null, profile: null })
  const [guestProfile, setGuestProfileState] = useState<AccountProfile>(defaultProfile())
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [onboardingMode, setOnboardingMode] = useState<'register' | 'login'>('register')
  const identity = useRef<string | undefined>(undefined)
  const sessionRevision = useRef(0)
  const mutatingSession = useRef(0)
  const sessionQueue = useRef<Promise<void>>(Promise.resolve())
  const queryClient = useQueryClient()
  const { setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()

  const applySession = useCallback(
    (next: AccountSession, revision: number): Promise<void> => {
      const apply = async () => {
        if (revision !== sessionRevision.current) return
        const key = next.user ? `${next.user.id}:${next.user.role}` : 'guest'
        if (identity.current !== key) {
          await queryClient.cancelQueries()
          if (revision !== sessionRevision.current) return
          // A newer session arriving during hydration must re-scope every private store.
          identity.current = undefined
          setBrowserOverrideAccount(next.user?.id ?? null, next.permissions?.canAdmin ?? false)
          useChat.getState().clear()
          useChat.getState().setOpen(false)
          resetApiClient()
          queryClient.clear()
          await setWorkflowAccount(next.user?.id ?? null)
          if (revision !== sessionRevision.current) return
          identity.current = key
        }
        setSession(next)
        if (next.profile) setTheme(next.profile.theme)
        if (next.user) {
          localStorage.setItem(VISITED, 'account')
          setOnboardingOpen(false)
        }
      }
      const queued = sessionQueue.current.then(apply, apply)
      sessionQueue.current = queued.catch(() => undefined)
      return queued
    },
    [queryClient, setTheme],
  )

  const mutateSession = useCallback(
    async (work: () => Promise<AccountSession>) => {
      const revision = ++sessionRevision.current
      mutatingSession.current += 1
      try {
        const next = await work()
        await applySession(next, revision)
        return next
      } finally {
        mutatingSession.current -= 1
      }
    },
    [applySession],
  )

  useEffect(() => {
    let active = true
    const load = async () => {
      const revision = ++sessionRevision.current
      const guest = readGuestProfile()
      const next = await accountClient
        .session()
        .catch((): AccountSession => ({ configured: false, user: null, profile: null }))
      if (!active) return
      setGuestProfileState(guest)
      if (!next.profile) setTheme(guest.theme)
      await applySession(next, revision)
      if (active) setReady(true)
    }
    void load()
    return () => {
      active = false
    }
  }, [applySession, setTheme])

  const landingVisible = useLanding((s) => s.visible)
  useEffect(() => {
    // The landing splash also auto-shows on a fresh "/" visit and takes priority -- it portals
    // on top of everything and would otherwise be stuck behind this dialog's body pointer-events
    // lock. Skip opening onboarding while it's up instead of racing to close it after the fact.
    if (!ready || session.user || pathname !== '/' || localStorage.getItem(VISITED) || landingVisible) return
    const timer = window.setTimeout(() => setOnboardingOpen(true), 0)
    return () => window.clearTimeout(timer)
  }, [ready, session.user, pathname, landingVisible])

  useEffect(() => {
    const refresh = async () => {
      if (mutatingSession.current) return
      const revision = ++sessionRevision.current
      const next = await accountClient.session().catch(() => null)
      if (next) await applySession(next, revision)
    }
    const changed = (event: StorageEvent) => {
      if (event.key === SESSION_CHANGED) void refresh()
    }
    window.addEventListener('storage', changed)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', changed)
      window.removeEventListener('focus', refresh)
    }
  }, [applySession])

  const announceSession = () => localStorage.setItem(SESSION_CHANGED, String(Date.now()))
  const closeOnboarding = useCallback(() => setOnboardingOpen(false), [])
  const openOnboarding = useCallback((mode: 'register' | 'login' = 'register') => {
    setOnboardingMode(mode)
    setOnboardingOpen(true)
  }, [])
  const continueAsGuest = useCallback(() => {
    localStorage.setItem(VISITED, 'guest')
    setOnboardingOpen(false)
  }, [])
  const setGuestProfile = useCallback(
    (patch: Partial<AccountProfile>) => {
      setGuestProfileState((previous) => {
        const next = { ...previous, ...patch }
        if (next.role === 'admin') next.role = 'patient'
        localStorage.setItem(GUEST_PROFILE, JSON.stringify(next))
        return next
      })
      if (patch.theme) setTheme(patch.theme)
    },
    [setTheme],
  )

  const value = useMemo<AccountContextValue>(
    () => ({
      ready,
      configured: session.configured,
      user: session.user,
      profile: session.profile ?? guestProfile,
      permissions: session.permissions ?? NO_ACCOUNT_PERMISSIONS,
      roleStatus: session.roleStatus ?? 'active',
      onboardingOpen,
      onboardingMode,
      openOnboarding,
      closeOnboarding,
      continueAsGuest,
      setGuestProfile,
      register: async (email, password, profile) => {
        await mutateSession(() => accountClient.register(email, password, profile))
        announceSession()
      },
      login: async (email, password) => {
        const next = await mutateSession(() => accountClient.login(email, password))
        announceSession()
        if (next.profile) router.push(`${next.profile.landing}?role=${next.profile.role}`)
      },
      logout: async () => {
        await mutateSession(() => accountClient.logout())
        setGuestProfileState(defaultProfile())
        localStorage.removeItem(GUEST_PROFILE)
        localStorage.setItem(VISITED, 'guest')
        setTheme('system')
        announceSession()
        router.push('/?role=patient')
      },
      saveProfile: async (profile) => {
        await mutateSession(() => accountClient.saveProfile(profile))
        announceSession()
      },
    }),
    [
      ready,
      session,
      guestProfile,
      onboardingOpen,
      onboardingMode,
      openOnboarding,
      closeOnboarding,
      continueAsGuest,
      setGuestProfile,
      mutateSession,
      setTheme,
      router,
    ],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext)
  if (!context) throw new Error('useAccount must be used inside AccountProvider')
  return context
}
