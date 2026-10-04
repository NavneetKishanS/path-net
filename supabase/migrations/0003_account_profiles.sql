-- Additive native account/session storage. Public graph and existing APIs are unchanged.
-- The web server connects with server-only operator credentials. Browser callers
-- receive an opaque HttpOnly session cookie, never a database password or service key.
create schema if not exists pathnet_private;
revoke all on schema pathnet_private from public, anon, authenticated;

create table pathnet_private.accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and length(email) <= 254),
  password_hash text not null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table pathnet_private.account_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references pathnet_private.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);
create index account_sessions_user_idx on pathnet_private.account_sessions(user_id);
create index account_sessions_expiry_idx on pathnet_private.account_sessions(expires_at);
revoke all on pathnet_private.accounts, pathnet_private.account_sessions
  from public, anon, authenticated;

-- No FK to graph nodes: a graph refresh must not delete private account preferences.
-- A selected UI lens is a preference, never an authoritative security role.
create table public.account_profiles (
  user_id uuid primary key references pathnet_private.accounts(id) on delete cascade,
  profile jsonb not null check (
    jsonb_typeof(profile) = 'object'
    and profile ?& array['displayName','role','detail','landing','interests','theme','graphView','showAssistant']
    and jsonb_typeof(profile -> 'displayName') = 'string'
    and length(btrim(profile ->> 'displayName')) between 1 and 80
    and profile ->> 'role' in ('leader','patient','scout','researcher','admin')
    and profile ->> 'detail' in ('plain','standard','technical')
    and profile ->> 'landing' in ('/','/explore','/action','/mechanisms','/people')
    and jsonb_typeof(profile -> 'interests') = 'array'
    and jsonb_array_length(profile -> 'interests') <= 20
    and profile ->> 'theme' in ('system','light','dark')
    and profile ->> 'graphView' in ('graph','table')
    and jsonb_typeof(profile -> 'showAssistant') = 'boolean'
  ),
  updated_at timestamptz not null default now()
);
alter table public.account_profiles enable row level security;
create policy account_profile_own_read on public.account_profiles
  for select to authenticated using (user_id = public.pathnet_uid());
create policy account_profile_own_update on public.account_profiles
  for update to authenticated using (user_id = public.pathnet_uid())
  with check (user_id = public.pathnet_uid());
revoke all on public.account_profiles from public, anon, authenticated;
grant select, update on public.account_profiles to authenticated;

comment on table public.account_profiles is
  'Private preferences; role inside profile is only a presentation lens. Authorization uses public.user_roles.';
comment on table pathnet_private.accounts is
  'Native demo identities, independent of Supabase Auth. Passwords are scrypt hashes; server-only access.';

-- A Supabase operator may provision/manage the native demo tables, never a browser.
do $$ begin
  if exists (select from pg_roles where rolname = 'service_role') then
    grant usage on schema pathnet_private to service_role;
    grant all on pathnet_private.accounts, pathnet_private.account_sessions,
      public.account_profiles to service_role;
  end if;
end $$;
