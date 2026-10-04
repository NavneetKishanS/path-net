// Real operator CLI round-trips against isolated PostgreSQL WASM; no DATABASE_URL reuse.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const modules = process.env.P4_TEST_NODE_MODULES ?? path.join(root, '.venv/p4-db-test/node_modules');
const require = createRequire(path.join(modules, '_resolver.cjs'));
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const python = process.env.P4_TEST_PYTHON ?? path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const graph = JSON.parse(await readFile(path.join(root, 'data/seed/graph.json'), 'utf8'));
const db = new PGlite();
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
async function run(command, args = []) {
  await new Promise((resolve, reject) => {
    const child = spawn(python, ['scripts/platform.py', command, ...args], {
      cwd: root, windowsHide: true, stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`, DATA_DIR: path.join(root, 'data') },
    });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} failed (${code})`)));
  });
  await db.exec('DEALLOCATE ALL');
}
try {
  // Model the original Docker database with 0001 already present and no ledger.
  await db.exec(await readFile(path.join(root, 'supabase/migrations/0001_graph.sql'), 'utf8'));
  await server.start();
  await run('migrate');
  await run('migrate');
  assert.equal((await db.query('select count(*)::int as n from pathnet_private.migrations')).rows[0].n, 2);
  await run('seed');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build_platform_cache.mjs'], { cwd: root, windowsHide: true, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`cache builder failed (${code})`)));
  });
  await run('cache');
  assert.equal((await db.query('select count(*)::int as n from explanation_cache')).rows[0].n, 20);
  const cacheBundle = JSON.parse(await readFile(path.join(root, '.venv/p4-platform-cache.json'), 'utf8'));
  for (const entry of cacheBundle.explanation_cache) {
    await db.query(`insert into explanation_cache(cache_key,edge_ids,audience,payload)
      values ($1,$2,$3,$4)`, [`stale_${entry.cache_key}`, entry.edge_ids, entry.audience, entry.payload]);
  }
  const firstPath = cacheBundle.explanation_cache.find(entry => entry.edge_ids.length > 1);
  // The same edges in a different order are a separate requested path.
  const unrelatedPath = { ...firstPath, cache_key: 'unrelated_ordered_path', edge_ids: [...firstPath.edge_ids].reverse() };
  await db.query(`insert into explanation_cache(cache_key,edge_ids,audience,payload)
    values ($1,$2,$3,$4)`, [unrelatedPath.cache_key, unrelatedPath.edge_ids, unrelatedPath.audience, unrelatedPath.payload]);
  assert.equal((await db.query('select count(*)::int as n from explanation_cache')).rows[0].n, 41);
  await run('cache');
  const refreshedCache = (await db.query('select cache_key,edge_ids,audience,payload from explanation_cache')).rows;
  assert.equal(refreshedCache.length, 21);
  assert.ok(!refreshedCache.some(entry => entry.cache_key.startsWith('stale_')));
  for (const entry of [...cacheBundle.explanation_cache, unrelatedPath]) {
    assert.deepEqual(refreshedCache.find(row => row.cache_key === entry.cache_key), entry);
  }
  await run('cache');
  assert.equal((await db.query('select count(*)::int as n from explanation_cache')).rows[0].n, 21);
  await db.exec(`insert into user_roles(user_id,role) values('10000000-0000-0000-0000-000000000001','admin')`);
  await db.exec(`set role authenticated; set request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001"}'`);
  const contribution = (await db.query(`select (submit_contribution('group_stxbp1_foundation','dis_stxbp1','group_disease','https://example.test/test-fixture','Synthetic operator reload test; not production evidence.')).id`)).rows[0].id;
  const edgeId = (await db.query("select (review_contribution($1,'approve','Test fixture only')).edge_id", [contribution])).rows[0].edge_id;
  await db.exec('reset role');
  await run('seed');
  assert.equal((await db.query('select count(*)::int as n from contributions')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int as n from user_roles')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int as n from edges where id=$1', [edgeId])).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int as n from edges')).rows[0].n, graph.edges.length + 1);
  assert.equal((await db.query("select payload->>'graph_sha256' as digest from coverage_cache where cache_key='p1-slice-v1'")).rows[0].digest,
    JSON.parse(await readFile(path.join(root, 'data/seed/coverage.json'), 'utf8')).graph_sha256);
  await db.exec("update pathnet_private.migrations set sha256='changed' where name='0001_graph.sql'");
  await assert.rejects(() => run('migrate'), /migrate failed/);
  console.log('PASS: legacy database upgrade, idempotent migrations, seed upsert preserves approved contribution + role, 20 refreshed explanations replace stale keys and retain unrelated ordered paths, coverage snapshot, migration drift fails closed.');
} finally {
  await server.stop();
  await db.close();
}
