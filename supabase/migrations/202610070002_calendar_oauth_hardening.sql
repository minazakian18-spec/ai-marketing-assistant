-- Reuse the generic provider table. Lifecycle generations prevent in-flight
-- callbacks/refreshes from restoring credentials after disconnect/reconnect.
alter table public.integration_connections
  add column if not exists connection_generation uuid not null default gen_random_uuid(),
  add column if not exists account_email text;
alter table public.oauth_states
  add column if not exists connection_generation uuid;

update public.integration_connections set account_email = display_name
where provider = 'google_calendar' and account_email is null;

-- These tables contain credentials / PKCE verifiers, never browser-readable.
alter table public.integration_connections enable row level security;
alter table public.oauth_states enable row level security;
revoke all on public.integration_connections, public.oauth_states from anon, authenticated;
