import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { AccountProfile, AccountSession, AccountUser } from '@/lib/account'
import type { Role as ContractRole } from '@/types'
import { accountConfigured, inTransaction, withAccountRole } from './account-database'
import { createSessionToken, hashPassword, hashSessionToken, isSessionToken, verifyPassword } from './account-crypto'
import { AccountError, type GraphResource } from './account-validation'

export const SESSION_COOKIE = 'pathnet_session'
export const SESSION_SECONDS = 7 * 24 * 60 * 60
type SessionPayload = AccountSession & {
  configured: boolean
  permissions?: { canAdmin: boolean; canContribute: boolean; canReadProfessionalContacts: boolean }
  roleStatus?: 'active' | 'pending'
}
interface SessionRow {
  id: string
  email: string
  role: ContractRole
  profile: AccountProfile
}

const LENS_ROLE: Record<AccountProfile['role'], ContractRole> = {
  patient: 'family', leader: 'group_leader', scout: 'scout', researcher: 'researcher', admin: 'admin',
}
const CONTRACT_ROLES: readonly string[] = ['family', 'group_leader', 'scout', 'researcher', 'admin']

function sessionPayload(row: SessionRow): SessionPayload {
  if (!CONTRACT_ROLES.includes(row.role)) throw new AccountError(403, 'This account does not have an available role.')
  const user: AccountUser = { id: row.id, email: row.email, role: row.role }
  return {
    configured: true, user, profile: row.profile,
    roleStatus: row.role === 'admin' || row.role === LENS_ROLE[row.profile.role] ? 'active' : 'pending',
    permissions: {
      canAdmin: row.role === 'admin',
      canContribute: ['group_leader', 'researcher', 'admin'].includes(row.role),
      canReadProfessionalContacts: ['group_leader', 'scout', 'researcher', 'admin'].includes(row.role),
    },
  }
}

export function sessionTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))
  const token = cookie?.slice(SESSION_COOKIE.length + 1) ?? ''
  return isSessionToken(token) ? token : null
}

export async function getAccountSession(request: Request): Promise<SessionPayload> {
  const token = sessionTokenFromRequest(request)
  if (!accountConfigured() || !token) return { configured: accountConfigured(), user: null, profile: null }
  const row = await inTransaction(async (client) => {
    const result = await client.query<SessionRow>(
      `select a.id, a.email, r.role, p.profile
       from pathnet_private.account_sessions s
       join pathnet_private.accounts a on a.id = s.user_id
       join public.user_roles r on r.user_id = a.id
       join public.account_profiles p on p.user_id = a.id
       where s.token_hash = $1 and s.expires_at > now() and a.disabled_at is null`,
      [hashSessionToken(token)],
    )
    return result.rows[0]
  })
  return row ? sessionPayload(row) : { configured: true, user: null, profile: null }
}

async function requireAccount(request: Request): Promise<SessionPayload & { user: AccountUser }> {
  const session = await getAccountSession(request)
  if (!session.user) throw new AccountError(401, 'Sign in to save your workspace.')
  return session as SessionPayload & { user: AccountUser }
}

async function validateInterests(client: PoolClient, interests: string[]) {
  if (!interests.length) return
  const result = await client.query<{ id: string }>('select id from public.nodes where id = any($1::text[])', [interests])
  if (result.rows.length !== interests.length) throw new AccountError(400, 'One of your interests is no longer available in the atlas. Choose it again.')
}

async function insertSession(client: PoolClient, userId: string): Promise<string> {
  const token = createSessionToken()
  await client.query(`insert into pathnet_private.account_sessions(token_hash,user_id,expires_at)
    values ($1,$2,now() + interval '7 days')`, [hashSessionToken(token), userId])
  return token
}

export async function registerAccount(input: { email: string; password: string; profile: AccountProfile }) {
  const passwordHash = await hashPassword(input.password)
  try {
    return await inTransaction(async (client) => {
      await validateInterests(client, input.profile.interests)
      const id = randomUUID()
      await client.query('insert into pathnet_private.accounts(id,email,password_hash) values ($1,$2,$3)', [id, input.email, passwordHash])
      // Selected persona is only a view preference. No self-registration grants professional/admin privileges.
      await client.query("insert into public.user_roles(user_id,role) values ($1,'family')", [id])
      await client.query('insert into public.account_profiles(user_id,profile) values ($1,$2::jsonb)', [id, JSON.stringify(input.profile)])
      const token = await insertSession(client, id)
      return { token, session: sessionPayload({ id, email: input.email, role: 'family', profile: input.profile }) }
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw new AccountError(409, 'An account already uses this email. Sign in instead.')
    }
    throw error
  }
}

let dummyPasswordHash: Promise<string> | undefined
export async function loginAccount(input: { email: string; password: string }, previousToken: string | null) {
  const row = await inTransaction(async (client) => {
    const result = await client.query<SessionRow & { password_hash: string; disabled_at: Date | null }>(
      `select a.id, a.email, a.password_hash, a.disabled_at, r.role, p.profile
       from pathnet_private.accounts a
       join public.user_roles r on r.user_id = a.id
       join public.account_profiles p on p.user_id = a.id where a.email = $1`, [input.email],
    )
    return result.rows[0]
  })
  dummyPasswordHash ??= hashPassword('PathNet dummy password for timing only')
  const passwordMatches = await verifyPassword(input.password, row?.password_hash ?? await dummyPasswordHash)
  if (!row || row.disabled_at || !passwordMatches) throw new AccountError(401, 'Email or password is incorrect.')
  const session = sessionPayload(row)
  const token = await inTransaction(async (client) => {
    // Rotate this browser's old session to avoid session fixation and account mixing.
    if (previousToken) await client.query('delete from pathnet_private.account_sessions where token_hash = $1', [hashSessionToken(previousToken)])
    // Re-check disabled status after the expensive password verification.
    const active = await client.query('select id from pathnet_private.accounts where id = $1 and disabled_at is null for update', [row.id])
    if (!active.rows.length) throw new AccountError(401, 'Email or password is incorrect.')
    return insertSession(client, row.id)
  })
  return { token, session }
}

export async function logoutAccount(request: Request) {
  const token = sessionTokenFromRequest(request)
  if (accountConfigured() && token) {
    await inTransaction(async (client) => {
      await client.query('delete from pathnet_private.account_sessions where token_hash = $1', [hashSessionToken(token)])
    })
  }
  return { configured: accountConfigured(), user: null, profile: null } satisfies SessionPayload
}

export async function updateAccountProfile(request: Request, profile: AccountProfile) {
  const session = await requireAccount(request)
  await withAccountRole(session.user.id, async (client) => {
    await validateInterests(client, profile.interests)
    const result = await client.query('update public.account_profiles set profile = $1::jsonb, updated_at = now() where user_id = $2 returning user_id', [JSON.stringify(profile), session.user.id])
    if (!result.rows.length) throw new AccountError(403, 'This workspace cannot be updated.')
  })
  return getAccountSession(request)
}

export async function readAccountGraph(request: Request, resource: GraphResource) {
  const session = await getAccountSession(request)
  return withAccountRole(session.user?.id ?? null, async (client) => {
    // `resource` is validated against the five fixed contract table names.
    const result = await client.query(`select * from public.${resource}`)
    return result.rows
  })
}
