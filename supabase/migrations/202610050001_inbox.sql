-- Mavix Inbox (omnichannel). Apply in the Supabase SQL editor after the
-- earlier migrations. Writes happen only on the server (service role);
-- workspace members may read their own workspace's inbox (RLS), which keeps
-- the door open for Supabase Realtime later. Idempotent where practical.

-- New channel providers: Messenger (Facebook Page) and WhatsApp Business.
alter table public.integration_connections
  drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('google_business','gmail','instagram','google_calendar','messenger','whatsapp'));
-- Meta webhooks are routed to a workspace by page id / IG account id /
-- WhatsApp phone number id.
create index if not exists integration_connections_account_idx
  on public.integration_connections (provider, provider_account_id);

create table if not exists public.inbox_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  provider text not null check (provider in ('gmail','instagram','messenger','whatsapp')),
  provider_account_id text not null,
  provider_thread_id text not null,
  external_contact jsonb not null default '{}',
  contact_id text,
  subject text not null default '',
  status text not null default 'open' check (status in ('open','pending','resolved')),
  assigned_user_id uuid references auth.users on delete set null,
  labels text[] not null default '{}',
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  last_message_preview text not null default '',
  last_message_direction text not null default 'inbound',
  unread_count integer not null default 0 check (unread_count >= 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_account_id, provider_thread_id)
);
create index if not exists inbox_conversations_list_idx
  on public.inbox_conversations (workspace_id, last_message_at desc, id desc);
create index if not exists inbox_conversations_unread_idx
  on public.inbox_conversations (workspace_id) where unread_count > 0;

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  conversation_id uuid not null references public.inbox_conversations on delete cascade,
  provider text not null,
  provider_account_id text not null,
  -- Null for internal notes and for outbound messages not yet accepted by the
  -- provider; filled in once the provider returns its id.
  provider_message_id text,
  client_message_id text,
  direction text not null check (direction in ('inbound','outbound','note')),
  sender jsonb not null default '{}',
  author_user_id uuid references auth.users on delete set null,
  -- Plain text only. HTML e-mail is converted to text; it is never rendered.
  body text not null default '',
  attachments jsonb not null default '[]',
  delivery_status text not null default 'received'
    check (delivery_status in ('received','pending','sent','delivered','read','failed')),
  error text,
  metadata jsonb not null default '{}',
  provider_created_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Idempotency: one row per provider message, whatever webhook/sync delivers it.
create unique index if not exists inbox_messages_provider_uidx
  on public.inbox_messages (workspace_id, provider, provider_account_id, provider_message_id)
  where provider_message_id is not null;
-- Idempotent sends/retries from the browser.
create unique index if not exists inbox_messages_client_uidx
  on public.inbox_messages (workspace_id, client_message_id)
  where client_message_id is not null;
create index if not exists inbox_messages_thread_idx
  on public.inbox_messages (conversation_id, provider_created_at desc, id desc);

-- Per connected mailbox / account: incremental sync cursor (Gmail historyId).
create table if not exists public.inbox_sync_state (
  workspace_id uuid not null references public.workspaces on delete cascade,
  provider text not null,
  provider_account_id text not null,
  cursor text,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider, provider_account_id)
);

-- Webhook deliveries already processed (hash of the delivery, never content).
create table if not exists public.inbox_webhook_events (
  event_key text primary key,
  provider text not null,
  workspace_id uuid references public.workspaces on delete cascade,
  received_at timestamptz not null default now()
);
create index if not exists inbox_webhook_events_received_idx
  on public.inbox_webhook_events (received_at);

-- Atomic "new message in conversation" bookkeeping: newest message wins the
-- preview, inbound messages raise the unread counter and reopen a resolved
-- conversation. Service role only.
create or replace function public.inbox_touch_conversation(
  p_id uuid, p_at timestamptz, p_preview text, p_direction text, p_search text, p_unread boolean
) returns void language sql security definer set search_path = '' as $$
  update public.inbox_conversations c set
    last_message_preview = case when p_at >= c.last_message_at then p_preview else c.last_message_preview end,
    last_message_direction = case when p_at >= c.last_message_at then p_direction else c.last_message_direction end,
    last_message_at = greatest(c.last_message_at, p_at),
    last_inbound_at = case when p_direction = 'inbound' then greatest(coalesce(c.last_inbound_at, p_at), p_at) else c.last_inbound_at end,
    unread_count = case when p_unread then c.unread_count + 1 else c.unread_count end,
    status = case when p_unread and c.status = 'resolved' then 'open' else c.status end,
    search_text = left(p_search, 2000),
    updated_at = now()
  where c.id = p_id;
$$;
revoke all on function public.inbox_touch_conversation(uuid, timestamptz, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.inbox_touch_conversation(uuid, timestamptz, text, text, text, boolean) to service_role;

alter table public.inbox_conversations enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.inbox_sync_state enable row level security;
alter table public.inbox_webhook_events enable row level security;

revoke all on public.inbox_conversations, public.inbox_messages,
  public.inbox_sync_state, public.inbox_webhook_events from anon, authenticated;
grant select on public.inbox_conversations, public.inbox_messages to authenticated;

drop policy if exists inbox_conversations_read on public.inbox_conversations;
create policy inbox_conversations_read on public.inbox_conversations
  for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists inbox_messages_read on public.inbox_messages;
create policy inbox_messages_read on public.inbox_messages
  for select to authenticated using (public.member_role(workspace_id) is not null);
