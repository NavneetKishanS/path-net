// Execute the unchanged frontend loadGraph() against a real PostgREST endpoint.
// TypeScript is transformed in memory using existing web dependencies; no app files change.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const api = new URL(args.get('--api-url'));
assert.ok(['127.0.0.1', 'localhost'].includes(api.hostname) && api.protocol === 'http:');
const require = createRequire(path.join(args.get('--web-modules'), '_p1_resolver.cjs'));
const { transform } = require('esbuild');
const source = await readFile(path.join(root, 'web/src/api.ts'), 'utf8');
const compiled = await transform(source, {
  loader: 'ts', format: 'esm', target: 'es2022',
  define: { 'import.meta.env': JSON.stringify({ VITE_DATA_SOURCE: 'rest', VITE_API_URL: api.origin }) },
});
const module = await import('data:text/javascript;base64,' + Buffer.from(compiled.code).toString('base64'));
assert.equal(module.DATA_SOURCE, 'rest');
const loaded = await module.loadGraph();
const expected = JSON.parse(await readFile(path.join(root, 'data/seed/graph.json'), 'utf8'));
const normalized = (rows, table) => rows.map(row => table === 'edges'
  ? { ...row, confidence: row.confidence === null ? null : Math.fround(row.confidence) } : row)
  .sort((a, b) => JSON.stringify(a.id ?? [a.node_id, a.cluster_id]).localeCompare(JSON.stringify(b.id ?? [b.node_id, b.cluster_id])));
assert.deepEqual(Object.keys(loaded).sort(), Object.keys(expected).sort());
for (const table of Object.keys(expected)) {
  assert.deepEqual(normalized(loaded[table], table), normalized(expected[table], table), `loadGraph ${table}`);
}
assert.ok(loaded.nodes.length >= 15 && !loaded.nodes.some(n => n.props.placeholder));
console.log('PASS: actual web/src/api.ts loadGraph(rest), all five tables exact, at least 15 real nodes.');
