// `npm run dev` on port 5173. Accepts `--host <addr>` because docker-compose passes it (a Vite flag).
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import nextEnv from '@next/env'
import { prepareLocalAccounts } from './local-accounts.mjs'

// Process-level configuration takes precedence over a generated local configuration.
const explicitDatabase = Boolean(process.env.PATHNET_ACCOUNT_DATABASE_URL?.trim())
nextEnv.loadEnvConfig(process.cwd(), true)
try {
  await prepareLocalAccounts({ webDir: process.cwd(), explicitDatabase })
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local account preparation failed.')
  process.exit(1)
}

const args = process.argv.slice(2)
const out = ['dev', '-p', process.env.PORT ?? '5173']
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--host') {
    const next = args[i + 1]
    out.push('-H', next && !next.startsWith('-') ? next : '0.0.0.0')
    if (next && !next.startsWith('-')) i++
  } else {
    out.push(args[i])
  }
}
const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), ...out], { stdio: 'inherit', env: process.env })
child.on('error', () => { console.error('The Next.js development server could not start.'); process.exit(1) })
child.on('exit', (code) => process.exit(code ?? 0))
