'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQueryState } from 'nuqs'
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
  const [role, setRole] = useQueryState('role', roleParam.withOptions({ history: 'replace' }))
  const value = useMemo<RoleContextValue>(() => {
    const config = ROLE_CONFIG[role]
    return {
      role,
      config,
      detail: config.detail,
      can: (panel) => canAccess(config, panel),
      isLite: (panel) => isLite(config, panel),
      setRole: (r) => void setRole(r),
    }
  }, [role, setRole])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used inside RoleProvider')
  return ctx
}
