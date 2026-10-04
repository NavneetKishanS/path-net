import { randomUUID } from 'node:crypto'
import nextEnv from '@next/env'
import { test, expect, request as requests, type APIRequestContext } from '@playwright/test'
import { Pool, type PoolClient } from 'pg'
import type { AccountProfile, AccountSession } from '../src/lib/account'

const { loadEnvConfig } = nextEnv
const baseURL = process.env.PATHNET_TEST_URL || 'http://127.0.0.1:5176'
const origin = new URL(baseURL).origin
const marker = randomUUID().replaceAll('-', '')
const password = `PathNet account integration ${marker}`
const ownedUsers = new Set<string>()
const ownedEdges = new Set<string>()
const graphTables = ['nodes', 'edges', 'evidence', 'clusters', 'node_cluster'] as const
const profileA: AccountProfile = {
  displayName: 'Account A', role: 'researcher', detail: 'technical', landing: '/people',
  interests: [], theme: 'dark', graphView: 'table', showAssistant: true,
}
const profileB: AccountProfile = {
  displayName: 'Account B', role: 'patient', detail: 'plain', landing: '/',
  interests: [], theme: 'light', graphView: 'graph', showAssistant: false,
}

let db: Pool
let a: APIRequestContext
let b: APIRequestContext
let admin: APIRequestContext
let guest: APIRequestContext
let userA: string
let userB: string
let userAdmin: string
let nodeId: string
let countsBefore: Record<string, number>

async function graphCounts() {
  const counts: Record<string, number> = {}
  for (const table of graphTables) {
    const result = await db.query<{ count: string }>(`select count(*)::text as count from public.${table}`)
    counts[table] = Number(result.rows[0]?.count)
  }
  return counts
}

async function register(context: APIRequestContext, label: string, profile: AccountProfile) {
  const response = await context.post('/api/account/register', {
    headers: { origin },
    data: { email: `pathnet-account-${marker}-${label}@example.test`, password, profile, role: 'admin', userId: 'untrusted-id' },
  })
  expect(response.status()).toBe(201)
  const payload = await response.json() as AccountSession
  if (!payload.user) throw new Error('The temporary account could not be created.')
  ownedUsers.add(payload.user.id)
  return payload
}

async function asSubject<T>(userId: string, work: (client: PoolClient) => Promise<T>) {
  const client = await db.connect()
  try {
    await client.query('begin')
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })])
    await client.query('set local role authenticated')
    const result = await work(client)
    await client.query('rollback')
    return result
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally { client.release() }
}

test.describe.serial('live account security and database isolation', () => {
  test.beforeAll(async () => {
    loadEnvConfig(process.cwd(), true, { info: () => undefined, error: () => undefined })
    const connectionString = process.env.PATHNET_ACCOUNT_DATABASE_URL
    if (!connectionString) throw new Error('Configure the server-only account database before running live account tests.')
    db = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000 })
    countsBefore = await graphCounts()
    const node = await db.query<{ id: string }>("select id from public.nodes where type = 'disease' order by id limit 1")
    if (!node.rows[0]) throw new Error('A disease node is required for live account tests.')
    nodeId = node.rows[0].id
    a = await requests.newContext({ baseURL })
    b = await requests.newContext({ baseURL })
    admin = await requests.newContext({ baseURL })
    guest = await requests.newContext({ baseURL })
    const first = await register(a, 'a', profileA)
    const second = await register(b, 'b', profileB)
    const third = await register(admin, 'admin', { ...profileB, displayName: 'Operator-provisioned fixture' })
    userA = first.user!.id
    userB = second.user!.id
    userAdmin = third.user!.id
    // This exact newly-created fixture is granted admin by an operator, never via signup.
    await db.query("update public.user_roles set role = 'admin' where user_id = $1", [userAdmin])
  })

  test.afterAll(async () => {
    if (db) {
      try {
        for (const id of ownedEdges) await db.query('delete from public.edges where id = $1', [id])
        for (const id of ownedUsers) {
          await db.query('delete from public.user_roles where user_id = $1', [id])
          await db.query('delete from pathnet_private.accounts where id = $1', [id])
        }
        if (countsBefore) expect(await graphCounts()).toEqual(countsBefore)
      } finally { await db.end() }
    }
    for (const context of [a, b, admin, guest]) await context?.dispose()
  })

  test('signup grants family only; a persona preference cannot grant admin', async () => {
    const session = await (await a.get('/api/account/session?role=admin')).json() as AccountSession
    expect(session.user?.role).toBe('family')
    expect(session.profile?.role).toBe('researcher')
    expect(session.roleStatus).toBe('pending')
    expect(session.permissions).toEqual({ canAdmin: false, canContribute: false, canReadProfessionalContacts: false })

    const response = await guest.post('/api/account/register', {
      headers: { origin }, data: { email: `pathnet-account-${marker}-rejected@example.test`, password, profile: { ...profileB, role: 'admin' } },
    })
    expect(response.status()).toBe(400)
    const rows = await db.query('select id from pathnet_private.accounts where email = $1', [`pathnet-account-${marker}-rejected@example.test`])
    expect(rows.rows).toHaveLength(0)

    const escalation = await a.patch('/api/account/profile', { headers: { origin }, data: { profile: { ...profileA, role: 'admin' } } })
    expect(escalation.status()).toBe(400)
    expect((await (await a.get('/api/account/session')).json()).user.role).toBe('family')
  })

  test('profiles persist per identity and injected target IDs cannot change account B', async () => {
    const nextProfile = { ...profileA, displayName: 'Saved Account A', interests: [nodeId], detail: 'plain' as const }
    const response = await a.patch('/api/account/profile', {
      headers: { origin }, data: { profile: { ...nextProfile, userId: userB, user_id: userB, verifiedRole: 'admin' }, userId: userB, role: 'admin' },
    })
    expect(response.status()).toBe(200)
    const saved = await response.json() as AccountSession
    expect(saved.user?.id).toBe(userA)
    expect(saved.user?.role).toBe('family')
    expect(saved.profile).toEqual(nextProfile)
    expect((await (await a.get('/api/account/session')).json()).profile).toEqual(nextProfile)
    expect((await (await b.get('/api/account/session')).json()).profile).toEqual(profileB)

    // Database RLS independently blocks reads/writes to another person's profile.
    await asSubject(userA, async (client) => {
      const own = await client.query<{ user_id: string }>('select user_id from public.account_profiles')
      expect(own.rows.map((row) => row.user_id)).toEqual([userA])
      const changed = await client.query('update public.account_profiles set profile = profile where user_id = $1 returning user_id', [userB])
      expect(changed.rows).toHaveLength(0)
    })
    const stored = await db.query<{ role: string }>('select role from public.user_roles where user_id = any($1::uuid[])', [[userA, userB]])
    expect(stored.rows.map((row) => row.role)).toEqual(['family', 'family'])
  })

  test('unknown interests, private resources and cross-origin changes are rejected', async () => {
    const badInterest = await a.patch('/api/account/profile', {
      headers: { origin }, data: { profile: { ...profileA, interests: [`dis_account_test_missing_${marker}`] } },
    })
    expect(badInterest.status()).toBe(400)
    for (const resource of ['account_profiles', 'user_roles', 'accounts', 'nodes;drop table nodes']) {
      expect((await a.get(`/api/account/graph?resource=${encodeURIComponent(resource)}`)).status()).toBe(400)
    }
    const crossOrigin = await a.patch('/api/account/profile', { headers: { origin: 'https://outside.example.test' }, data: { profile: profileA } })
    expect(crossOrigin.status()).toBe(403)
    const forged = { cookie: 'pathnet_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }
    expect((await (await guest.get('/api/account/session', { headers: forged })).json()).user).toBeNull()
    expect((await guest.patch('/api/account/profile', { headers: { ...forged, origin }, data: { profile: profileB } })).status()).toBe(401)
  })

  test('graph and evidence use the stored role; an admin query parameter has no effect', async () => {
    const edgeId = `e_account_test_${marker}`
    ownedEdges.add(edgeId)
    await db.query(`insert into public.edges(id,src,dst,type,tier,confidence,stance,status,note)
      select $1,src,dst,type,'D',confidence,stance,'unverified','Temporary account RLS test; removed after test'
      from public.edges where status = 'verified' order by id limit 1`, [edgeId])
    await db.query(`insert into public.evidence(id,edge_id,source_type,source_url,pmid,snippet,retrieved_at)
      select $1,$2,source_type,source_url,pmid,snippet,retrieved_at
      from public.evidence order by id limit 1`, [`ev_account_test_${marker}`, edgeId])

    for (const context of [guest, a, b]) {
      const edges = await (await context.get('/api/account/graph?resource=edges&role=admin')).json() as { id: string }[]
      expect(edges.some((edge) => edge.id === edgeId)).toBe(false)
      const evidence = await (await context.get('/api/account/graph?resource=evidence&role=admin')).json() as { edge_id: string }[]
      expect(evidence.some((item) => item.edge_id === edgeId)).toBe(false)
    }
    const adminSession = await (await admin.get('/api/account/session')).json() as AccountSession
    expect(adminSession.user?.role).toBe('admin')
    expect(adminSession.permissions?.canAdmin).toBe(true)
    const adminEdges = await (await admin.get('/api/account/graph?resource=edges')).json() as { id: string }[]
    expect(adminEdges.some((edge) => edge.id === edgeId)).toBe(true)
    const adminEvidence = await (await admin.get('/api/account/graph?resource=evidence')).json() as { edge_id: string }[]
    expect(adminEvidence.some((item) => item.edge_id === edgeId)).toBe(true)
  })

  test('cookies are HttpOnly and the old session cannot be reused after logout', async () => {
    const state = await a.storageState()
    const cookie = state.cookies.find((item) => item.name === 'pathnet_session')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
    if (!cookie) throw new Error('A temporary account session cookie is required.')
    const oldCookie = `pathnet_session=${cookie.value}`
    const logout = await a.post('/api/account/logout', { headers: { origin }, data: {} })
    expect(logout.status()).toBe(200)
    expect(logout.headers()['set-cookie']).toContain('Max-Age=0')
    expect((await (await guest.get('/api/account/session', { headers: { cookie: oldCookie } })).json()).user).toBeNull()
    expect((await guest.patch('/api/account/profile', { headers: { cookie: oldCookie, origin }, data: { profile: profileA } })).status()).toBe(401)

    const login = await a.post('/api/account/login', {
      headers: { origin }, data: { email: `pathnet-account-${marker}-a@example.test`, password },
    })
    expect(login.status()).toBe(200)
    const session = await login.json() as AccountSession
    expect(session.user?.id).toBe(userA)
    expect(session.profile?.displayName).toBe('Saved Account A')
    expect((await a.storageState()).cookies.find((item) => item.name === 'pathnet_session')?.value).not.toBe(cookie.value)
    const invalidPassword = await guest.post('/api/account/login', {
      headers: { origin }, data: { email: `pathnet-account-${marker}-a@example.test`, password: 'incorrect-password' },
    })
    expect(invalidPassword.status()).toBe(401)
  })
})
