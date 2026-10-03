// Pins P1's verified data slice into src/data/slice/ for the mock adapter.
// Reads straight from git so nothing outside web/ is modified:
//   node scripts/pin-slice.mjs [ref]      (default ref: origin/p1/data)
// Adds real PubMed titles from the same commit's data/raw/pubmed/<PMID>.json. Writes nothing it cannot source.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ref = process.argv[2] ?? 'origin/p1/data'
const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../src/data/slice')
const git = (...args) => execFileSync('git', args, { cwd: resolve(here, '../..'), encoding: 'utf8', maxBuffer: 64e6 })
const show = (path) => git('show', `${ref}:${path}`)

const commit = git('rev-parse', ref).trim()
const graph = JSON.parse(show('data/seed/graph.json'))
const coverage = JSON.parse(show('data/seed/coverage.json'))
const demoPaths = JSON.parse(show('data/seed/demo_paths.json'))

const titles = {}
for (const ev of graph.evidence) {
  if (!ev.pmid || titles[ev.pmid]) continue
  try {
    const rec = JSON.parse(show(`data/raw/pubmed/${ev.pmid}.json`))
    if (rec.title) titles[ev.pmid] = { title: rec.title, authors: (rec.authors ?? []).slice(0, 3) }
  } catch {
    // No cached record: the UI falls back to "PubMed PMID <id>".
  }
}

mkdirSync(out, { recursive: true })
const write = (name, data) => writeFileSync(resolve(out, name), JSON.stringify(data, null, 1) + '\n')
write('graph.json', graph)
write('coverage.json', coverage)
write('demo-paths.json', demoPaths)
write('pubmed-titles.json', titles)
write('pin.json', { source_ref: ref, source_commit: commit, graph_sha256: coverage.graph_sha256, snapshot_date: coverage.snapshot_date, pinned_at: new Date().toISOString().slice(0, 10) })
console.log(`pinned ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${Object.keys(titles).length} PubMed titles from ${ref} (${commit.slice(0, 7)})`)
