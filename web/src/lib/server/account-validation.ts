import type { AccountProfile } from '@/lib/account'

export class AccountError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'AccountError'
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AccountError(400, 'Provide a valid account request.')
  }
  return value as Record<string, unknown>
}

export function validateEmail(value: unknown): string {
  if (typeof value !== 'string') throw new AccountError(400, 'Enter a valid email address.')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountError(400, 'Enter a valid email address.')
  }
  return email
}

export function validatePassword(value: unknown, registering = false): string {
  if (typeof value !== 'string' || value.length > 128 || value.length < (registering ? 12 : 1)) {
    throw new AccountError(400, registering
      ? 'Use a password between 12 and 128 characters.'
      : 'Enter your password.')
  }
  return value
}

export function validateProfile(value: unknown, allowAdmin = false): AccountProfile {
  const item = record(value)
  const roles = allowAdmin ? ['leader', 'patient', 'scout', 'researcher', 'admin'] : ['leader', 'patient', 'scout', 'researcher']
  if (typeof item.displayName !== 'string' || !item.displayName.trim() || item.displayName.trim().length > 80) {
    throw new AccountError(400, 'Use a display name between 1 and 80 characters.')
  }
  if (typeof item.role !== 'string' || !roles.includes(item.role)) {
    throw new AccountError(400, 'Choose an available role. Administrator access is assigned by an operator.')
  }
  if (!['plain', 'standard', 'technical'].includes(String(item.detail)) ||
      !['/', '/explore', '/action', '/mechanisms', '/people'].includes(String(item.landing)) ||
      !['system', 'light', 'dark'].includes(String(item.theme)) ||
      !['graph', 'table'].includes(String(item.graphView)) || typeof item.showAssistant !== 'boolean') {
    throw new AccountError(400, 'Choose valid workspace preferences.')
  }
  if (!Array.isArray(item.interests) || item.interests.length > 20 ||
      item.interests.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(id))) {
    throw new AccountError(400, 'Choose up to 20 interests from the atlas.')
  }
  return {
    displayName: item.displayName.trim(),
    role: item.role as AccountProfile['role'],
    detail: item.detail as AccountProfile['detail'],
    landing: item.landing as AccountProfile['landing'],
    interests: [...new Set(item.interests as string[])],
    theme: item.theme as AccountProfile['theme'],
    graphView: item.graphView as AccountProfile['graphView'],
    showAssistant: item.showAssistant,
  }
}

export function validateRegister(body: unknown) {
  const item = record(body)
  return { email: validateEmail(item.email), password: validatePassword(item.password, true), profile: validateProfile(item.profile) }
}

export function validateLogin(body: unknown) {
  const item = record(body)
  return { email: validateEmail(item.email), password: validatePassword(item.password) }
}

export function profileFromBody(body: unknown, allowAdmin: boolean) {
  return validateProfile(record(body).profile, allowAdmin)
}

export const GRAPH_RESOURCES = ['nodes', 'edges', 'evidence', 'clusters', 'node_cluster'] as const
export type GraphResource = (typeof GRAPH_RESOURCES)[number]
export function validateGraphResource(value: string | null): GraphResource {
  if (!GRAPH_RESOURCES.includes(value as GraphResource)) throw new AccountError(400, 'Choose a supported atlas resource.')
  return value as GraphResource
}
