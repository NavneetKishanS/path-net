// Copies the seed graph into public/ so the app can run with no backend (VITE_DATA_SOURCE=static).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../data/seed/graph.json')
const dst = resolve(here, '../public/graph.json')
if (existsSync(src)) {
  mkdirSync(dirname(dst), { recursive: true })
  copyFileSync(src, dst)
  console.log('seed copied to public/graph.json')
} else {
  console.warn('data/seed/graph.json not found; static mode will have no data')
}
