-- v0 graph schema. Works on plain Postgres (docker compose) and on Supabase cloud.
-- Ids are text slugs for v0 (readable seeds). P4: add user_roles + RLS in 0002_roles_rls.sql.

create table if not exists nodes (
  id        text primary key,
  type      text not null check (type in ('disease','gene','variant','mechanism','phenotype','patient_group','paper','study','asset','person')),
  name      text not null,
  synonyms  text[] not null default '{}',
  ext_ids   jsonb  not null default '{}',
  props     jsonb  not null default '{}'
);

create table if not exists edges (
  id         text primary key,
  src        text not null references nodes(id) on delete cascade,
  dst        text not null references nodes(id) on delete cascade,
  type       text not null,
  tier       char(1) not null check (tier in ('A','B','C','D')),
  confidence real check (confidence between 0 and 1),
  stance     text not null default 'supports' check (stance in ('supports','contradicts','neutral')),
  status     text not null default 'unverified' check (status in ('verified','unverified','rejected')),
  note       text
);

create table if not exists evidence (
  id           text primary key,
  edge_id      text not null references edges(id) on delete cascade,
  source_type  text,
  source_url   text,
  pmid         text,
  snippet      text,
  retrieved_at date
);

create table if not exists clusters (
  id        text primary key,
  label     text not null,
  mechanism jsonb not null default '{}'
);

create table if not exists node_cluster (
  node_id    text references nodes(id) on delete cascade,
  cluster_id text references clusters(id) on delete cascade,
  primary key (node_id, cluster_id)
);

create index if not exists edges_src_idx on edges(src);
create index if not exists edges_dst_idx on edges(dst);
create index if not exists evidence_edge_idx on evidence(edge_id);

-- Read access for the REST API (PostgREST in docker compose uses the anon role).
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;
grant usage on schema public to anon;
grant select on nodes, edges, evidence, clusters, node_cluster to anon;
