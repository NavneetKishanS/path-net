import { describe, expect, it } from 'vitest'
import { canAccess, CONTRACT_ROLE, DEFAULT_ROLE, isLite, isRole, ROLE_CONFIG, ROLES, roleWithFull, type PanelId } from './roles'

// The feature table from the task: F = full, L = lite, - = none. Columns: leader, patient, scout, researcher, admin.
const TABLE: Record<PanelId, string> = {
  search: 'FLFFF',
  clusters: 'F-FFF',
  graph: 'F-LFF',
  explain: 'FFLLF',
  evidence: 'FLFFF',
  contradictions: 'F-FFF',
  noRoute: 'FFFFF',
  community: 'FFLLF',
  action: 'FL--F',
  assets: 'F-FFF',
  mechanismRanking: '--F-F',
  people: 'L-FFF',
  funding: 'L-FFF',
  nextStep: 'FLFFF',
  admin: '----F',
}

describe('role config', () => {
  it('matches the feature table for every role and panel', () => {
    for (const [panel, row] of Object.entries(TABLE) as [PanelId, string][]) {
      ROLES.forEach((role, i) => {
        const want = row[i]
        const config = ROLE_CONFIG[role]
        const got = !canAccess(config, panel) ? '-' : isLite(config, panel) ? 'L' : 'F'
        expect(`${role}.${panel}=${got}`).toBe(`${role}.${panel}=${want}`)
      })
    }
  })

  it('assigns detail levels per role', () => {
    expect(ROLE_CONFIG.patient.detail).toBe('plain')
    expect(ROLE_CONFIG.leader.detail).toBe('standard')
    expect(ROLE_CONFIG.scout.detail).toBe('standard')
    expect(ROLE_CONFIG.researcher.detail).toBe('technical')
    expect(ROLE_CONFIG.admin.detail).toBe('technical')
  })

  it('defaults to the Patient Group Leader and validates ids', () => {
    expect(DEFAULT_ROLE).toBe('leader')
    expect(isRole('scout')).toBe(true)
    expect(isRole('family')).toBe(false)
    expect(isRole(null)).toBe(false)
  })

  it('points to a role with the full panel', () => {
    expect(roleWithFull('mechanismRanking')).toBe('scout')
    expect(roleWithFull('admin')).toBe('admin')
    expect(roleWithFull('action')).toBe('leader')
  })

  it('maps every role to a contract role', () => {
    expect(Object.keys(CONTRACT_ROLE).sort()).toEqual([...ROLES].sort())
    expect(CONTRACT_ROLE.patient).toBe('family')
  })
})
