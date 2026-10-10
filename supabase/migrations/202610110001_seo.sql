-- SEO Intelligence: websites, scans (with the full measured report) and the
-- optional Google Search Console connection. Apply in the Supabase SQL editor
-- after the earlier migrations. Safe to run more than once. Writes happen only
-- on the server (service role); workspace members may read their own rows.

-- Search Console is a separate Google connection (read-only scope).
alter table public.integration_connections
  drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('google_business','gmail','instagram','google_calendar','messenger','whatsapp','google_search_console'));

create table if not exists public.seo_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  url text not null check (url ~ '^https?://' and char_length(url) <= 500),
  host text not null check (char_length(host) <= 253),
  focus_keyword text not null default '' check (char_length(focus_keyword) <= 80),
  -- Ownership check: a meta tag or file with this token on the website.
  verification_token text not null,
  verified_at timestamptz,
  verification_method text check (verification_method is null or verification_method in ('meta', 'file')),
  schedule text not null default 'off' check (schedule in ('off', 'weekly', 'monthly')),
  next_scan_at timestamptz,
  -- Chosen Search Console property (validated against Google on save).
  gsc_property text check (gsc_property is null or char_length(gsc_property) <= 300),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, host)
);
create index if not exists seo_sites_due_idx on public.seo_sites (next_scan_at) where schedule <> 'off';

create table if not exists public.seo_scans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  site_id uuid not null references public.seo_sites on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  stage text,
  progress jsonb not null default '{}'::jsonb,
  trigger text not null default 'manual' check (trigger in ('manual', 'scheduled')),
  error text,
  scores jsonb,
  report jsonb,
  requested_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz
);
create index if not exists seo_scans_site_idx on public.seo_scans (site_id, created_at desc);
create index if not exists seo_scans_workspace_idx on public.seo_scans (workspace_id, created_at desc);
-- At most one active scan per website.
create unique index if not exists seo_scans_one_active_idx
  on public.seo_scans (site_id) where status in ('queued', 'running');

alter table public.seo_sites enable row level security;
alter table public.seo_scans enable row level security;
revoke all on public.seo_sites, public.seo_scans from anon, authenticated;
grant select on public.seo_sites, public.seo_scans to authenticated;

drop policy if exists seo_sites_read on public.seo_sites;
create policy seo_sites_read on public.seo_sites
  for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists seo_scans_read on public.seo_scans;
create policy seo_scans_read on public.seo_scans
  for select to authenticated using (public.member_role(workspace_id) is not null);
