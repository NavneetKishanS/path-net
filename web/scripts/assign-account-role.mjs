// Operator-only: user preferences never call this script.
import nextEnv from '@next/env'
import pg from 'pg'

nextEnv.loadEnvConfig(process.cwd())
const [emailInput, role] = process.argv.slice(2)
const roles = ['family', 'group_leader', 'scout', 'researcher', 'admin']
if (!emailInput || !roles.includes(role)) {
  console.error('Usage: npm run accounts:role -- <registered-email> <family|group_leader|scout|researcher|admin>')
  process.exit(1)
}
const connectionString = process.env.PATHNET_ACCOUNT_DATABASE_URL
if (!connectionString) throw new Error('Configure server-only PATHNET_ACCOUNT_DATABASE_URL first.')
const client = new pg.Client({ connectionString })
await client.connect()
try {
  const result = await client.query(
    `update public.user_roles r set role=$1
    from pathnet_private.accounts a where r.user_id=a.id and a.email=$2 returning r.user_id`,
    [role, emailInput.trim().toLowerCase()],
  )
  if (!result.rowCount) throw new Error('No registered account was found for this email.')
  console.log(`Assigned database role: ${role}. The account can refresh its session to use it.`)
} catch {
  console.error('Role assignment failed. Verify the registered account and operator database access.')
  process.exitCode = 1
} finally {
  await client.end()
}
