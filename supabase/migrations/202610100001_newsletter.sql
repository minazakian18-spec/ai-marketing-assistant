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
