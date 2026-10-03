// Run the unchanged P4 migration and seed loader against an isolated PostgreSQL WASM instance.
// Optional test dependencies: @electric-sql/pglite 0.5.8 and @electric-sql/pglite-socket 0.2.11.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const modules = process.env.P1_TEST_NODE_MODULES ?? path.join(root, '.venv/p1-db-test/node_modules');
const require = createRequire(path.join(modules, '_resolver.cjs'));
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const python = process.env.P1_TEST_PYTHON ?? (process.platform === 'win32' ? path.join(root, '.venv/Scripts/python.exe') : path.join(root, '.venv/bin/python'));
const graph = JSON.parse(await readFile(path.join(root, 'data/seed/graph.json'), 'utf8'));
const db = new PGlite();
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });

async function load() {
  const url = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`;
  await new Promise((resolve, reject) => {
    const child = spawn(python, ['pipeline/load_seed.py'], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url, DATA_DIR: path.join(root, 'data') },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`load_seed.py failed (${code})`)));
  });
}

try {
  await db.exec(await readFile(path.join(root, 'supabase/migrations/0001_graph.sql'), 'utf8'));
  await server.start();
  for (let attempt = 0; attempt < 2; attempt++) {
    await load();
    for (const table of ['nodes', 'edges', 'evidence', 'clusters', 'node_cluster']) {
      const columns = table === 'evidence' ? 'id,edge_id,source_type,source_url,pmid,snippet,retrieved_at::text' : '*';
      const { rows } = await db.query(`SELECT ${columns} FROM ${table}`);
      const sort = xs => [...xs].sort((a, b) => JSON.stringify(a.id ?? [a.node_id, a.cluster_id]).localeCompare(JSON.stringify(b.id ?? [b.node_id, b.cluster_id])));
      // PostgreSQL 'real' is float32; compare confidence using that same representation.
      const expected = table === 'edges' ? graph[table].map(e => ({ ...e, confidence: e.confidence === null ? null : Math.fround(e.confidence) })) : graph[table];
      const actual = table === 'edges' ? rows.map(e => ({ ...e, confidence: e.confidence === null ? null : Math.fround(e.confidence) })) : rows;
      assert.deepEqual(sort(actual), sort(expected), `${table} round-trip on load ${attempt + 1}`);
    }
    // The socket adapter shares one backend; mirror normal session teardown between clients.
    await db.exec('DEALLOCATE ALL');
  }
  await db.exec('SET ROLE anon');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM nodes')).rows[0].count, graph.nodes.length);
  await db.exec('RESET ROLE');
  console.log('PASS: migration, actual psycopg seed loader, two exact round-trips, and anon SELECT.');
} finally {
  await server.stop();
  await db.close();
}
