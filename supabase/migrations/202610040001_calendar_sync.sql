-- Google Calendar two-way sync. Apply in the Supabase SQL editor after the
-- earlier migrations. Both tables are server-only (service role); browser
-- clients get no access (RLS on, no policies, grants revoked).

-- Idempotent: also allows the provider if 202610010001 was not applied yet.
alter table public.integration_connections
  drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('google_business','gmail','instagram','google_calendar'));

-- Per Google calendar: incremental sync token and push (watch) channel.
create table if not exists public.calendar_sync_state (
  workspace_id uuid not null references public.workspaces on delete cascade,
  calendar_id text not null,
  sync_token text,
  last_synced_at timestamptz,
  changed_at timestamptz not null default now(),
  channel_id text unique,
  channel_resource_id text,
  channel_token_hash text,
  channel_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, calendar_id)
);

-- Durable Mavix item <-> Google event mapping for mirrored marketing content.
create table if not exists public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  mavix_entity_type text not null check (mavix_entity_type in ('post','email')),
  mavix_entity_id text not null,
  calendar_id text not null,
  provider_event_id text not null,
  content_hash text not null,
  state text not null default 'active' check (state in ('active','deleted_remotely')),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, mavix_entity_type, mavix_entity_id),
  unique (workspace_id, calendar_id, provider_event_id)
);
create index if not exists calendar_event_links_workspace_idx
  on public.calendar_event_links (workspace_id);
create index if not exists calendar_sync_state_channel_idx
  on public.calendar_sync_state (channel_id);

alter table public.calendar_sync_state enable row level security;
alter table public.calendar_event_links enable row level security;
revoke all on public.calendar_sync_state, public.calendar_event_links from anon, authenticated;
