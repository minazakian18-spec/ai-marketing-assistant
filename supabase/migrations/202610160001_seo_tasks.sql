-- SEO action plan: the status a team gives to each recommendation of a
-- website (to do, in progress, resolved, ignored). Additive only: existing
-- seo_sites, seo_scans and their reports are untouched.
--
-- One row per website and check. The status is the team's own note: a
-- recommendation is only "really" fixed when a new analysis no longer finds
-- the problem (the dashboard shows both). Members read their workspace's rows;
-- writes happen only on the server after the workspace check.

create table if not exists public.seo_task_states (
  site_id uuid not null references public.seo_sites on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  check_id text not null check (char_length(check_id) between 1 and 60),
  status text not null check (status in ('todo', 'in_progress', 'resolved', 'ignored')),
  updated_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now(),
  primary key (site_id, check_id)
);
create index if not exists seo_task_states_workspace_idx on public.seo_task_states (workspace_id);

alter table public.seo_task_states enable row level security;
revoke all on public.seo_task_states from anon, authenticated;
grant select on public.seo_task_states to authenticated;
drop policy if exists seo_task_states_read on public.seo_task_states;
create policy seo_task_states_read on public.seo_task_states
  for select to authenticated using (public.member_role(workspace_id) is not null);
