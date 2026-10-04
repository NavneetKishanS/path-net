// Isolated PostgreSQL role attacks + exact P1 loader compatibility (no DATABASE_URL use).
// npm install --prefix .venv/p4-db-test --no-save --package-lock=false \
//   @electric-sql/pglite@0.5.8 @electric-sql/pglite-socket@0.2.11
// P4_TEST_NODE_MODULES / P4_TEST_PYTHON select existing local test runtimes.
// P1_TEST_* aliases remain supported for reuse of the P1 test installation.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const modules = process.env.P4_TEST_NODE_MODULES ?? process.env.P1_TEST_NODE_MODULES ?? path.join(root, '.venv/p4-db-test/node_modules');
const require = createRequire(path.join(modules, '_resolver.cjs'));
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const python = process.env.P4_TEST_PYTHON ?? process.env.P1_TEST_PYTHON ?? path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const graph = JSON.parse(await readFile(path.join(root, 'data/seed/graph.json'), 'utf8'));
const contract = JSON.parse(await readFile(path.join(root, 'contract/contract.json'), 'utf8'));
const migrations = await Promise.all(['0001_graph.sql', '0002_roles_rls.sql'].map(name =>
  readFile(path.join(root, 'supabase/migrations', name), 'utf8')));
const db = new PGlite();
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
const roles = ['family','group_leader','scout','researcher','admin','no_role','leader_peer','researcher_peer'];
const ids = Object.fromEntries(roles.map((role, index) => [role, `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
const org = '00000000-0000-4000-9000-000000000001';
const otherOrg = '00000000-0000-4000-9000-000000000002';
const sample = graph.edges.find(edge => edge.type === 'disease_gene');
const person = graph.nodes.find(node => node.type === 'person');
const evidence = graph.evidence.find(row => row.edge_id === sample.id);
let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions++; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
async function scalar(sql, params = []) { return Object.values((await db.query(sql, params)).rows[0])[0]; }
async function owner() { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claims', '', false)"); }
async function actor(role, extraClaims = {}) {
  await owner();
  await db.exec(`SET ROLE ${role === 'anon' ? 'anon' : 'authenticated'}`);
  await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({
    role: role === 'anon' ? 'anon' : 'authenticated', ...(ids[role] ? { sub: ids[role] } : {}), ...extraClaims,
  })]);
}
async function denied(sql, params = [], message = sql, codes = ['42501']) {
  try { await db.query(sql, params); assert.fail(`Unexpected success: ${message}`); }
  catch (error) { check(codes.includes(error.code), `${message}: expected ${codes}, got ${error.code}: ${error.message}`); }
}
async function submit(orgId = null, extra = {}) {
  const { rows } = await db.query(`SELECT * FROM public.submit_contribution(
    p_src => $1, p_dst => $2, p_type => $3, p_source_url => $4,
    p_snippet => $5, p_org_id => $6, p_stance => $7)`, [
    extra.src ?? sample.src, extra.dst ?? sample.dst, extra.type ?? sample.type,
    extra.url ?? evidence.source_url, extra.snippet ?? evidence.snippet,
    orgId, extra.stance ?? 'supports',
  ]);
  return rows[0];
}
async function load() {
  await owner();
  await new Promise((resolve, reject) => {
    const child = spawn(python, ['pipeline/load_seed.py'], {
      cwd: root, env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`, DATA_DIR: path.join(root, 'data') },
      stdio: 'inherit', windowsHide: true,
    });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`P1 seed loader failed (${code})`)));
  });
  for (const table of ['nodes','edges','evidence','clusters','node_cluster']) {
    const columns = table === 'evidence' ? 'id,edge_id,source_type,source_url,pmid,snippet,retrieved_at::text' : '*';
    const { rows } = await db.query(`SELECT ${columns} FROM public.${table}`);
    const normalize = entries => entries.map(entry => table === 'edges' ? { ...entry, confidence: entry.confidence === null ? null : Math.fround(entry.confidence) } : entry)
      .sort((a,b) => JSON.stringify(a.id ?? [a.node_id,a.cluster_id]).localeCompare(JSON.stringify(b.id ?? [b.node_id,b.cluster_id])));
    equal(normalize(rows), normalize(graph[table]), `${table} exact P1 round-trip`);
  }
  // Socket adapter reuses a backend, unlike ordinary independent psycopg clients.
  await db.exec('DEALLOCATE ALL');
}

try {
  await db.exec(migrations[0]);
  await db.exec(migrations[1]);
  const enumConstraint = await scalar("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='edges_contract_type_check'");
  equal([...enumConstraint.matchAll(/'([^']+)'::text/g)].map(match => match[1]).sort(), Object.keys(contract.edge_types).sort(), 'SQL relationship enum equals contract.json');
  await server.start();
  await load();
  await load();
  for (const role of roles.filter(role => role !== 'no_role')) {
    await db.query('INSERT INTO public.user_roles(user_id,role) VALUES ($1,$2)', [ids[role], role === 'leader_peer' ? 'group_leader' : role === 'researcher_peer' ? 'researcher' : role]);
  }
  await db.query('INSERT INTO public.organizations(id,name) VALUES ($1,$2),($3,$4)', [org, 'Test organization', otherOrg, 'Other test organization']);
  for (const role of ['group_leader','leader_peer','researcher']) {
    await db.query('INSERT INTO public.organization_members(user_id,org_id) VALUES ($1,$2)', [ids[role], org]);
  }
  await db.query(`INSERT INTO public.professional_contact_records(person_node_id,display_name,public_url,source_url)
    VALUES ($1,'Synthetic test contact','https://example.test/contact','https://example.test/source')`, [person.id]);
  await db.query(`INSERT INTO public.edges(id,src,dst,type,tier,status) VALUES
    ('test_pending',$1,$2,$3,'D','unverified'), ('test_rejected',$1,$2,$3,'D','rejected')`, [sample.src,sample.dst,sample.type]);
  await db.query(`INSERT INTO public.evidence(id,edge_id,snippet) VALUES ('test_pending_evidence','test_pending','private fixture'),('test_rejected_evidence','test_rejected','private fixture')`);
  await db.query(`INSERT INTO public.explanation_cache(cache_key,edge_ids,audience,payload) VALUES
    ('family-valid',ARRAY[$1],'family','{}'), ('researcher-valid',ARRAY[$1],'researcher','{}'),
    ('pending-leak',ARRAY['test_pending'],'family','{}'), ('missing-leak',ARRAY['missing_edge'],'family','{}')`, [sample.id]);
  await db.exec(`INSERT INTO public.coverage_cache(cache_key,audience,payload) VALUES ('family','family','{}'),('researcher','researcher','{}')`);

  for (const role of ['anon', ...roles.slice(0,6)]) {
    await actor(role);
    const isAdmin = role === 'admin';
    equal(await scalar('SELECT count(*)::int FROM public.edges'), graph.edges.length + (isAdmin ? 2 : 0), `${role}: graph visibility`);
    equal(await scalar('SELECT count(*)::int FROM public.evidence'), graph.evidence.length + (isAdmin ? 2 : 0), `${role}: evidence inherits edge RLS`);
    equal(await scalar("SELECT count(*)::int FROM public.edges WHERE stance='contradicts'"), graph.edges.filter(edge => edge.stance === 'contradicts').length, `${role}: contradictions preserved`);
    await denied("INSERT INTO public.edges(id,src,dst,type,tier) VALUES ('attack',$1,$2,$3,'D')", [sample.src,sample.dst,sample.type], `${role}: direct graph write`);
    await denied("INSERT INTO public.contributions(created_by,src,dst,type,source_url,snippet) VALUES ($1,$2,$3,$4,'https://example.test','test')", [ids.admin,sample.src,sample.dst,sample.type], `${role}: contribution impersonation`);
    await denied("INSERT INTO public.coverage_cache(cache_key,payload) VALUES ('poison','{}')", [], `${role}: cache poisoning`);
    const cacheKeys = (await db.query('SELECT cache_key FROM public.explanation_cache ORDER BY cache_key')).rows.map(row => row.cache_key);
    equal(cacheKeys, isAdmin ? ['family-valid','pending-leak','researcher-valid'] : role === 'researcher' ? ['family-valid','researcher-valid'] : ['family-valid'], `${role}: explanation audience and current graph RLS`);
    equal(await scalar('SELECT count(*)::int FROM public.coverage_cache'), ['admin','researcher'].includes(role) ? 2 : 1, `${role}: coverage audience`);
    if (role === 'anon') {
      await denied('SELECT * FROM public.professional_contacts', [], 'anon: contacts view denied');
      await denied('SELECT * FROM public.professional_contact_records', [], 'anon: base contacts denied');
      await denied('SELECT * FROM public.user_roles', [], 'anon: role directory denied');
    } else {
      const contacts = ['family','no_role'].includes(role) ? 0 : 1;
      equal(await scalar('SELECT count(*)::int FROM public.professional_contacts'), contacts, `${role}: contact view`);
      equal(await scalar('SELECT count(*)::int FROM public.professional_contact_records'), contacts, `${role}: direct table cannot bypass view`);
      equal(await scalar('SELECT count(*)::int FROM public.user_roles'), isAdmin ? 7 : role === 'no_role' ? 0 : 1, `${role}: only own role / admin directory`);
    }
  }

  for (const role of ['family','group_leader','scout','researcher','no_role']) {
    await actor(role, { user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' }, pathnet_role: 'admin' });
    equal(await scalar('SELECT public.pathnet_role()'), role === 'no_role' ? null : role, `${role}: forged metadata ignored`);
    equal(await scalar("WITH modified AS (UPDATE public.user_roles SET role='admin' WHERE user_id=$1 RETURNING *) SELECT count(*)::int FROM modified", [ids[role]]), 0, `${role}: own role escalation blocked`);
    await denied("INSERT INTO public.user_roles(user_id,role) VALUES ('00000000-0000-4000-8000-000000009999','admin')", [], `${role}: create admin denied`);
    await denied('INSERT INTO public.organization_members(user_id,org_id) VALUES ($1,$2)', [ids[role],otherOrg], `${role}: self-enroll in organization denied`);
    await denied("INSERT INTO public.professional_contact_records(person_node_id,display_name,public_url,source_url) VALUES ($1,'attack','https://example.test','https://example.test')", [person.id], `${role}: contact write denied`);
  }
  for (const role of ['anon','family','scout','no_role']) {
    await actor(role);
    try { await submit(); assert.fail(`${role} unexpectedly submitted`); }
    catch (error) { equal(error.code, '42501', `${role}: submit role enforced`); }
  }

  await actor('group_leader');
  const own = await submit(org);
  equal(own.created_by, ids.group_leader, 'server binds contributor');
  equal([own.tier,own.status,own.edge_id], ['D','unverified',null], 'server binds pending tier/status');
  for (const [options, code, label] of [
    [{type:'invented_relation'}, '22023', 'unknown enum'],
    [{src:sample.dst,dst:sample.src}, '22023', 'wrong endpoint types'],
    [{src:'missing_node'}, '22023', 'nonexistent endpoint'],
    [{snippet:' '}, '22023', 'empty evidence quote'],
    [{url:'javascript:alert(1)'}, '22023', 'unsafe source URL'],
    [{stance:'invented_stance'}, '23514', 'invalid stance'],
  ]) {
    try { await submit(null, options); assert.fail(`Unexpected submission: ${label}`); }
    catch (error) { equal(error.code, code, label); }
  }
  try { await submit(otherOrg); assert.fail('Foreign organization submission succeeded'); }
  catch (error) { equal(error.code, '42501', 'foreign organization submission denied'); }
  await actor('leader_peer');
  equal(await scalar('SELECT count(*)::int FROM public.contributions WHERE id=$1', [own.id]), 1, 'group leader sees organization peer');
  const orgPeer = await submit(org);
  await actor('researcher');
  equal(await scalar('SELECT count(*)::int FROM public.contributions'), 0, 'researcher membership does not expose organization contributions');
  const research = await submit();
  try { await submit(org); assert.fail('Researcher org submission succeeded'); }
  catch (error) { equal(error.code, '42501', 'researcher cannot claim organization visibility'); }
  await actor('researcher_peer');
  equal(await scalar('SELECT count(*)::int FROM public.contributions'), 0, 'researcher cannot see peer pending');
  for (const role of ['family','scout','no_role']) {
    await actor(role);
    equal(await scalar('SELECT count(*)::int FROM public.contributions'), 0, `${role}: pending queue hidden`);
  }
  for (const role of ['group_leader','researcher','family','scout','no_role']) {
    await actor(role);
    await denied('SELECT * FROM public.review_contribution($1,\'approve\')', [own.id], `${role}: approve denied`);
    await denied("UPDATE public.contributions SET status='verified' WHERE id=$1", [own.id], `${role}: direct approval denied`);
  }

  await actor('admin');
  equal(await scalar('SELECT count(*)::int FROM public.contributions'), 3, 'admin sees review queue');
  const approved = (await db.query("SELECT * FROM public.review_contribution($1,'approve','Source checked by test curator')", [own.id])).rows[0];
  equal([approved.status,approved.reviewed_by], ['verified',ids.admin], 'admin review audit');
  equal(await scalar('SELECT count(*)::int FROM public.evidence WHERE edge_id=$1 AND source_url=$2 AND snippet=$3', [approved.edge_id,evidence.source_url,evidence.snippet]), 1, 'approval creates cited evidence');
  equal((await db.query('SELECT tier,status,stance FROM public.edges WHERE id=$1', [approved.edge_id])).rows, [{tier:'D',status:'verified',stance:'supports'}], 'approval preserves D provenance');
  await denied("SELECT * FROM public.review_contribution($1,'approve')", [own.id], 'duplicate approval rejected', ['22023']);
  await denied("SELECT * FROM public.review_contribution($1,'reject')", [orgPeer.id], 'rejection requires rationale', ['22023']);
  equal((await db.query("SELECT * FROM public.review_contribution($1,'reject','Unsupported claim')", [orgPeer.id])).rows[0].status, 'rejected', 'rejection recorded');
  equal(await scalar("SELECT count(*)::int FROM public.edges WHERE id=$1", [`contrib_${orgPeer.id}`]), 0, 'rejection creates no graph edge');

  // Force a failure after edge INSERT: the statement must roll back edge + review.
  await owner();
  await db.query('INSERT INTO public.evidence(id,edge_id,snippet) VALUES ($1,$2,$3)', [`contrib_${research.id}_evidence`,sample.id,'collision fixture']);
  await actor('admin');
  await denied("SELECT * FROM public.review_contribution($1,'approve')", [research.id], 'evidence failure rolls back review', ['23505']);
  equal(await scalar('SELECT count(*)::int FROM public.edges WHERE id=$1', [`contrib_${research.id}`]), 0, 'failed approval leaves no orphan edge');
  equal(await scalar('SELECT status FROM public.contributions WHERE id=$1', [research.id]), 'unverified', 'failed approval leaves pending audit');
  await actor('anon');
  equal(await scalar('SELECT count(*)::int FROM public.edges WHERE id=$1', [approved.edge_id]), 1, 'approved contribution publicly visible');

  await owner();
  await db.query("INSERT INTO public.explanation_cache(cache_key,edge_ids,payload) VALUES ('approved-cache',ARRAY[$1],'{}')", [approved.edge_id]);
  await load();
  equal(await scalar('SELECT count(*)::int FROM public.contributions'), 3, 'P1 reload preserves contribution audits');
  equal(await scalar('SELECT count(*)::int FROM public.professional_contact_records'), 1, 'P1 reload preserves contacts');
  equal(await scalar('SELECT count(*)::int FROM public.user_roles'), 7, 'P1 reload preserves roles');
  equal(await scalar('SELECT count(*)::int FROM public.coverage_cache'), 2, 'P1 reload preserves coverage caches');
  await actor('anon');
  equal(await scalar("SELECT count(*)::int FROM public.explanation_cache WHERE cache_key='approved-cache'"), 0, 'removed graph edge invalidates cached explanation visibility');
  await actor('no_role', { sub: 'malformed-not-uuid' });
  equal(await scalar('SELECT public.pathnet_uid()'), null, 'malformed local subject safely becomes anonymous');

  // Supabase branch must call auth.uid(); never fall back to claims if it is null.
  const hosted = new PGlite();
  try {
    await hosted.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('test.auth_uid',true),'')::uuid $$;`);
    await hosted.exec(migrations[0]); await hosted.exec(migrations[1]);
    await hosted.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub:ids.admin,user_metadata:{role:'admin'}})]);
    equal((await hosted.query('SELECT public.pathnet_uid() AS id')).rows[0].id, null, 'Supabase auth.uid null never falls back to claim subject');
    await hosted.query("SELECT set_config('test.auth_uid',$1,false)", [ids.family]);
    equal((await hosted.query('SELECT public.pathnet_uid() AS id')).rows[0].id, ids.family, 'Supabase auth.uid is authoritative over conflicting claims');
  } finally { await hosted.close(); }
  console.log(`PASS: ${assertions} checks; five-role RLS, privilege attacks, atomic reviews, both auth paths, exact P1 loads + durable reload.`);
} finally {
  await server.stop();
  await db.close();
}
