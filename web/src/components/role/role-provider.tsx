'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQueryState } from 'nuqs'
import { useSearchParams } from 'next/navigation'
import { useAccount } from '@/components/account/account-provider'
import { canAccess, isLite, ROLE_CONFIG, type DetailLevel, type PanelId, type Role, type RoleConfig } from '@/lib/roles'
import { roleParam } from '@/lib/url-state'

interface RoleContextValue {
  role: Role
  config: RoleConfig
  detail: DetailLevel
  can: (panel: PanelId) => boolean
  isLite: (panel: PanelId) => boolean
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [urlRole, setUrlRole] = useQueryState('role', roleParam.withOptions({ history: 'replace' }))
  const params = useSearchParams()
  const account = useAccount()
  const preferredRole = account.ready ? account.profile.role : urlRole
  const requestedRole = params.has('role') ? urlRole : preferredRole
  const role: Role = requestedRole === 'admin' && !account.permissions.canAdmin ? 'patient' : requestedRole
  const value = useMemo<RoleContextValue>(() => {
    const defaults = ROLE_CONFIG[role]
    const personalized = account.ready && account.profile.role === role
    const config = {
      ...defaults,
      detail: personalized ? account.profile.detail : defaults.detail,
      assistant: defaults.assistant && (!personalized || account.profile.showAssistant),
    }
    return {
      role,
      config,
      detail: config.detail,
      can: (panel) => (panel === 'admin' ? account.permissions.canAdmin && role === 'admin' : canAccess(config, panel)),
      isLite: (panel) => isLite(config, panel),
      setRole: (r) => {
        if (r !== 'admin' || account.permissions.canAdmin) void setUrlRole(r)
      },
    }
  }, [role, setUrlRole, account.ready, account.profile, account.permissions.canAdmin])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used inside RoleProvider')
  return ctx
}
