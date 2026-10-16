-- Mavix Agent phase 3: project instructions and confirmed write actions.
-- Non-destructive: one new nullable column and one new table.
--
-- agent_folders.instructions: optional working instructions for a project
-- ("always write informally", "this project is about the summer menu").
--
-- agent_actions: every change Mavix Agent proposes. The agent can only create
-- a 'pending' row; the change is carried out after the user explicitly
-- confirms it in the app (POST /api/agent/actions/:id). The row is also the
-- audit log: who, which workspace, what, when, and the outcome. All writes go
-- through Mavix API routes (service role) after the server has checked the
-- session, workspace membership and role; the browser can only read its own
-- rows.

alter table public.agent_folders add column if not exists instructions text
  check (instructions is null or char_length(instructions) <= 2000);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  conversation_id uuid references public.agent_conversations on delete set null,
  message_id uuid references public.agent_messages on delete set null,
  kind text not null check (kind in ('save_campaign_drafts')),
  payload jsonb not null,
  summary text not null check (char_length(summary) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'executing', 'done', 'failed', 'cancelled', 'expired')),
  result jsonb,
  error text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists agent_actions_owner_idx on public.agent_actions (workspace_id, user_id, created_at desc);

alter table public.agent_actions enable row level security;
revoke all on public.agent_actions from anon, authenticated;
grant select on public.agent_actions to authenticated;
drop policy if exists agent_actions_own on public.agent_actions;
create policy agent_actions_own on public.agent_actions
  for select to authenticated using (user_id = auth.uid() and public.member_role(workspace_id) is not null);
