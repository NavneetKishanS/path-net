import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSessionToken } from './account-crypto'

const mocks = vi.hoisted(() => ({ query: vi.fn(), withRole: vi.fn() }))
vi.mock('./account-database', () => ({
  accountConfigured: () => true,
  inTransaction: (work: (client: { query: typeof mocks.query }) => unknown) => work({ query: mocks.query }),
  withAccountRole: (userId: string | null, work: (client: { query: typeof mocks.query }) => unknown) => {
    mocks.withRole(userId)
    return work({ query: mocks.query })
  },
}))

import { getAccountSession, registerAccount, updateAccountProfile } from './account-service'
import type { AccountProfile } from '@/lib/account'

const profile: AccountProfile = {
  displayName: 'Researcher', role: 'researcher', detail: 'technical', landing: '/explore',
  interests: [], theme: 'system', graphView: 'graph', showAssistant: true,
}
const userId = '7e5552f0-54d0-4484-9ccd-994735082875'
const request = () => new Request('http://localhost/api/account/profile', { headers: { cookie: `pathnet_session=${createSessionToken()}` } })

describe('server-authoritative account identity', () => {
  beforeEach(() => {
    mocks.query.mockReset()
    mocks.withRole.mockReset()
    mocks.query.mockResolvedValue({ rows: [] })
  })

  it('registers a requested professional lens with family permissions only', async () => {
    const result = await registerAccount({ email: 'researcher@example.org', password: 'long-password-123', profile })
    expect(result.session.user?.role).toBe('family')
    expect(result.session.profile?.role).toBe('researcher')
    expect(result.session.roleStatus).toBe('pending')
    expect(result.session.permissions?.canAdmin).toBe(false)
    expect(result.session.permissions?.canReadProfessionalContacts).toBe(false)
    expect(mocks.query.mock.calls.find(([sql]) => String(sql).includes('insert into public.user_roles'))?.[0]).toContain("values ($1,'family')")
  })

  it('ignores an administrator lens when the stored role is family', async () => {
    mocks.query.mockResolvedValue({ rows: [{ id: userId, email: 'devon@example.org', role: 'family', profile: { ...profile, role: 'admin' } }] })
    const session = await getAccountSession(request())
    expect(session.user?.role).toBe('family')
    expect(session.permissions?.canAdmin).toBe(false)
    expect(session.permissions?.canContribute).toBe(false)
  })

  it('rejects a forged cookie and profile update without a verified subject', async () => {
    const forged = new Request('http://localhost/api/account/profile', { headers: { cookie: 'pathnet_session=admin' } })
    expect((await getAccountSession(forged)).user).toBeNull()
    expect(mocks.query).not.toHaveBeenCalled()
    await expect(updateAccountProfile(forged, profile)).rejects.toMatchObject({ status: 401 })
    expect(mocks.withRole).not.toHaveBeenCalled()
  })

  it('writes only the account verified from the cookie under its RLS subject', async () => {
    mocks.query.mockImplementation((sql: string) => Promise.resolve({ rows: sql.startsWith('update') ? [{ user_id: userId }] : [{ id: userId, email: 'devon@example.org', role: 'family', profile }] }))
    await updateAccountProfile(request(), profile)
    expect(mocks.withRole).toHaveBeenCalledWith(userId)
    const update = mocks.query.mock.calls.find(([sql]) => String(sql).startsWith('update'))
    expect(update?.[0]).toContain('where user_id = $2')
    expect(update?.[1]?.[1]).toBe(userId)
  })
})
