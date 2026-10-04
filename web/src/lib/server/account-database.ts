import { Pool, type PoolClient } from 'pg'
import { AccountError } from './account-validation'

let pool: Pool | undefined
let configuredUrl: string | undefined
export function accountConfigured(): boolean { return Boolean(process.env.PATHNET_ACCOUNT_DATABASE_URL?.trim()) }

function database(): Pool {
  const url = process.env.PATHNET_ACCOUNT_DATABASE_URL?.trim()
  if (!url) throw new AccountError(503, 'Account storage is not configured. You can continue as a guest.')
  if (!pool || configuredUrl !== url) {
    pool = new Pool({ connectionString: url, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
      application_name: 'pathnet_accounts', options: '-c statement_timeout=10000' })
    // Pool errors can include connection details. Keep the browser and logs secret-free.
    pool.on('error', () => undefined)
    configuredUrl = url
  }
  return pool
}

export async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect()
  try {
    await client.query('begin')
    const result = await work(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally { client.release() }
}

/** PostgreSQL itself enforces the existing RLS policies for this verified subject. */
export async function withAccountRole<T>(userId: string | null, work: (client: PoolClient) => Promise<T>): Promise<T> {
  return inTransaction(async (client) => {
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' })])
    await client.query(userId ? 'set local role authenticated' : 'set local role anon')
    return work(client)
  })
}
