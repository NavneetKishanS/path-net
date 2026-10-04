#!/usr/bin/env node
// Node 24 runs the shared TypeScript with built-in type stripping; no model/key needed.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCacheEntry, ROLES } from '../supabase/functions/_shared/core.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
if (argv.length && (argv.length !== 2 || argv[0] !== '--output')) throw new Error('Usage: node scripts/build_platform_cache.mjs [--output FILE]')
const output = resolve(root, argv[1] || '.venv/p4-platform-cache.json')
const read = async name => JSON.parse(await readFile(resolve(root, `data/seed/${name}.json`), 'utf8'))
const [fullGraph, demo, coverage] = await Promise.all(['graph', 'demo_paths', 'coverage'].map(read))
// Match 0002 graph RLS. Contact routes live in a separate protected view.
const forRole = role => {
  const nodes = fullGraph.nodes
  const edges = fullGraph.edges.filter(e => role === 'admin' || e.status === 'verified')
  const edgeIds = new Set(edges.map(e => e.id))
  return { nodes, edges, evidence: fullGraph.evidence.filter(e => edgeIds.has(e.edge_id)) }
}
const explanation_cache = []
for (const role of ROLES) {
  const graph = forRole(role)
  for (const path of [demo.primary_journey.ordered_path_edge_ids, demo.network_overlap.ordered_path_edge_ids, [demo.same_gene_different_mechanism.gain_edge_id], [demo.same_gene_different_mechanism.loss_edge_id]]) {
    const entry = await buildCacheEntry(path, graph, role)
    if (entry) explanation_cache.push(entry)
  }
}
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify({ explanation_cache, coverage_cache: [{ cache_key: 'p1-slice-v1', audience: 'family', payload: coverage }] }, null, 2) + '\n')
console.log(`Built ${explanation_cache.length} scoped explanations and 1 coverage snapshot: ${output}`)
