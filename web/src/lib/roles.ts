import type { Role as ContractRole } from '@/types'

export const ROLES = ['leader', 'patient', 'scout', 'researcher', 'admin'] as const
export type Role = (typeof ROLES)[number]
export type DetailLevel = 'plain' | 'standard' | 'technical'
export type HomeKind = 'leader' | 'patient' | 'scout' | 'researcher' | 'admin'

export type PanelId =
  | 'search'
  | 'clusters'
  | 'graph'
  | 'explain'
  | 'evidence'
  | 'contradictions'
  | 'noRoute'
  | 'community'
  | 'action'
  | 'assets'
  | 'mechanismRanking'
  | 'people'
  | 'funding'
  | 'nextStep'
  | 'admin'

export interface RoleConfig {
  label: string
  /** One line shown under the role switcher. */
  description: string
  home: HomeKind
  detail: DetailLevel
  /** Panels this role can open. 'all' grants everything. */
  panels: PanelId[] | 'all'
  /** Subset of panels rendered in their reduced form. */
  lite: PanelId[]
}

export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  leader: {
    label: 'Patient Group Leader',
    description: 'Your condition, its closest connections, and what to do this week.',
    home: 'leader',
    detail: 'standard',
    panels: [
      'search',
      'clusters',
      'graph',
      'explain',
      'evidence',
      'contradictions',
      'noRoute',
      'community',
      'action',
      'assets',
      'people',
      'funding',
      'nextStep',
    ],
    lite: ['people', 'funding'],
  },
  patient: {
    label: 'Patient / Caregiver',
    description: 'Find your community, or the closest related ones.',
    home: 'patient',
    detail: 'plain',
    panels: ['search', 'explain', 'evidence', 'noRoute', 'community', 'action', 'nextStep'],
    lite: ['search', 'evidence', 'action', 'nextStep'],
  },
  scout: {
    label: 'Biotech Scout',
    description: 'Pick a mechanism and see every cluster it could reach.',
    home: 'scout',
    detail: 'standard',
    panels: [
      'search',
      'clusters',
      'graph',
      'explain',
      'evidence',
      'contradictions',
      'noRoute',
      'community',
      'assets',
      'mechanismRanking',
      'people',
      'funding',
      'nextStep',
    ],
    lite: ['graph', 'explain', 'community'],
  },
  researcher: {
    label: 'Researcher',
    description: 'Who else works on your mechanism, under any gene name.',
    home: 'researcher',
    detail: 'technical',
    panels: [
      'search',
      'clusters',
      'graph',
      'explain',
      'evidence',
      'contradictions',
      'noRoute',
      'community',
      'assets',
      'people',
      'funding',
      'nextStep',
    ],
    lite: ['explain', 'community'],
  },
  admin: {
    label: 'Admin',
    description: 'Everything, plus graph builder status and edge review.',
    home: 'admin',
    detail: 'technical',
    panels: 'all',
    lite: [],
  },
}

export const DEFAULT_ROLE: Role = 'leader'

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function canAccess(config: RoleConfig, panel: PanelId): boolean {
  return config.panels === 'all' || config.panels.includes(panel)
}

export function isLite(config: RoleConfig, panel: PanelId): boolean {
  return canAccess(config, panel) && config.lite.includes(panel)
}

/** First role (in display order) that has the full version of a panel. */
export function roleWithFull(panel: PanelId): Role {
  return ROLES.find((r) => canAccess(ROLE_CONFIG[r], panel) && !isLite(ROLE_CONFIG[r], panel)) ?? 'admin'
}

/** Contract role ids (contract/contract.json) for when P4 adds row-level security. */
export const CONTRACT_ROLE: Record<Role, ContractRole> = {
  leader: 'group_leader',
  patient: 'family',
  scout: 'scout',
  researcher: 'researcher',
  admin: 'admin',
}
