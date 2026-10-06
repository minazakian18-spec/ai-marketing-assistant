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
