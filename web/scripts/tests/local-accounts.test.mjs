import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { localAccountEnvironment, prepareLocalAccounts } from '../local-accounts.mjs'

const compose = {
  services: {
    db: { environment: { POSTGRES_DB: 'pathnet', POSTGRES_PASSWORD: 'local-test-only' }, ports: [{ target: 5432, published: '55432', host_ip: '127.0.0.1' }] },
    api: { ports: [{ target: 3000, published: '53001', host_ip: '127.0.0.1' }] },
    web: { ports: [{ target: 5173, published: '55173', host_ip: '127.0.0.1' }] },
  },
}

async function fixture(t) {
  const temporaryRoot = resolve(tmpdir())
  const root = await mkdtemp(join(temporaryRoot, 'pathnet-accounts-bootstrap-'))
  assert.equal(dirname(root), temporaryRoot, 'cleanup must remain inside the temporary directory')
  const webDir = join(root, 'web')
  await mkdir(webDir)
  t.after(() => rm(root, { recursive: true, force: true }))
  const calls = []
  const run = async (args, options) => {
    calls.push({ args, cwd: options.cwd })
    return options.capture ? JSON.stringify(compose) : ''
  }
  const connections = []
  const initializeStorage = async (url) => {
    connections.push(url)
    return { status: 'existing', graphCounts: { nodes: 1, edges: 0, evidence: 0 } }
  }
  return { webDir, root, calls, connections, run, initializeStorage, log: () => undefined }
}

test('a fresh checkout provisions the local stack with resolved ports and restarts it after a stop', async (t) => {
  const setup = await fixture(t)
  const env = {}
  await prepareLocalAccounts({ ...setup, env })
  assert.equal(setup.connections[0], 'postgresql://postgres:local-test-only@127.0.0.1:55432/pathnet?sslmode=disable')
  assert.equal(env.NEXT_PUBLIC_API_URL, 'http://127.0.0.1:53001')
  assert.equal(env.PORT, '55173')
  assert.equal(env.NEXT_PUBLIC_ACCOUNT_PROXY, 'true')
  assert.equal(env.NEXT_PUBLIC_DATA_SOURCE, 'rest')
  const config = await readFile(join(setup.webDir, '.env.local'), 'utf8')
  assert.match(config, /PATHNET_ACCOUNT_LOCAL="true"/)
  assert.doesNotMatch(config, /^PORT=/m, 'the web port is resolved again on each startup')
  assert.deepEqual(setup.calls[1].args, ['compose', 'up', '-d', 'db', 'api'])
  assert.equal(setup.calls[1].cwd, setup.root)

  await prepareLocalAccounts({ ...setup, env })
  assert.equal(setup.calls.length, 4, 'a generated connection must still restart the managed Docker stack')
  assert.equal(await readFile(join(setup.webDir, '.env.local'), 'utf8'), config)
})

test('explicit database configuration retains the file and never starts Docker', async (t) => {
  const setup = await fixture(t)
  const original = 'PATHNET_ACCOUNT_DATABASE_URL=operator-managed\nNEXT_PUBLIC_DATA_SOURCE=mock\n'
  await writeFile(join(setup.webDir, '.env.local'), original)
  const env = { PATHNET_ACCOUNT_DATABASE_URL: 'postgresql://operator@database/pathnet', NEXT_PUBLIC_DATA_SOURCE: 'mock' }
  const result = await prepareLocalAccounts({ ...setup, env })
  assert.equal(result.mode, 'configured')
  assert.equal(setup.calls.length, 0)
  assert.deepEqual(setup.connections, [env.PATHNET_ACCOUNT_DATABASE_URL])
  assert.equal(env.NEXT_PUBLIC_DATA_SOURCE, 'mock')
  assert.equal(await readFile(join(setup.webDir, '.env.local'), 'utf8'), original)
})

test('container or shell configuration wins over a generated local marker', async (t) => {
  const setup = await fixture(t)
  const env = { PATHNET_ACCOUNT_LOCAL: 'true', PATHNET_ACCOUNT_DATABASE_URL: 'postgresql://server@db:5432/pathnet' }
  await prepareLocalAccounts({ ...setup, env, explicitDatabase: true })
  assert.equal(setup.calls.length, 0, 'the web container must not try to run nested Docker')
  assert.deepEqual(setup.connections, [env.PATHNET_ACCOUNT_DATABASE_URL])
})

test('an unrelated local configuration is preserved while the running process receives local account settings', async (t) => {
  const setup = await fixture(t)
  const original = 'CUSTOM_SETTING=keep-me\n'
  await writeFile(join(setup.webDir, '.env.local'), original)
  const env = { PORT: '56173' }
  await prepareLocalAccounts({ ...setup, env })
  assert.equal(await readFile(join(setup.webDir, '.env.local'), 'utf8'), original)
  assert.equal(env.NEXT_PUBLIC_ACCOUNT_PROXY, 'true')
  assert.ok(env.PATHNET_ACCOUNT_DATABASE_URL)
  assert.equal(env.PORT, '56173', 'an explicit host port takes precedence')
})

test('startup failure leaves no misleading generated configuration', async (t) => {
  const setup = await fixture(t)
  const env = {}
  await assert.rejects(prepareLocalAccounts({ ...setup, env, initializeStorage: async () => { throw new Error('Database not ready') } }), /Database not ready/)
  await assert.rejects(readFile(join(setup.webDir, '.env.local')), { code: 'ENOENT' })
  assert.equal(env.PATHNET_ACCOUNT_DATABASE_URL, undefined)
})

test('disabling automatic preparation performs no database or configuration changes', async (t) => {
  const setup = await fixture(t)
  assert.deepEqual(await prepareLocalAccounts({ ...setup, env: { PATHNET_ACCOUNT_BOOTSTRAP: 'false' } }), { mode: 'disabled' })
  assert.equal(setup.calls.length, 0)
  assert.equal(setup.connections.length, 0)
  await assert.rejects(readFile(join(setup.webDir, '.env.local')), { code: 'ENOENT' })
})

test('local configuration encodes credentials and rejects missing or exposed database ports', () => {
  const special = structuredClone(compose)
  special.services.db.environment.POSTGRES_PASSWORD = 'test:p@ss/$value'
  assert.match(localAccountEnvironment(special).PATHNET_ACCOUNT_DATABASE_URL, /test%3Ap%40ss%2F%24value/)
  special.services.db.ports[0].host_ip = '0.0.0.0'
  assert.throws(() => localAccountEnvironment(special), /loopback/)
  delete special.services.db.ports[0].host_ip
  assert.throws(() => localAccountEnvironment(special), /loopback/)
  special.services.db.ports = []
  assert.throws(() => localAccountEnvironment(special), /fixed local port/)
})
