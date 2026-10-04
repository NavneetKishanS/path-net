// Run from web/. Adds account storage without changing any graph contract table.
import nextEnv from '@next/env'
import pg from 'pg'
import { initializeAccountStorage } from './account-migration.mjs'

nextEnv.loadEnvConfig(process.cwd())
const connectionString = process.env.PATHNET_ACCOUNT_DATABASE_URL
if (!connectionString) throw new Error('Configure server-only PATHNET_ACCOUNT_DATABASE_URL in web/.env.local first.')
const client = new pg.Client({ connectionString })
await client.connect()
try {
  const result = await initializeAccountStorage(client)
  console.log(result.status === 'created' ? 'Added private accounts, sessions and own-row profile storage.'
    : result.status === 'adopted' ? 'Verified existing account tables and recorded their migration; saved accounts preserved.'
      : 'Account migration already recorded; preserving saved accounts and profiles.')
  console.log('Existing graph retained:', result.graphCounts)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Account setup failed.')
  process.exitCode = 1
} finally {
  await client.end()
}
