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
