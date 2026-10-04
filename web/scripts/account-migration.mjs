import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const MIGRATION_NAME = '0003_account_profiles.sql'
const MIGRATION_URL = new URL(`../../supabase/migrations/${MIGRATION_NAME}`, import.meta.url)
const TABLES = ['pathnet_private.accounts', 'pathnet_private.account_sessions', 'public.account_profiles']
const COUNTS_SQL = 'select (select count(*) from public.nodes) nodes, (select count(*) from public.edges) edges, (select count(*) from public.evidence) evidence'
const normalize = (definition) => definition?.replace(/public\./g, '').replace(/\s+/g, ' ').trim() ?? null
const columns = {
  'pathnet_private.accounts': [
    ['id', 'uuid', true, 'gen_random_uuid()'], ['email', 'text', true, null],
    ['password_hash', 'text', true, null], ['created_at', 'timestamp with time zone', true, 'now()'],
    ['disabled_at', 'timestamp with time zone', false, null],
  ],
  'pathnet_private.account_sessions': [
    ['token_hash', 'text', true, null], ['user_id', 'uuid', true, null],
    ['created_at', 'timestamp with time zone', true, 'now()'], ['expires_at', 'timestamp with time zone', true, null],
  ],
  'public.account_profiles': [
    ['user_id', 'uuid', true, null], ['profile', 'jsonb', true, null],
    ['updated_at', 'timestamp with time zone', true, 'now()'],
  ],
}
const constraints = {
  'pathnet_private.accounts': [
    'PRIMARY KEY (id)', 'UNIQUE (email)',
    'CHECK (((email = lower(btrim(email))) AND (length(email) <= 254)))',
  ],
  'pathnet_private.account_sessions': [
    'PRIMARY KEY (token_hash)', 'FOREIGN KEY (user_id) REFERENCES pathnet_private.accounts(id) ON DELETE CASCADE',
    'CHECK ((expires_at > created_at))', "CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))",
  ],
  'public.account_profiles': [
    'PRIMARY KEY (user_id)', 'FOREIGN KEY (user_id) REFERENCES pathnet_private.accounts(id) ON DELETE CASCADE',
    "CHECK (((jsonb_typeof(profile) = 'object'::text) AND (profile ?& ARRAY['displayName'::text, 'role'::text, 'detail'::text, 'landing'::text, 'interests'::text, 'theme'::text, 'graphView'::text, 'showAssistant'::text]) AND (jsonb_typeof((profile -> 'displayName'::text)) = 'string'::text) AND ((length(btrim((profile ->> 'displayName'::text))) >= 1) AND (length(btrim((profile ->> 'displayName'::text))) <= 80)) AND ((profile ->> 'role'::text) = ANY (ARRAY['leader'::text, 'patient'::text, 'scout'::text, 'researcher'::text, 'admin'::text])) AND ((profile ->> 'detail'::text) = ANY (ARRAY['plain'::text, 'standard'::text, 'technical'::text])) AND ((profile ->> 'landing'::text) = ANY (ARRAY['/'::text, '/explore'::text, '/action'::text, '/mechanisms'::text, '/people'::text])) AND (jsonb_typeof((profile -> 'interests'::text)) = 'array'::text) AND (jsonb_array_length((profile -> 'interests'::text)) <= 20) AND ((profile ->> 'theme'::text) = ANY (ARRAY['system'::text, 'light'::text, 'dark'::text])) AND ((profile ->> 'graphView'::text) = ANY (ARRAY['graph'::text, 'table'::text])) AND (jsonb_typeof((profile -> 'showAssistant'::text)) = 'boolean'::text)))",
  ],
}

function assertMatching(actual, expected, component) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Existing account ${component} does not match ${MIGRATION_NAME}. Review the database before continuing.`)
  }
}

/** A legacy setup may have applied 0003 without its ledger. Adopt only the expected storage and security boundary. */
async function validateAccountSchema(client) {
  for (const table of TABLES) {
    const { rows } = await client.query(`select a.attname, format_type(a.atttypid,a.atttypmod) type,
      a.attnotnull, pg_get_expr(d.adbin,d.adrelid) default_value
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`, [table])
    assertMatching(rows.map((row) => [row.attname, row.type, row.attnotnull, normalize(row.default_value)]), columns[table], `${table} columns`)
    const definitions = await client.query(`select pg_get_constraintdef(oid) definition, convalidated
      from pg_constraint where conrelid=$1::regclass and contype in ('p','u','f','c')`, [table])
    if (definitions.rows.some((row) => !row.convalidated)) throw new Error(`Existing account ${table} has an unvalidated constraint.`)
    assertMatching(definitions.rows.map((row) => normalize(row.definition)).sort(), constraints[table].map(normalize).sort(), `${table} constraints`)
  }
  const relation = await client.query(`select relname, relkind, relrowsecurity, relforcerowsecurity
    from pg_class where oid=any($1::regclass[]) order by relname`, [TABLES])
  assertMatching(relation.rows, [
    { relname: 'account_profiles', relkind: 'r', relrowsecurity: true, relforcerowsecurity: false },
    { relname: 'account_sessions', relkind: 'r', relrowsecurity: false, relforcerowsecurity: false },
    { relname: 'accounts', relkind: 'r', relrowsecurity: false, relforcerowsecurity: false },
  ], 'table security')
  const policies = await client.query(`select policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname='public' and tablename='account_profiles' order by policyname`)
  assertMatching(policies.rows.map((row) => ({ ...row, qual: normalize(row.qual), with_check: normalize(row.with_check) })), [
    { policyname: 'account_profile_own_read', permissive: 'PERMISSIVE', roles: ['authenticated'], cmd: 'SELECT', qual: '(user_id = pathnet_uid())', with_check: null },
    { policyname: 'account_profile_own_update', permissive: 'PERMISSIVE', roles: ['authenticated'], cmd: 'UPDATE', qual: '(user_id = pathnet_uid())', with_check: '(user_id = pathnet_uid())' },
  ], 'profile policies')
  for (const role of ['anon', 'authenticated']) {
    const schema = await client.query("select has_schema_privilege($1,'pathnet_private','USAGE') allowed", [role])
    assertMatching(schema.rows[0].allowed, false, 'private-schema access')
    for (const table of TABLES) {
      const grants = await client.query(`select privilege, has_table_privilege($1,$2,privilege) allowed
        from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege`, [role, table])
      assertMatching(grants.rows.filter((row) => row.allowed).map((row) => row.privilege),
        role === 'authenticated' && table === 'public.account_profiles' ? ['SELECT', 'UPDATE'] : [], `${table} browser privileges`)
    }
  }
}

/** Uses the platform migrator's lock, checksum and ledger; never reseeds or deletes existing accounts. */
export async function initializeAccountStorage(client) {
  const source = (await readFile(MIGRATION_URL, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const digest = createHash('sha256').update(source).digest('hex')
  await client.query('begin')
  try {
    await client.query('select pg_advisory_xact_lock(7340214)')
    const prerequisites = await client.query(`select to_regclass('public.nodes') nodes, to_regclass('public.edges') edges,
      to_regclass('public.evidence') evidence, to_regclass('public.user_roles') roles, to_regprocedure('public.pathnet_uid()') uid`)
    if (Object.values(prerequisites.rows[0]).some((value) => !value)) {
      throw new Error('Initialize the graph database with 0001_graph.sql and 0002_roles_rls.sql before setting up accounts.')
    }
    const before = (await client.query(COUNTS_SQL)).rows[0]
    await client.query('create schema if not exists pathnet_private')
    await client.query('revoke all on schema pathnet_private from public')
    await client.query(`create table if not exists pathnet_private.migrations
      (name text primary key, sha256 text not null, applied_at timestamptz default now())`)
    const previous = (await client.query('select sha256 from pathnet_private.migrations where name=$1', [MIGRATION_NAME])).rows[0]
    if (previous && previous.sha256 !== digest) throw new Error(`Applied migration changed: ${MIGRATION_NAME}; add a new migration instead.`)
    const existing = (await client.query(`select to_regclass('pathnet_private.accounts') accounts,
      to_regclass('pathnet_private.account_sessions') sessions, to_regclass('public.account_profiles') profiles`)).rows[0]
    const tables = Object.values(existing)
    let status
    if (tables.every(Boolean)) {
      // A later numbered migration may legitimately extend these tables. The
      // recorded checksum is authoritative; strict adoption is only for legacy storage.
      if (!previous) await validateAccountSchema(client)
      status = previous ? 'existing' : 'adopted'
    } else if (tables.some(Boolean) || previous) {
      throw new Error('Account migration is incomplete. Review the database before continuing.')
    } else {
      await client.query(source)
      status = 'created'
    }
    if (!previous) await client.query('insert into pathnet_private.migrations(name,sha256) values ($1,$2)', [MIGRATION_NAME, digest])
    const after = (await client.query(COUNTS_SQL)).rows[0]
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Graph counts changed unexpectedly; rolling back.')
    await client.query("notify pgrst, 'reload schema'")
    await client.query('commit')
    return { status, graphCounts: after }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  }
}
