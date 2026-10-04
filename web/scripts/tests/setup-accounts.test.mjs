// Isolated PostgreSQL WASM only; no environment/database URL is read or reused.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { initializeAccountStorage } from '../account-migration.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const modules = process.env.P4_TEST_NODE_MODULES ?? path.join(root, '.venv/p4-db-test/node_modules')
const require = createRequire(path.join(modules, '_resolver.cjs'))
const { PGlite } = require('@electric-sql/pglite')
const names = ['0001_graph.sql', '0002_roles_rls.sql', '0003_account_profiles.sql']
const sql = await Promise.all(names.map((name) => readFile(path.join(root, 'supabase/migrations', name), 'utf8')))
const canonical = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
const digest = createHash('sha256').update(canonical(sql[2])).digest('hex')
const id = '10000000-0000-4000-8000-000000000001'
const profile = { displayName: 'Retained fixture', role: 'patient', detail: 'plain', landing: '/',
  interests: ['test-node'], theme: 'system', graphView: 'graph', showAssistant: true }

async function fixture(work, graphReady = true) {
  const db = new PGlite()
  const client = { query: async (text, values) => values?.length ? db.query(text, values) : (await db.exec(text)).at(-1) }
  try {
    if (graphReady) {
      await db.exec(sql[0])
      await db.exec(sql[1])
      await db.exec("insert into public.nodes(id,type,name) values ('test-node','disease','Test fixture')")
    }
    await work(db, client)
  } finally { await db.close() }
}

async function savedAccount(db) {
  await db.query('insert into pathnet_private.accounts(id,email,password_hash) values ($1,$2,$3)', [id, 'retained@example.test', 'test-hash'])
  await db.query("insert into public.user_roles(user_id,role) values ($1,'family')", [id])
  await db.query('insert into public.account_profiles(user_id,profile) values ($1,$2)', [id, profile])
  await db.query("insert into pathnet_private.account_sessions(token_hash,user_id,expires_at) values ($1,$2,now()+interval '7 days')", ['a'.repeat(64), id])
}

async function assertRetained(db) {
  assert.deepEqual((await db.query('select id,email,password_hash from pathnet_private.accounts')).rows,
    [{ id, email: 'retained@example.test', password_hash: 'test-hash' }])
  assert.deepEqual((await db.query('select profile from public.account_profiles')).rows, [{ profile }])
  assert.equal((await db.query('select count(*)::int n from pathnet_private.account_sessions')).rows[0].n, 1)
  assert.deepEqual((await db.query('select id,name from public.nodes')).rows, [{ id: 'test-node', name: 'Test fixture' }])
}

test('new account setup shares the platform lock/checksum ledger and repeated setup retains data', async () => {
  await fixture(async (db, client) => {
    const statements = []
    const recordingClient = { query: (text, values) => { statements.push(text); return client.query(text, values) } }
    const result = await initializeAccountStorage(recordingClient)
    assert.equal(result.status, 'created')
    assert.deepEqual(result.graphCounts, { nodes: 1, edges: 0, evidence: 0 })
    assert.ok(statements.includes('select pg_advisory_xact_lock(7340214)'))
    assert.deepEqual((await db.query('select name,sha256 from pathnet_private.migrations')).rows, [{ name: names[2], sha256: digest }])
    await savedAccount(db)
    assert.equal((await initializeAccountStorage(client)).status, 'existing')
    await assertRetained(db)
    assert.equal((await db.query('select count(*)::int n from pathnet_private.migrations')).rows[0].n, 1)
    // platform.py will observe this entry and skip SQL rather than creating the tables twice.
    assert.equal((await db.query('select sha256 from pathnet_private.migrations where name=$1', [names[2]])).rows[0].sha256, digest)
  })
})

test('legacy complete account tables are verified and adopted without changing saved users', async () => {
  await fixture(async (db, client) => {
    await db.exec(sql[2])
    await savedAccount(db)
    assert.equal((await initializeAccountStorage(client)).status, 'adopted')
    await assertRetained(db)
    assert.equal((await initializeAccountStorage(client)).status, 'existing')
  })
})

test('recorded account storage permits a later numbered migration to extend its schema', async () => {
  await fixture(async (db, client) => {
    await initializeAccountStorage(client)
    await savedAccount(db)
    const laterSql = 'alter table pathnet_private.accounts add column operator_note text'
    await db.exec(laterSql)
    await db.query('insert into pathnet_private.migrations(name,sha256) values ($1,$2)',
      ['0004_test_extension.sql', createHash('sha256').update(laterSql).digest('hex')])
    await db.query('update pathnet_private.accounts set operator_note=$1 where id=$2', ['Retain later migration data', id])
    assert.equal((await initializeAccountStorage(client)).status, 'existing')
    assert.equal((await db.query('select operator_note from pathnet_private.accounts where id=$1', [id])).rows[0].operator_note,
      'Retain later migration data')
    assert.equal((await db.query('select count(*)::int n from pathnet_private.migrations')).rows[0].n, 2)
    await assertRetained(db)
  })
})

test('an applied checksum mismatch fails closed and preserves existing accounts', async () => {
  await fixture(async (db, client) => {
    await initializeAccountStorage(client)
    await savedAccount(db)
    await db.query('update pathnet_private.migrations set sha256=$1 where name=$2', ['different-checksum', names[2]])
    await assert.rejects(initializeAccountStorage(client), /Applied migration changed/)
    await assertRetained(db)
    assert.equal((await db.query('select sha256 from pathnet_private.migrations')).rows[0].sha256, 'different-checksum')
  })
})

test('partial legacy schema is rejected and creates no misleading ledger', async () => {
  await fixture(async (db, client) => {
    await db.exec('create schema pathnet_private; create table pathnet_private.accounts(id uuid primary key)')
    await assert.rejects(initializeAccountStorage(client), /migration is incomplete/)
    assert.equal((await db.query("select to_regclass('pathnet_private.migrations') ledger")).rows[0].ledger, null)
    assert.equal((await db.query('select count(*)::int n from public.nodes')).rows[0].n, 1)
  })
})

test('a recorded migration with missing storage is rejected without recreating tables', async () => {
  await fixture(async (db, client) => {
    await initializeAccountStorage(client)
    await db.exec('drop table public.account_profiles; drop table pathnet_private.account_sessions; drop table pathnet_private.accounts')
    await assert.rejects(initializeAccountStorage(client), /migration is incomplete/)
    assert.equal((await db.query("select to_regclass('pathnet_private.accounts') accounts")).rows[0].accounts, null)
  })
})

for (const [label, change, error] of [
  ['wrong column nullability', 'alter table pathnet_private.accounts alter column password_hash drop not null', /columns/],
  ['missing email uniqueness', 'alter table pathnet_private.accounts drop constraint accounts_email_key', /constraints/],
  ['missing profile validation', 'alter table public.account_profiles drop constraint account_profiles_profile_check', /constraints/],
  ['disabled own-row RLS', 'alter table public.account_profiles disable row level security', /table security/],
  ['permissive profile policy', 'alter policy account_profile_own_read on public.account_profiles using (true)', /policies/],
  ['private schema exposed to a browser role', 'grant usage on schema pathnet_private to authenticated', /private-schema access/],
  ['password table exposed to a browser role', 'grant select on pathnet_private.accounts to anon', /browser privileges/],
]) {
  test(`legacy adoption rejects ${label}`, async () => {
    await fixture(async (db, client) => {
      await db.exec(sql[2])
      await db.exec(change)
      await assert.rejects(initializeAccountStorage(client), error)
      assert.equal((await db.query("select to_regclass('pathnet_private.migrations') ledger")).rows[0].ledger, null)
    })
  })
}

test('missing graph/platform prerequisites produces a useful error before changing schema', async () => {
  await fixture(async (db, client) => {
    await assert.rejects(initializeAccountStorage(client), /0001_graph.sql and 0002_roles_rls.sql/)
    assert.equal((await db.query("select exists(select from pg_namespace where nspname='pathnet_private') present")).rows[0].present, false)
  }, false)
})

test('graph-count guard rolls back newly-created account schema and its ledger', async () => {
  await fixture(async (db, client) => {
    let counts = 0
    const changedClient = { query: async (text, values) => {
      if (text.startsWith('select (select count(*)') && ++counts === 2) await db.exec("insert into nodes(id,type,name) values ('extra-fixture','disease','Changed graph fixture')")
      return client.query(text, values)
    } }
    await assert.rejects(initializeAccountStorage(changedClient), /Graph counts changed/)
    assert.equal((await db.query("select to_regclass('pathnet_private.accounts') accounts")).rows[0].accounts, null)
    assert.deepEqual((await db.query('select id from nodes')).rows, [{ id: 'test-node' }])
  })
})
