import type { Role as ContractRole } from '@/types'
import { DEFAULT_ROLE, ROLE_CONFIG, type DetailLevel, type Role } from './roles'

export const ACCOUNT_ROLES = ['patient', 'leader', 'researcher', 'scout'] as const
export type AccountLanding = '/' | '/explore' | '/action' | '/mechanisms' | '/people'

/** Private presentation choices. These never grant an authorization role. */
export interface AccountProfile {
  displayName: string
  role: Role
  detail: DetailLevel
  landing: AccountLanding
  interests: string[]
  theme: 'system' | 'light' | 'dark'
  graphView: 'graph' | 'table'
  showAssistant: boolean
}

export interface AccountUser {
  id: string
  email: string
  role: ContractRole
}

export interface AccountPermissions {
  canAdmin: boolean
  canContribute: boolean
  canReadProfessionalContacts: boolean
}

export interface AccountSession {
  configured: boolean
  user: AccountUser | null
  profile: AccountProfile | null
  permissions?: AccountPermissions
  roleStatus?: 'active' | 'pending'
}

export function defaultProfile(role: Role = DEFAULT_ROLE): AccountProfile {
  return {
    displayName: '',
    role,
    detail: ROLE_CONFIG[role].detail,
    landing: '/',
    interests: [],
    theme: 'system',
    graphView: 'graph',
    showAssistant: ROLE_CONFIG[role].assistant,
  }
}

export const NO_ACCOUNT_PERMISSIONS: AccountPermissions = {
  canAdmin: false,
  canContribute: false,
  canReadProfessionalContacts: false,
}

async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`/api/account/${path}`, {
    method: body === undefined && method === 'POST' ? 'GET' : method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(payload?.error ?? 'The account service could not complete this request. Please try again.')
  return payload as T
}

export const accountClient = {
  session: () => request<AccountSession>('session'),
  register: (email: string, password: string, profile: AccountProfile) =>
    request<AccountSession>('register', { email, password, profile }),
  login: (email: string, password: string) => request<AccountSession>('login', { email, password }),
  logout: () => request<AccountSession>('logout', {}, 'POST'),
  saveProfile: (profile: AccountProfile) => request<AccountSession>('profile', { profile }, 'PATCH'),
}
