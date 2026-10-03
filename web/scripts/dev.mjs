// `npm run dev` on port 5173. Accepts `--host <addr>` because docker-compose passes it (a Vite flag).
import { spawn } from 'node:child_process'

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
const child = spawn('next', out, { stdio: 'inherit', shell: process.platform === 'win32' })
child.on('exit', (code) => process.exit(code ?? 0))
