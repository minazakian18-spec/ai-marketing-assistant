-- Mavix phase 4: real Instagram publishing, e-mail campaign sending and
-- automation permissions. Non-destructive: only new tables.
--
-- All writes go through Mavix API routes / the cron route (service role)
-- after the server has checked session, workspace membership and role.
-- Members can read their own workspace's rows (status screens), never write.

-- One row per publish attempt of a Mavix post to Instagram (Content
-- Publishing API). At most one attempt per post can be 'publishing' or
-- 'published' at a time, so a double click or two tabs cannot post twice.
create table if not exists public.instagram_publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  post_id text not null check (char_length(post_id) <= 80),
  status text not null check (status in ('publishing', 'published', 'failed')),
  trigger text not null default 'manual' check (trigger in ('manual', 'automation')),
  media_id text check (media_id is null or char_length(media_id) <= 64),
  permalink text check (permalink is null or char_length(permalink) <= 500),
  error text check (error is null or char_length(error) <= 300),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists instagram_publications_once
  on public.instagram_publications (workspace_id, post_id) where status in ('publishing', 'published');
create index if not exists instagram_publications_recent on public.instagram_publications (workspace_id, created_at desc);

-- E-mail campaign sends (and test sends) through the marketing e-mail
-- provider. Only one real send per campaign can be active or done.
create table if not exists public.email_campaign_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  campaign_id text not null check (char_length(campaign_id) <= 80),
  kind text not null check (kind in ('send', 'test')),
  trigger text not null default 'manual' check (trigger in ('manual', 'automation')),
  status text not null check (status in ('sending', 'sent', 'partial', 'failed')),
  recipients integer not null default 0 check (recipients >= 0),
  sent integer not null default 0 check (sent >= 0),
  failed integer not null default 0 check (failed >= 0),
  error text check (error is null or char_length(error) <= 300),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists email_campaign_runs_once
  on public.email_campaign_runs (workspace_id, campaign_id) where kind = 'send' and status <> 'failed';
create index if not exists email_campaign_runs_recent on public.email_campaign_runs (workspace_id, created_at desc);

-- One row per recipient of a real send. No e-mail address is stored: the
-- subscriber id and a hash are enough for status, bounces and suppression.
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.email_campaign_runs on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers on delete set null,
  email_hash text not null,
  status text not null check (status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
  provider_message_id text unique check (provider_message_id is null or char_length(provider_message_id) <= 120),
  error text check (error is null or char_length(error) <= 300),
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, email_hash)
);
create index if not exists email_deliveries_run on public.email_deliveries (run_id, status);

-- Explicit, server-side permission for an automatic workflow (for example
-- "publish scheduled Instagram posts at their time"). Settings in the
-- workspace document are preferences; only a row here with enabled = true
-- lets the scheduler act without a click.
create table if not exists public.automation_permissions (
  workspace_id uuid not null references public.workspaces on delete cascade,
  workflow text not null check (workflow in ('instagram_publish_scheduled', 'email_send_scheduled', 'review_auto_reply')),
  enabled boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, workflow)
);

-- What the scheduler did (or skipped, and why).
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  workflow text not null check (char_length(workflow) <= 60),
  status text not null check (status in ('ok', 'failed', 'skipped')),
  item_id text check (item_id is null or char_length(item_id) <= 80),
  detail text check (detail is null or char_length(detail) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists automation_runs_recent on public.automation_runs (workspace_id, workflow, created_at desc);

alter table public.instagram_publications enable row level security;
alter table public.email_campaign_runs enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.automation_permissions enable row level security;
alter table public.automation_runs enable row level security;
revoke all on public.instagram_publications, public.email_campaign_runs, public.email_deliveries, public.automation_permissions, public.automation_runs from anon, authenticated;
grant select on public.instagram_publications, public.email_campaign_runs, public.automation_permissions, public.automation_runs to authenticated;

drop policy if exists instagram_publications_read on public.instagram_publications;
create policy instagram_publications_read on public.instagram_publications for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists email_campaign_runs_read on public.email_campaign_runs;
create policy email_campaign_runs_read on public.email_campaign_runs for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists automation_permissions_read on public.automation_permissions;
create policy automation_permissions_read on public.automation_permissions for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists automation_runs_read on public.automation_runs;
create policy automation_runs_read on public.automation_runs for select to authenticated using (public.member_role(workspace_id) is not null);
