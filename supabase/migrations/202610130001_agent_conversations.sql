-- Mavix Agent: persistent conversations, messages and folders.
-- Non-destructive: only new tables. Conversations are PRIVATE to the user who
-- created them, inside one workspace (user_id + workspace_id on every row).
-- All writes go through Mavix API routes (service role) after the server has
-- checked the session and workspace membership; the browser can only read its
-- own rows (RLS), never write.

create table if not exists public.agent_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_folders_owner_idx on public.agent_folders (workspace_id, user_id, name);

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- Deleting a folder keeps its conversations (they move to "no folder").
  folder_id uuid references public.agent_folders on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  pinned boolean not null default false,
  archived boolean not null default false,
  message_count integer not null default 0 check (message_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
-- Sidebar: newest activity first per user, paginated.
create index if not exists agent_conversations_recent_idx
  on public.agent_conversations (workspace_id, user_id, archived, last_message_at desc);
create index if not exists agent_conversations_folder_idx on public.agent_conversations (folder_id);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 20000),
  -- 'ok' = answered/sent; 'failed' = the AI request failed (content holds a
  -- user-safe message, never provider details).
  status text not null default 'ok' check (status in ('ok', 'failed')),
  model text check (model is null or char_length(model) <= 80),
  action jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_thread_idx on public.agent_messages (conversation_id, created_at desc);
create index if not exists agent_messages_owner_idx on public.agent_messages (workspace_id, user_id, created_at desc);

alter table public.agent_folders enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
revoke all on public.agent_folders, public.agent_conversations, public.agent_messages from anon, authenticated;
grant select on public.agent_folders, public.agent_conversations, public.agent_messages to authenticated;

drop policy if exists agent_folders_own on public.agent_folders;
create policy agent_folders_own on public.agent_folders
  for select to authenticated using (user_id = auth.uid() and public.member_role(workspace_id) is not null);
drop policy if exists agent_conversations_own on public.agent_conversations;
create policy agent_conversations_own on public.agent_conversations
  for select to authenticated using (user_id = auth.uid() and public.member_role(workspace_id) is not null);
drop policy if exists agent_messages_own on public.agent_messages;
create policy agent_messages_own on public.agent_messages
  for select to authenticated using (user_id = auth.uid() and public.member_role(workspace_id) is not null);
