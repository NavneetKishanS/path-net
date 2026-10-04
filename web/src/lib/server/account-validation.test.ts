import { describe, expect, it } from 'vitest'
import { validateEmail, validateGraphResource, validateProfile, validateRegister } from './account-validation'

const profile = {
  displayName: ' Devon ', role: 'patient', detail: 'plain', landing: '/',
  interests: ['dis_stxbp1', 'dis_stxbp1'], theme: 'system', graphView: 'graph', showAssistant: false,
}

describe('account input boundaries', () => {
  it('normalizes email and keeps only known private preference fields', () => {
    expect(validateEmail(' Devon@Example.org ')).toBe('devon@example.org')
    expect(validateProfile({ ...profile, user_id: 'somebody-else', verifiedRole: 'admin' })).toEqual({
      ...profile, displayName: 'Devon', interests: ['dis_stxbp1'],
    })
  })

  it('does not allow self-registration to select administrator', () => {
    expect(() => validateRegister({ email: 'devon@example.org', password: 'long-password-123', profile: { ...profile, role: 'admin' } })).toThrow('Administrator access is assigned')
    expect(() => validateProfile({ ...profile, role: 'admin' })).toThrow()
    expect(validateProfile({ ...profile, role: 'admin' }, true).role).toBe('admin')
  })

  it('requires a reasonable password and bounded interests', () => {
    expect(() => validateRegister({ email: 'devon@example.org', password: 'short', profile })).toThrow('12 and 128')
    expect(() => validateProfile({ ...profile, interests: Array.from({ length: 21 }, (_, i) => `dis_${i}`) })).toThrow()
    expect(() => validateProfile({ ...profile, interests: ['nodes; delete from user_roles'] })).toThrow()
    expect(() => validateProfile({ ...profile, landing: '//outside.example' })).toThrow()
  })

  it('prevents private tables or SQL text from reaching the graph query', () => {
    expect(validateGraphResource('edges')).toBe('edges')
    for (const item of [null, 'account_profiles', 'user_roles', 'accounts', 'nodes;drop table nodes']) {
      expect(() => validateGraphResource(item)).toThrow('supported atlas resource')
    }
  })
})
