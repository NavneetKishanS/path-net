import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), connect: vi.fn() }))
vi.mock('pg', () => ({
  Pool: class {
    on() { return this }
    connect() { return mocks.connect() }
  },
}))
import { inTransaction, withAccountRole } from './account-database'

describe('database identity boundary', () => {
  beforeEach(() => {
    vi.stubEnv('PATHNET_ACCOUNT_DATABASE_URL', 'postgresql://localhost/test_only')
    mocks.query.mockReset().mockResolvedValue({ rows: [] })
    mocks.release.mockReset()
    mocks.connect.mockReset().mockResolvedValue({ query: mocks.query, release: mocks.release })
  })

  it('sets a verified subject and transaction-local database role', async () => {
    const id = 'fd77f8e9-90d1-458e-84db-71af819a84b3'
    await withAccountRole(id, async (client) => { await client.query('select * from public.edges') })
    expect(mocks.query.mock.calls[0]?.[0]).toBe('begin')
    expect(mocks.query.mock.calls[1]).toEqual([
      "select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: id, role: 'authenticated' })],
    ])
    expect(mocks.query.mock.calls[2]?.[0]).toBe('set local role authenticated')
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe('commit')
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it('uses anon for guests and clears role at the transaction boundary', async () => {
    await withAccountRole(null, async () => undefined)
    expect(mocks.query.mock.calls[1]?.[1]).toEqual([JSON.stringify({ role: 'anon' })])
    expect(mocks.query.mock.calls[2]?.[0]).toBe('set local role anon')
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe('commit')
  })

  it('rolls back failures and releases the client so its role cannot leak', async () => {
    await expect(inTransaction(async () => { throw new Error('test failure') })).rejects.toThrow('test failure')
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe('rollback')
    expect(mocks.query.mock.calls.some(([sql]) => sql === 'commit')).toBe(false)
    expect(mocks.release).toHaveBeenCalledOnce()
  })
})
