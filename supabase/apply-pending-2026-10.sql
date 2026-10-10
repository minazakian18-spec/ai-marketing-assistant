-- Mavix: pending migrations in one transaction (run in the Supabase SQL editor).
-- Generated from supabase/migrations; every part is idempotent (safe to run twice).
-- Nothing is deleted. If a duplicate check raises an exception, the whole
-- transaction is rolled back and no change is made.

begin;

-- ============================================================ 202610060001_library.sql
-- Mavix Bibliotheek: files in a private Supabase Storage bucket, metadata
-- and albums per workspace. Apply in the Supabase SQL editor after the
-- earlier migrations. Uploads, downloads and changes go through Mavix API
-- routes (service role); workspace members may read metadata (RLS). The
-- bucket is private: files are only reachable through short-lived signed
-- URLs that the server issues after checking workspace membership.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library', 'library', false, 52428800,
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;

create table if not exists public.library_albums (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  -- Built-in albums (instagram, email, ads, products, brand, videos, ai);
  -- null for albums people create themselves.
  system_key text,
  cover_file_id uuid,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, system_key)
);
create index if not exists library_albums_workspace_idx on public.library_albums (workspace_id);

create table if not exists public.library_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  album_id uuid references public.library_albums on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  kind text not null check (kind in ('image','video','logo','ai','document','other')),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  -- <workspace_id>/<uuid>.<ext> inside the 'library' bucket.
  storage_path text not null unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists library_files_workspace_idx on public.library_files (workspace_id, created_at desc);
create index if not exists library_files_album_idx on public.library_files (album_id);

alter table public.library_albums
  drop constraint if exists library_albums_cover_fk;
alter table public.library_albums
  add constraint library_albums_cover_fk foreign key (cover_file_id)
  references public.library_files on delete set null;

-- Storage used by a workspace (bytes).
create or replace function public.library_usage(p_workspace uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(size_bytes), 0)::bigint from public.library_files where workspace_id = p_workspace;
$$;
revoke all on function public.library_usage(uuid) from public, anon, authenticated;
grant execute on function public.library_usage(uuid) to service_role;

alter table public.library_albums enable row level security;
alter table public.library_files enable row level security;
revoke all on public.library_albums, public.library_files from anon, authenticated;
grant select on public.library_albums, public.library_files to authenticated;

drop policy if exists library_albums_read on public.library_albums;
create policy library_albums_read on public.library_albums
  for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists library_files_read on public.library_files;
create policy library_files_read on public.library_files
  for select to authenticated using (public.member_role(workspace_id) is not null);

-- ============================================================ 202610070001_research.sql
-- Mavix business research ("Onderzoek mijn restaurant"). Apply in the
-- Supabase SQL editor after the earlier migrations.
--
-- One research run per workspace per calendar month (Europe/Amsterdam) is
-- enforced by the unique (workspace_id, period) key: the API can only
-- create one row per month. A failed run may be retried by the same row;
-- a completed report is never regenerated, only re-read.

create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'running' check (status in ('running','completed','failed')),
  stage text,
  report jsonb,
  sources jsonb not null default '[]',
  error text,
  requested_by uuid references auth.users on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  next_eligible_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, period)
);
create index if not exists research_reports_workspace_idx
  on public.research_reports (workspace_id, period desc);

alter table public.research_reports enable row level security;
revoke all on public.research_reports from anon, authenticated;
grant select on public.research_reports to authenticated;

-- Members can read their own workspace's reports; only the server writes.
drop policy if exists research_reports_read on public.research_reports;
create policy research_reports_read on public.research_reports
  for select to authenticated using (public.member_role(workspace_id) is not null);

-- ============================================================ 202610080001_whatsapp_unique_number.sql
-- One WhatsApp Business phone number (Phone Number ID) can be connected to
-- only one Mavix workspace. Meta webhooks are routed by phone_number_id, so a
-- number in two workspaces would deliver one customer's messages to both.
--
-- Safe to run more than once. Nothing is updated or deleted: if duplicates
-- already exist the migration stops with a list of them, so they can be
-- resolved by hand (disconnect the number in the wrong workspace) before
-- running it again. Disconnected rows do not count and are left untouched.

do $$
declare
  duplicates text;
begin
  select string_agg(
           format('phone_number_id %s in %s workspaces (%s)',
                  provider_account_id, n, workspaces),
           '; ')
    into duplicates
    from (
      select provider_account_id,
             count(*) as n,
             string_agg(workspace_id::text, ', ' order by workspace_id) as workspaces
        from public.integration_connections
       where provider = 'whatsapp'
         and provider_account_id is not null
         and status is distinct from 'disconnected'
       group by provider_account_id
      having count(*) > 1
    ) d;

  if duplicates is not null then
    raise exception 'WhatsApp numbers connected to more than one workspace: %', duplicates
      using hint = 'Disconnect each number in all but one workspace (Integraties -> WhatsApp Business -> Ontkoppelen), then run this migration again. No data was changed.';
  end if;
end
$$;

create unique index if not exists integration_connections_whatsapp_number_uidx
  on public.integration_connections (provider_account_id)
  where provider = 'whatsapp'
    and provider_account_id is not null
    and status is distinct from 'disconnected';

-- ============================================================ 202610080002_instagram_unique_account.sql
-- One Instagram professional account can be connected to only one Mavix
-- workspace. Instagram message webhooks are routed by the account id
-- (entry.id = provider_account_id), so an account in two workspaces would
-- deliver one customer's messages to both.
--
-- Safe to run more than once. Nothing is updated or deleted: if duplicates
-- already exist the migration stops with a list of them, so they can be
-- resolved by hand (disconnect the account in the wrong workspace) before
-- running it again. Disconnected rows and rows still waiting for an account
-- choice (provider_account_id null) do not count.

do $$
declare
  duplicates text;
begin
  select string_agg(
           format('instagram account %s in %s workspaces (%s)',
                  provider_account_id, n, workspaces),
           '; ')
    into duplicates
    from (
      select provider_account_id,
             count(*) as n,
             string_agg(workspace_id::text, ', ' order by workspace_id) as workspaces
        from public.integration_connections
       where provider = 'instagram'
         and provider_account_id is not null
         and status is distinct from 'disconnected'
       group by provider_account_id
      having count(*) > 1
    ) d;

  if duplicates is not null then
    raise exception 'Instagram accounts connected to more than one workspace: %', duplicates
      using hint = 'Disconnect each account in all but one workspace (Integraties -> Instagram -> Verbinding verwijderen), then run this migration again. No data was changed.';
  end if;
end
$$;

create unique index if not exists integration_connections_instagram_account_uidx
  on public.integration_connections (provider_account_id)
  where provider = 'instagram'
    and provider_account_id is not null
    and status is distinct from 'disconnected';

-- ============================================================ 202610100001_newsletter.sql
-- Newsletter signup forms, subscribers, consent evidence and suppressions.
-- Apply in the Supabase SQL editor after the earlier migrations. Safe to run
-- more than once. Writes happen only on the server (service role); workspace
-- members may read their own workspace's rows (RLS). Nothing here touches
-- existing tables or data.

-- Embeddable signup forms. public_key is the only identifier a website sees.
create table if not exists public.newsletter_forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  public_key text not null unique check (public_key ~ '^[A-Za-z0-9_-]{24,64}$'),
  name text not null default 'Nieuwsbrief' check (char_length(name) <= 120),
  consent_text text not null check (char_length(consent_text) between 10 and 1000),
  privacy_policy_url text check (privacy_policy_url is null or privacy_policy_url ~ '^https://'),
  privacy_policy_version text not null default '1' check (char_length(privacy_policy_version) <= 40),
  -- Websites allowed to post (exact origins); empty = any website.
  allowed_origins text[] not null default '{}',
  -- After a plain HTML form post; must be https.
  redirect_url text check (redirect_url is null or redirect_url ~ '^https://'),
  double_opt_in boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists newsletter_forms_workspace_idx on public.newsletter_forms (workspace_id);

-- One row per normalized e-mail address per workspace (no duplicates).
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null check (char_length(email) <= 254),
  email_normalized text not null check (email_normalized = lower(btrim(email_normalized))),
  name text check (name is null or char_length(name) <= 120),
  status text not null check (status in ('pending', 'subscribed', 'unsubscribed')),
  source text not null default 'form' check (char_length(source) <= 80),
  form_id uuid references public.newsletter_forms on delete set null,
  privacy_policy_version text,
  subscribed_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  -- Double opt-in: hash of the single-use confirmation token.
  confirm_token_hash text,
  confirm_expires_at timestamptz,
  confirm_sent_at timestamptz,
  -- Contacts synchronisation (see /api/workspace): synced when synced_at >= updated_at.
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email_normalized)
);
create index if not exists newsletter_subscribers_sync_idx
  on public.newsletter_subscribers (workspace_id, updated_at);
create unique index if not exists newsletter_subscribers_confirm_idx
  on public.newsletter_subscribers (confirm_token_hash) where confirm_token_hash is not null;

-- Consent evidence: what was shown, when, where. IP addresses are stored only
-- as a keyed hash. Kept when a subscriber unsubscribes; removed on erasure.
create table if not exists public.newsletter_consent_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers on delete cascade,
  event text not null check (event in ('subscribe', 'confirm', 'unsubscribe')),
  form_id uuid references public.newsletter_forms on delete set null,
  consent_text text,
  privacy_policy_version text,
  privacy_policy_url text,
  page_url text check (page_url is null or char_length(page_url) <= 500),
  ip_hash text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  method text not null check (method in ('form', 'link', 'one_click', 'mavix_user')),
  created_at timestamptz not null default now()
);
create index if not exists newsletter_consent_events_subscriber_idx
  on public.newsletter_consent_events (subscriber_id, created_at);

-- Suppression list: addresses that must not receive marketing e-mail. Stored
-- as a keyed hash of the normalized address, so it survives erasure of the
-- subscriber without keeping the address itself.
create table if not exists public.email_suppressions (
  workspace_id uuid not null references public.workspaces on delete cascade,
  email_hash text not null,
  reason text not null check (reason in ('unsubscribed', 'erased', 'manual')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, email_hash)
);

alter table public.newsletter_forms enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_consent_events enable row level security;
alter table public.email_suppressions enable row level security;

revoke all on public.newsletter_forms, public.newsletter_subscribers,
  public.newsletter_consent_events, public.email_suppressions from anon, authenticated;
grant select on public.newsletter_forms, public.newsletter_subscribers,
  public.newsletter_consent_events to authenticated;

drop policy if exists newsletter_forms_read on public.newsletter_forms;
create policy newsletter_forms_read on public.newsletter_forms
  for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists newsletter_subscribers_read on public.newsletter_subscribers;
create policy newsletter_subscribers_read on public.newsletter_subscribers
  for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists newsletter_consent_events_read on public.newsletter_consent_events;
create policy newsletter_consent_events_read on public.newsletter_consent_events
  for select to authenticated using (public.member_role(workspace_id) is not null);
-- email_suppressions: service role only (no policy for authenticated).

-- ============================================================ 202610110001_seo.sql
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

-- ============================================================ 202610120001_private_beta_ai_usage.sql
-- Private beta access, platform administrators and AI usage metering.
-- Non-destructive: adds columns/tables only. Existing workspaces are approved
-- so current users (the owner) keep access; new sign-ups start as "pending"
-- until a platform administrator approves them.

-- 1. Workspace access status (private beta) and optional AI quota.
alter table public.workspaces add column if not exists access_changed_at timestamptz;
alter table public.workspaces add column if not exists ai_monthly_token_limit integer;
-- access_status is added once. Only on that first run every workspace that
-- already exists is approved, so the owner keeps access. Running the script
-- again never approves later (pending) sign-ups.
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'workspaces' and column_name = 'access_status') then
    alter table public.workspaces add column access_status text not null default 'pending';
    update public.workspaces set access_status = 'approved', access_changed_at = now();
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_access_status_check') then
    alter table public.workspaces add constraint workspaces_access_status_check check (access_status in ('pending','approved','suspended'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspaces_ai_limit_check') then
    alter table public.workspaces add constraint workspaces_ai_limit_check check (ai_monthly_token_limit is null or ai_monthly_token_limit >= 0);
  end if;
end $$;

-- Members can read their workspace row (existing policy); nobody can change
-- access_status from the browser: there is no update policy on workspaces.
revoke update on public.workspaces from anon, authenticated;

-- 2. Platform administrators (Mavix staff, not workspace owners). Managed only
-- with the service role / SQL editor; never readable from the browser.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

-- 3. AI usage ledger: one row per AI request (tokens and estimated cost, never
-- prompts or outputs). request_key prevents double-charging retries.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete set null,
  feature text not null check (char_length(feature) <= 40),
  model text not null check (char_length(model) <= 80),
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_micro_usd bigint not null default 0 check (cost_micro_usd >= 0),
  request_key text check (char_length(request_key) <= 120),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_usage_workspace_month on public.ai_usage (workspace_id, created_at desc);
create index if not exists ai_usage_user_recent on public.ai_usage (user_id, created_at desc);
create unique index if not exists ai_usage_request_key on public.ai_usage (workspace_id, request_key) where request_key is not null;
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
drop policy if exists ai_usage_read on public.ai_usage;
create policy ai_usage_read on public.ai_usage for select to authenticated using (public.member_role(workspace_id) in ('OWNER','ADMIN'));
grant select on public.ai_usage to authenticated;

commit;
