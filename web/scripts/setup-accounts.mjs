// Run from web/. Adds account storage without changing any graph contract table.
import { readFile } from 'node:fs/promises'
import nextEnv from '@next/env'
import pg from 'pg'

nextEnv.loadEnvConfig(process.cwd())
const connectionString = process.env.PATHNET_ACCOUNT_DATABASE_URL
if (!connectionString) throw new Error('Configure server-only PATHNET_ACCOUNT_DATABASE_URL in web/.env.local first.')
const client = new pg.Client({ connectionString })
await client.connect()
try {
  await client.query('begin')
  await client.query("select pg_advisory_xact_lock(hashtext('pathnet-native-accounts'))")
  const before = await client.query(
    'select (select count(*) from nodes) nodes, (select count(*) from edges) edges, (select count(*) from evidence) evidence',
  )
  const exists = await client.query(
    "select to_regclass('pathnet_private.accounts') accounts, to_regclass('pathnet_private.account_sessions') sessions, to_regclass('public.account_profiles') profiles",
  )
  const tables = Object.values(exists.rows[0])
  if (tables.every(Boolean)) {
    console.log('Account tables already exist; preserving saved accounts and profiles.')
  } else if (tables.some(Boolean)) {
    throw new Error('Account migration is incomplete. Review the database before continuing.')
  } else {
    const sql = await readFile(new URL('../../supabase/migrations/0003_account_profiles.sql', import.meta.url), 'utf8')
    await client.query(sql)
    console.log('Added private accounts, sessions and own-row profile storage.')
  }
  const after = await client.query(
    'select (select count(*) from nodes) nodes, (select count(*) from edges) edges, (select count(*) from evidence) evidence',
  )
  if (JSON.stringify(before.rows) !== JSON.stringify(after.rows))
    throw new Error('Graph counts changed unexpectedly; rolling back.')
  await client.query('commit')
  console.log('Existing graph retained:', after.rows[0])
} catch (error) {
  await client.query('rollback')
  console.error(error instanceof Error ? error.message : 'Account setup failed.')
  process.exitCode = 1
} finally {
  await client.end()
}
