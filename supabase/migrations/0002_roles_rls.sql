-- P4 platform layer. PostgreSQL 15+ / Supabase; preserves the five-table P1 contract.
-- Run after 0001. Operator credentials bootstrap users/roles; browsers use anon + JWT.
-- Platform records deliberately have NO foreign keys to graph tables: P1 reloads them
-- with TRUNCATE ... CASCADE. Submission/review and cache reads validate references.

do $$ begin
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant usage on schema public to anon, authenticated;

create table public.user_roles (
  user_id uuid primary key,
  role text not null check (role in ('family','group_leader','scout','researcher','admin')),
  created_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '')
);
create table public.organization_members (
  user_id uuid not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  primary key (user_id, org_id)
);

-- On Supabase ONLY auth.uid() is authoritative; never inspect user_metadata.role.
-- Plain PostgREST verifies the JWT before populating request.jwt.claims. This
-- fallback is for that local gateway, not a claim-verification service in SQL.
do $install_uid$ begin
  if to_regprocedure('auth.uid()') is not null then
    execute $function$
      create function public.pathnet_uid() returns uuid language sql stable
      set search_path = pg_catalog, public
      as 'select auth.uid()'
    $function$;
  else
    execute $function$
      create function public.pathnet_uid() returns uuid language plpgsql stable
      set search_path = pg_catalog, public as $body$
      declare claims jsonb;
      begin
        claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
        return nullif(claims ->> 'sub', '')::uuid;
      exception when invalid_text_representation then return null;
      end $body$
    $function$;
  end if;
end $install_uid$;

create function public.pathnet_role() returns text
language sql stable security definer set search_path = pg_catalog, public
as $$ select role from public.user_roles where user_id = public.pathnet_uid() $$;
create function public.pathnet_in_org(p_org_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$ select exists (select 1 from public.organization_members
                     where org_id = p_org_id and user_id = public.pathnet_uid()) $$;

alter table public.user_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
create policy own_role_read on public.user_roles for select to authenticated
  using (user_id = public.pathnet_uid() or public.pathnet_role() = 'admin');
create policy role_admin_write on public.user_roles for all to authenticated
  using (public.pathnet_role() = 'admin') with check (public.pathnet_role() = 'admin');
create policy org_member_read on public.organizations for select to authenticated
  using (public.pathnet_in_org(id) or public.pathnet_role() = 'admin');
create policy org_admin_write on public.organizations for all to authenticated
  using (public.pathnet_role() = 'admin') with check (public.pathnet_role() = 'admin');
create policy membership_own_read on public.organization_members for select to authenticated
  using (user_id = public.pathnet_uid() or public.pathnet_role() = 'admin');
create policy membership_admin_write on public.organization_members for all to authenticated
  using (public.pathnet_role() = 'admin') with check (public.pathnet_role() = 'admin');

-- Public source attribution (including investigator names already in P1) remains
-- in the graph. Contact routes are separate and never copied into node props.
create table public.professional_contact_records (
  id uuid primary key default gen_random_uuid(),
  person_node_id text not null,
  display_name text not null check (btrim(display_name) <> ''),
  organization text,
  public_email text,
  public_url text not null check (public_url ~ '^https?://[^[:space:]]+$'),
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$'),
  consent_basis text not null default 'public_professional'
    check (consent_basis = 'public_professional'),
  updated_at timestamptz not null default now()
);
alter table public.professional_contact_records enable row level security;
create policy professional_contact_read on public.professional_contact_records
  for select to authenticated using (
    public.pathnet_role() in ('group_leader','scout','researcher','admin')
    and exists (select 1 from public.nodes where id = person_node_id and type = 'person')
  );
create policy professional_contact_admin_write on public.professional_contact_records
  for all to authenticated using (public.pathnet_role() = 'admin')
  with check (public.pathnet_role() = 'admin'
    and exists (select 1 from public.nodes where id = person_node_id and type = 'person'));
-- PG15 security_invoker is essential: default owner-executed views bypass RLS.
create view public.professional_contacts with (security_invoker = true) as
  select id, person_node_id, display_name, organization, public_email,
         public_url, source_url, consent_basis, updated_at
  from public.professional_contact_records;

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  org_id uuid references public.organizations(id) on delete set null,
  src text not null,
  dst text not null,
  type text not null,
  tier char(1) not null default 'D' check (tier = 'D'),
  stance text not null default 'supports' check (stance in ('supports','contradicts','neutral')),
  status text not null default 'unverified' check (status in ('verified','unverified','rejected')),
  note text,
  source_type text not null default 'user',
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$'),
  snippet text not null check (btrim(snippet) <> ''),
  pmid text check (pmid is null or pmid ~ '^[0-9]+$'),
  created_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  edge_id text unique,
  check ((status = 'unverified' and reviewed_by is null and reviewed_at is null and edge_id is null)
      or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and edge_id is null)
      or (status = 'verified' and reviewed_by is not null and reviewed_at is not null and edge_id is not null))
);
create index contributions_owner_idx on public.contributions(created_by);
create index contributions_org_idx on public.contributions(org_id);
alter table public.contributions enable row level security;
create policy contribution_read on public.contributions for select to authenticated using (
  public.pathnet_role() = 'admin'
  or (public.pathnet_role() in ('group_leader','researcher') and created_by = public.pathnet_uid())
  or (public.pathnet_role() = 'group_leader' and public.pathnet_in_org(org_id))
);
-- No INSERT/UPDATE/DELETE grants or policies: only the guarded RPCs can write.

alter table public.nodes enable row level security;
alter table public.edges enable row level security;
alter table public.edges add constraint edges_contract_type_check check (type in (
  'disease_gene','gene_variant_mechanism','disease_mechanism','disease_phenotype',
  'group_disease','asset_disease','study_disease','investigator_disease',
  'shares_mechanism_with','shares_investigator'
));
alter table public.evidence enable row level security;
alter table public.clusters enable row level security;
alter table public.node_cluster enable row level security;
create policy graph_nodes_read on public.nodes for select to anon, authenticated using (true);
create policy graph_edges_read on public.edges for select to anon, authenticated
  using (status = 'verified' or public.pathnet_role() = 'admin');
-- Do not filter stance: contradictions are visible alongside supported claims.
create policy graph_evidence_read on public.evidence for select to anon, authenticated
  using (exists (select 1 from public.edges where id = edge_id));
create policy graph_clusters_read on public.clusters for select to anon, authenticated using (true);
create policy graph_membership_read on public.node_cluster for select to anon, authenticated using (true);

create table public.explanation_cache (
  cache_key text primary key,
  edge_ids text[] not null check (cardinality(edge_ids) > 0 and array_position(edge_ids, null) is null),
  audience text not null default 'family' check (audience in ('family','group_leader','scout','researcher','admin')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table public.coverage_cache (
  cache_key text primary key,
  audience text not null default 'family' check (audience in ('family','group_leader','scout','researcher','admin')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.explanation_cache enable row level security;
alter table public.coverage_cache enable row level security;
create policy explanation_cache_read on public.explanation_cache for select to anon, authenticated using (
  (audience = 'family' or audience = public.pathnet_role() or public.pathnet_role() = 'admin')
  and not exists (select 1 from unnest(edge_ids) as item(id)
                  where not exists (select 1 from public.edges e where e.id = item.id))
);
create policy coverage_cache_read on public.coverage_cache for select to anon, authenticated
  using (audience = 'family' or audience = public.pathnet_role() or public.pathnet_role() = 'admin');

-- Validate against the unchanged contract/contract.json relation endpoints.
create function public.pathnet_validate_relation(p_src text, p_dst text, p_type text)
returns void language plpgsql set search_path = pg_catalog, public as $$
declare src_type text; dst_type text; allowed boolean;
begin
  select type into src_type from public.nodes where id = p_src;
  select type into dst_type from public.nodes where id = p_dst;
  allowed := case p_type
    when 'disease_gene' then src_type = 'disease' and dst_type = 'gene'
    when 'gene_variant_mechanism' then src_type = 'variant' and dst_type = 'mechanism'
    when 'disease_mechanism' then src_type = 'disease' and dst_type = 'mechanism'
    when 'disease_phenotype' then src_type = 'disease' and dst_type = 'phenotype'
    when 'group_disease' then src_type = 'patient_group' and dst_type = 'disease'
    when 'asset_disease' then src_type = 'asset' and dst_type = 'disease'
    when 'study_disease' then src_type = 'study' and dst_type = 'disease'
    when 'investigator_disease' then src_type = 'person' and dst_type = 'disease'
    when 'shares_mechanism_with' then src_type = 'disease' and dst_type = 'disease'
    when 'shares_investigator' then src_type = 'disease' and dst_type = 'disease'
    else false end;
  if allowed is not true or p_src = p_dst then
    raise exception 'Relationship type or endpoints do not match the graph contract' using errcode = '22023';
  end if;
end $$;

create function public.submit_contribution(
  p_src text, p_dst text, p_type text, p_source_url text, p_snippet text,
  p_org_id uuid default null, p_stance text default 'supports', p_note text default null,
  p_source_type text default 'user', p_pmid text default null
) returns public.contributions language plpgsql security definer
set search_path = pg_catalog, public as $$
declare actor uuid := public.pathnet_uid(); actor_role text := public.pathnet_role();
  result public.contributions;
begin
  if actor is null or actor_role is null or actor_role not in ('group_leader','researcher','admin') then
    raise exception 'This role cannot submit contributions' using errcode = '42501';
  end if;
  if p_org_id is not null and actor_role <> 'admin'
    and (actor_role <> 'group_leader' or not public.pathnet_in_org(p_org_id)) then
    raise exception 'Organization membership required' using errcode = '42501';
  end if;
  perform public.pathnet_validate_relation(p_src, p_dst, p_type);
  if p_source_url is null or p_source_url !~ '^https?://[^[:space:]]+$'
    or p_snippet is null or btrim(p_snippet) = '' or char_length(p_snippet) > 20000
    or coalesce(char_length(p_note), 0) > 20000
    or p_source_type is null or btrim(p_source_type) = '' then
    raise exception 'A public source URL and a nonempty source quote are required' using errcode = '22023';
  end if;
  insert into public.contributions(created_by, org_id, src, dst, type, stance, note,
    source_type, source_url, snippet, pmid)
    values (actor, p_org_id, p_src, p_dst, p_type, p_stance, p_note,
      p_source_type, p_source_url, p_snippet, p_pmid)
    returning * into result;
  return result;
end $$;

create function public.review_contribution(p_id uuid, p_action text, p_review_note text default null)
returns public.contributions language plpgsql security definer
set search_path = pg_catalog, public as $$
declare actor uuid := public.pathnet_uid(); item public.contributions; graph_id text;
begin
  if actor is null or public.pathnet_role() is distinct from 'admin' then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('approve','reject') then
    raise exception 'Action must be approve or reject' using errcode = '22023';
  end if;
  select * into item from public.contributions where id = p_id for update;
  if not found then raise exception 'Contribution not found' using errcode = 'P0002'; end if;
  if item.status <> 'unverified' then
    raise exception 'Contribution has already been reviewed' using errcode = '22023';
  end if;
  if p_action = 'approve' then
    perform public.pathnet_validate_relation(item.src, item.dst, item.type);
    graph_id := 'contrib_' || item.id::text;
    -- Approval is a curator decision; preserve D provenance, do not claim model
    -- validation or silently promote the source to curated/extracted A/B.
    insert into public.edges(id, src, dst, type, tier, confidence, stance, status, note)
      values (graph_id, item.src, item.dst, item.type, 'D', null, item.stance, 'verified', item.note);
    insert into public.evidence(id, edge_id, source_type, source_url, pmid, snippet, retrieved_at)
      values (graph_id || '_evidence', graph_id, item.source_type, item.source_url,
        item.pmid, item.snippet, current_date);
  elsif p_review_note is null or btrim(p_review_note) = '' then
    raise exception 'Rejection requires a review note' using errcode = '22023';
  end if;
  update public.contributions set status = case p_action when 'approve' then 'verified' else 'rejected' end,
    reviewed_by = actor, reviewed_at = now(), review_note = p_review_note, edge_id = graph_id
    where id = p_id returning * into item;
  return item;
end $$;

-- Supabase may have permissive default grants; revoke explicitly, then allow only
-- the operations secured above. PUBLIC function execution is also denied.
revoke all on public.nodes, public.edges, public.evidence, public.clusters, public.node_cluster,
  public.user_roles, public.organizations, public.organization_members, public.contributions,
  public.professional_contact_records, public.professional_contacts,
  public.explanation_cache, public.coverage_cache from public, anon, authenticated;
grant select on public.nodes, public.edges, public.evidence, public.clusters, public.node_cluster,
  public.explanation_cache, public.coverage_cache to anon, authenticated;
grant select on public.contributions, public.professional_contacts to authenticated;
grant select, insert, update, delete on public.user_roles, public.organizations,
  public.organization_members, public.professional_contact_records to authenticated;
revoke all on function public.pathnet_uid(), public.pathnet_role(), public.pathnet_in_org(uuid),
  public.pathnet_validate_relation(text,text,text),
  public.submit_contribution(text,text,text,text,text,uuid,text,text,text,text),
  public.review_contribution(uuid,text,text) from public, anon, authenticated;
grant execute on function public.pathnet_uid(), public.pathnet_role(), public.pathnet_in_org(uuid)
  to anon, authenticated;
grant execute on function public.submit_contribution(text,text,text,text,text,uuid,text,text,text,text),
  public.review_contribution(uuid,text,text) to authenticated;

-- Supabase's server-only service role may populate caches/bootstrap accounts.
-- No service role or login is created in the local prototype database.
do $$ begin
  if exists (select from pg_roles where rolname = 'service_role') then
    grant all on public.user_roles, public.organizations, public.organization_members,
      public.contributions, public.professional_contact_records,
      public.explanation_cache, public.coverage_cache to service_role;
    grant execute on function public.pathnet_uid(), public.pathnet_role(), public.pathnet_in_org(uuid),
      public.submit_contribution(text,text,text,text,text,uuid,text,text,text,text),
      public.review_contribution(uuid,text,text) to service_role;
  end if;
end $$;

comment on table public.contributions is 'Durable review record; graph reload replaces approved edge materializations, not this audit trail.';
comment on view public.professional_contacts is 'Public professional contact routes; security-invoker view enforces caller RLS.';
