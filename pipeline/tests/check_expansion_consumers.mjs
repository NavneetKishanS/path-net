// Probe unchanged P3 rendering/static loader and P4 evidence/no-route behavior.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverageReport, explainPath } from '../../supabase/functions/_shared/core.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const modules = process.argv[2];
assert.ok(modules, 'Supply existing web/node_modules');
const require = createRequire(path.join(modules, '_expansion_resolver.cjs'));
const { transform, build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const read = async name => JSON.parse(await readFile(path.join(root, 'data/seed', `${name}.json`), 'utf8'));
const [graph, demo, coverage] = await Promise.all(['graph', 'demo_paths', 'coverage'].map(read));
const source = await readFile(path.join(root, 'web/src/api.ts'), 'utf8');
const compiled = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022',
  define: { 'import.meta.env': JSON.stringify({ VITE_DATA_SOURCE: 'static' }) } });
const oldFetch = globalThis.fetch;
globalThis.fetch = async url => {
  assert.equal(url, '/graph.json');
  return new Response(JSON.stringify(graph), { headers: { 'Content-Type': 'application/json' } });
};
try {
  const module = await import('data:text/javascript;base64,' + Buffer.from(compiled.code).toString('base64'));
  assert.deepEqual(await module.loadGraph(), graph);
} finally { globalThis.fetch = oldFetch; }

const bundle = await build({ entryPoints: [path.join(root, 'web/src/Panels.tsx')], bundle: true,
  write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic',
  nodePaths: [modules], logLevel: 'silent' });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, module, module.exports);
const { NodePanel, EdgePanel } = module.exports;
const selected = graph.nodes.find(n => n.id === 'study_nct01238250');
const edge = graph.edges.find(e => e.src === selected.id && e.dst === 'dis_stxbp1');
const nodeHtml = renderToStaticMarkup(React.createElement(NodePanel, { graph, node: selected, onEdge() {} }));
assert.ok(nodeHtml.includes('Simons Searchlight'));
assert.ok(nodeHtml.includes('Connections'));
const edgeHtml = renderToStaticMarkup(React.createElement(EdgePanel, { graph, edge }));
assert.ok(edgeHtml.includes('https://clinicaltrials.gov/study/NCT01238250'));
assert.ok(edgeHtml.includes('2026-10-03'));
assert.ok(!edgeHtml.includes('Placeholder:'));

assert.equal(coverageReport(demo.no_route.query, graph, coverage).status, 'no_supported_route');
const contrad = graph.edges.find(e => e.stance === 'contradicts');
assert.equal(explainPath([contrad.id], '', graph, coverage).status, 'no_supported_route');
for (const section of ['primary_journey', 'network_overlap']) {
  assert.equal(explainPath(demo[section].ordered_path_edge_ids, '', graph, coverage).status, 'explained');
}
const supported = coverageReport('SCN2A-related disorder', graph, coverage);
assert.equal(supported.status, 'matches_with_supported_connections');
assert.ok(!supported.supported_edge_ids.includes(contrad.id));
const result = { status: 'passed', unchanged_static_loadGraph: true, unchanged_new_node_and_evidence_panels: true,
  original_demo_paths_supported: true, no_route_and_contradiction_rules_preserved: true,
  browser_visual_acceptance: 'not performed; rendering and actual consumer functions checked offline' };
await writeFile(path.join(root, 'data/acceptance/expansion/consumers.json'), JSON.stringify(result, null, 2) + '\n');
console.log('PASS: static loadGraph, unchanged new-record panels, original P4 demo paths, no-route and contradictory-route exclusion.');
