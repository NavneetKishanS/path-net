import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { buildCacheEntry, coverageReport, explainPath, RELATIONS, ROLES, validateClaims } from '../_shared/core.ts'
import type { GraphSlice } from '../_shared/core.ts'
import { createHandlers } from '../_shared/handlers.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'))
const full = read('data/seed/graph.json')
const graph: GraphSlice = { nodes: full.nodes, edges: full.edges, evidence: full.evidence }
const demo = read('data/seed/demo_paths.json')
const snapshot = read('data/seed/coverage.json')
const path = demo.primary_journey.ordered_path_edge_ids as string[]
const userId = '00000000-0000-4000-8000-000000000001'
const request = (body: unknown, jwt?: string) => new Request('http://localhost/functions/v1/test', { method: 'POST', headers: { 'content-type': 'application/json', ...(jwt ? { authorization: `Bearer ${jwt}` } : {}) }, body: JSON.stringify(body) })
const env = (extra: Record<string, string> = {}) => (name: string) => ({ SUPABASE_URL: 'https://local.example', SUPABASE_ANON_KEY: 'anon-key', ...extra } as Record<string, string>)[name]
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
function backend(role = 'researcher', options: { graph?: GraphSlice; cache?: unknown; model?: unknown; failModel?: boolean } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url: String(input), init })
    if (url.pathname === '/auth/v1/user') return init?.headers && (init.headers as Record<string, string>).Authorization === 'Bearer invalid' ? json({}, 401) : json({ id: userId })
    if (url.hostname === 'api.openai.com') {
      if (options.failModel) return json({ secret: 'must not leak' }, 500)
      return json(options.model || { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ claims: [claim] }) }] }] })
    }
    const table = url.pathname.split('/').at(-1)!
    if (table === 'user_roles') return json([{ role }])
    if (table === 'coverage_cache') return json([{ payload: snapshot }])
    if (table === 'explanation_cache') return json(options.cache ? [{ payload: options.cache }] : [])
    const source = options.graph || graph
    if (table in source) {
      const offset = Number(url.searchParams.get('offset') || 0)
      return json(source[table as keyof GraphSlice].slice(offset, offset + Number(url.searchParams.get('limit') || 500)))
    }
    throw new Error(`Unexpected request ${url}`)
  }) as typeof fetch
  return { calls, fetcher }
}
const abstract = 'STXBP1-related disorder is associated with STXBP1.'
const claim = { subject_type: 'disease', subject: 'STXBP1-related disorder', relation: 'disease_gene', object_type: 'gene', object: 'STXBP1', effect: 'not_applicable', stance: 'supports', quote: abstract, confidence: 0.99 }

test('platform relation endpoints stay identical to frozen graph contract', () => {
  const contract = read('contract/contract.json')
  assert.deepEqual(RELATIONS, Object.fromEntries(Object.entries(contract.edge_types).map(([key, spec]: [string, any]) => [key, [spec.from, spec.to]])))
})
test('coverage responses exactly match P1 Python helper on real seed queries', () => {
  for (const query of ['STXBP1', 'SCN2A', 'HP:0001250', demo.no_route.query, '']) {
    const localPython = resolve(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')
    const python = process.env.PYTHON || (existsSync(localPython) ? localPython : process.platform === 'win32' ? 'py' : 'python3')
    const result = spawnSync(python, ['pipeline/coverage_report.py', query], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, result.error?.message || result.stderr)
    assert.deepEqual(coverageReport(query, graph, snapshot), JSON.parse(result.stdout))
  }
})
test('P1 complete journey and network route have one cited scoped sentence per edge', () => {
  for (const ids of [path, demo.network_overlap.ordered_path_edge_ids]) {
    const result = explainPath(ids, 'STXBP1', graph)
    assert.equal(result.status, 'explained')
    if (result.status !== 'explained') return
    assert.equal(result.sentences.length, ids.length)
    assert.deepEqual(result.sentences.map(s => s.edge_ids[0]), ids)
    for (const s of result.sentences) assert.ok(s.evidence_ids.length > 0)
  }
})
test('unknown, empty, contradictory, unverified, uncited and disconnected paths fail closed', () => {
  for (const ids of [[], ['missing'], [demo.same_gene_different_mechanism.contradicting_edge_id], [path[0], demo.same_gene_different_mechanism.gain_edge_id]]) assert.equal(explainPath(ids, '', graph).status, 'no_supported_route')
  for (const override of [{ status: 'unverified' }, { stance: 'neutral' }, { tier: 'D' }]) {
    const changed = { ...graph, edges: graph.edges.map(e => e.id === path[0] ? { ...e, ...override } : e) } as GraphSlice
    assert.equal(explainPath([path[0]], '', changed).status, 'no_supported_route')
  }
  assert.equal(explainPath(path, '', { ...graph, evidence: [] }).status, 'no_supported_route')
})
test('tier C is always may/hypothesis and contradictions never become route support', () => {
  const id = demo.same_gene_different_mechanism.gain_edge_id
  const changed = { ...graph, edges: graph.edges.map(e => e.id === id ? { ...e, tier: 'C' as const } : e) }
  const result = explainPath([id], '', changed)
  assert.equal(result.status, 'explained')
  if (result.status !== 'explained') return
  assert.match(result.sentences[0].text, /Hypothesis.*may/)
  assert.equal(result.sentences[0].kind, 'hypothesis')
  assert.ok(!result.sentences.some(s => s.edge_ids.includes(demo.same_gene_different_mechanism.contradicting_edge_id)))
  const pending = { ...changed, edges: changed.edges.map(e => e.id === id ? { ...e, status: 'unverified' } : e) }
  assert.equal(explainPath([id], '', pending).status, 'no_supported_route')
})
test('claim validation rejects fabricated quotes, relations and endpoint types; preserves contradiction', () => {
  const output = validateClaims({ claims: [claim, { ...claim, quote: 'Invented quote' }, { ...claim, relation: 'cures' }, { ...claim, object_type: 'disease' }, { ...claim, stance: 'contradicts' }, { ...claim, quote: abstract.toUpperCase() }] }, abstract, '12345')
  assert.equal(output.claims.length, 2)
  assert.equal(output.dropped, 4)
  assert.equal(output.claims[1].stance, 'contradicts')
  assert.ok(output.claims.every(c => c.status === 'unverified' && c.tier === 'D' && c.confidence === null && !c.source_verified))
})
test('public coverage forwards anon credentials and refuses supplied graph/role injection', async () => {
  const mock = backend()
  const handlers = createHandlers(env(), mock.fetcher)
  assert.equal((await handlers.noRoute(request({ query: demo.no_route.query }))).status, 200)
  assert.ok(mock.calls.every(c => (c.init?.headers as Record<string, string>).Authorization === 'Bearer anon-key'))
  const bad = await handlers.explain(request({ edge_ids: path, graph: {}, role: 'admin' }))
  assert.equal(bad.status, 400)
})
test('caller JWT is forwarded to all graph, cache and role reads', async () => {
  const mock = backend()
  const response = await createHandlers(env(), mock.fetcher).explain(request({ edge_ids: path }, 'valid-user'))
  assert.equal(response.status, 200)
  assert.ok(mock.calls.every(c => (c.init?.headers as Record<string, string>).Authorization === 'Bearer valid-user'))
  assert.ok(mock.calls.every(c => (c.init?.headers as Record<string, string>).apikey === 'anon-key'))
})
test('model output cannot use inherited object property names as allowed relations', () => {
  for (const relation of ['__proto__', 'constructor', 'toString']) {
    const invalid = { relation, subject: 'STXBP1', object: 'test', quote: abstract, effect: 'unknown', stance: 'supports', confidence: null }
    assert.deepEqual(validateClaims({ claims: [invalid] }, abstract, '12345'), { claims: [], dropped: 1 })
  }
})
test('model enum values cannot be coerced from arrays, objects or null', () => {
  for (const field of ['stance', 'effect']) {
    for (const value of [null, {}, ['supports'], ['unknown'], 1]) {
      assert.deepEqual(validateClaims({ claims: [{ ...claim, [field]: value }] }, abstract, '12345'), { claims: [], dropped: 1 })
    }
  }
})
test('cache first uses valid persisted output and ignores poisoned output', async () => {
  const expected = explainPath(path, '', graph)
  for (const [cache, hit] of [[expected, 'hit'], [{ ...expected, sentences: [{ text: 'Uncited cure' }] }, 'miss']] as const) {
    const mock = backend('researcher', { cache })
    const result = await createHandlers(env(), mock.fetcher).explain(request({ edge_ids: path }))
    assert.equal((await result.json()).cache, hit)
    assert.ok(!mock.calls.some(c => c.url.includes('openai')))
  }
})
test('cache hash changes with evidence, role or visibility and ignores JSONB object key ordering', async () => {
  const first = await buildCacheEntry(path, graph)
  const reordered = JSON.parse(JSON.stringify(graph), (_, value) => value && !Array.isArray(value) && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse()) : value)
  assert.equal(first?.cache_key, (await buildCacheEntry(path, reordered))?.cache_key)
  assert.notEqual(first?.cache_key, (await buildCacheEntry(path, graph, 'admin'))?.cache_key)
  const changed = structuredClone(graph)
  changed.evidence[0].snippet += ' updated'
  assert.notEqual(first?.cache_key, (await buildCacheEntry(path, changed))?.cache_key)
})
test('prebuilt demo cache matches live handler for every role under current graph RLS', async () => {
  const built = spawnSync(process.execPath, ['scripts/build_platform_cache.mjs'], { cwd: root, encoding: 'utf8' })
  assert.equal(built.status, 0, built.stderr)
  const bundle = read('.venv/p4-platform-cache.json')
  assert.equal(bundle.explanation_cache.length, ROLES.length * 4)
  assert.deepEqual(bundle.coverage_cache[0].payload, snapshot)
  for (const role of ROLES) {
    const visibleEdges = graph.edges.filter(e => role === 'admin' || e.status === 'verified')
    const edgeIds = new Set(visibleEdges.map(e => e.id))
    const visibleGraph = { nodes: graph.nodes, edges: visibleEdges, evidence: graph.evidence.filter(e => edgeIds.has(e.edge_id)) }
    for (const entry of bundle.explanation_cache.filter((e: any) => e.audience === role)) {
      assert.equal(entry.cache_key, (await buildCacheEntry(entry.edge_ids, visibleGraph, role))?.cache_key)
      const mock = backend(role, { graph: visibleGraph, cache: entry.payload })
      const payload = await (await createHandlers(env(), mock.fetcher).explain(request({ edge_ids: entry.edge_ids }, 'valid-user'))).json()
      assert.equal(payload.cache, 'hit', `${role} ${entry.edge_ids.join(',')}`)
    }
  }
})
test('graph pagination preserves records beyond the first REST page', async () => {
  const expanded = { ...graph, nodes: Array.from({ length: 503 }, (_, i) => ({ ...graph.nodes[0], id: `pagination_${i}`, name: `pagination node ${i}`, synonyms: [], ext_ids: {} })) }
  const mock = backend('family', { graph: expanded })
  const payload = await (await createHandlers(env(), mock.fetcher).noRoute(request({ query: 'pagination node 502' }))).json()
  assert.deepEqual(payload.matched_node_ids, ['pagination_502'])
  assert.ok(mock.calls.some(c => c.url.includes('nodes?') && c.url.includes('offset=500')))
})
test('cache outage keeps deterministic explanation available without claiming a cache hit', async () => {
  const mock = backend()
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => String(input).includes('_cache') ? json({}, 503) : mock.fetcher(input, init)) as typeof fetch
  const result = await (await createHandlers(env(), fetcher).explain(request({ edge_ids: path }))).json()
  assert.equal(result.status, 'explained')
  assert.equal(result.cache, 'miss')
})
test('empty explanation returns P1 coverage; hidden edge cache never bypasses RLS', async () => {
  const mock = backend('family', { graph: { ...graph, edges: [] }, cache: explainPath(path, '', graph) })
  const handlers = createHandlers(env(), mock.fetcher)
  const unsupported = await (await handlers.explain(request({ edge_ids: path }))).json()
  assert.equal(unsupported.status, 'no_supported_route')
  assert.ok(!mock.calls.some(c => c.url.includes('explanation_cache')))
  const empty = await (await handlers.explain(request({ edge_ids: [], query: demo.no_route.query }))).json()
  assert.equal(empty.reason, 'empty_path')
  assert.deepEqual(Object.keys(empty.coverage).sort(), Object.keys(coverageReport('', graph)).sort())
})
test('extraction authenticates and blocks family/scout even with OpenAI configured', async () => {
  const config = env({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL_EXTRACT: 'test-model' })
  for (const role of ['family', 'scout']) {
    const mock = backend(role)
    const handlers = createHandlers(config, mock.fetcher)
    assert.equal((await handlers.extract(request({ abstract, pmid: '12345' }))).status, 401)
    assert.equal((await handlers.extract(request({ abstract, pmid: '12345' }, 'valid-user'))).status, 403)
    assert.equal((await handlers.extract(request({ abstract, pmid: '12345' }, 'invalid'))).status, 401)
    assert.ok(!mock.calls.some(c => c.url.includes('openai')))
  }
})
test('unconfigured extraction returns no invented drafts or writes', async () => {
  const mock = backend()
  const result = await (await createHandlers(env(), mock.fetcher).extract(request({ abstract, pmid: '12345' }, 'valid-user'))).json()
  assert.equal(result.status, 'unavailable')
  assert.deepEqual(result.claims, [])
  assert.ok(mock.calls.every(c => !c.init?.method || c.init.method === 'GET'))
})
test('configured extraction returns pending draft, caches per user, and never writes to Supabase', async () => {
  const mock = backend()
  const handlers = createHandlers(env({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL_EXTRACT: 'test-model' }), mock.fetcher)
  const first = await (await handlers.extract(request({ abstract, pmid: '12345' }, 'valid-user'))).json()
  assert.equal(first.status, 'pending_review')
  assert.equal(first.claims[0].tier, 'D')
  const second = await (await handlers.extract(request({ abstract, pmid: '12345' }, 'valid-user'))).json()
  assert.equal(second.cache, 'hit')
  const calls = mock.calls.filter(c => c.url.includes('api.openai.com'))
  assert.equal(calls.length, 1)
  const body = JSON.parse(calls[0].init!.body as string)
  assert.equal(body.text.format.type, 'json_schema')
  assert.equal(body.store, false)
  assert.ok(mock.calls.filter(c => c.url.includes('local.example')).every(c => !c.init?.method || c.init.method === 'GET'))
})
test('upstream failure, refusals and incomplete extraction fail closed', async () => {
  for (const options of [{ failModel: true }, { model: { status: 'incomplete' } }, { model: { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] } }]) {
    const mock = backend('researcher', options)
    const result = await (await createHandlers(env({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL_EXTRACT: 'test-model' }), mock.fetcher).extract(request({ abstract, pmid: '12345' }, 'valid-user'))).json()
    assert.equal(result.status, 'unavailable')
    assert.deepEqual(result.claims, [])
    assert.ok(!JSON.stringify(result).includes('secret'))
  }
})
test('HTTP boundaries enforce origin, method, malformed and oversized requests', async () => {
  const handler = createHandlers(env(), backend().fetcher).noRoute
  assert.equal((await handler(new Request('http://localhost', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }))).status, 204)
  assert.equal((await handler(new Request('http://localhost', { headers: { origin: 'https://evil.example' } }))).status, 403)
  assert.equal((await handler(new Request('http://localhost'))).status, 405)
  assert.equal((await handler(new Request('http://localhost', { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } }))).status, 400)
  assert.equal((await handler(request({ query: 'x'.repeat(71000) }))).status, 413)
})
