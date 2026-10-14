-- Controlled customer onboarding: demo requests and account applications.
-- Non-destructive: two new tables only. Existing workspaces, users and
-- access_status are untouched; access to the app is still granted only by
-- workspaces.access_status = 'approved' (set by a platform administrator).
--
-- Both tables are server-only: RLS on, no grants to anon/authenticated. The
-- public form posts to /api/applications (service role, validated, rate
-- limited); only platform administrators read and change rows through
-- /api/admin/applications. Every status change is recorded in
-- account_application_events.

create table if not exists public.account_applications (
  id uuid primary key default gen_random_uuid(),
  -- demo_requested -> demo_completed -> application_pending -> awaiting_payment
  -- -> payment_confirmed -> active; rejected / suspended. Transitions are
  -- enforced in src/lib/applications.ts and re-checked on update (status_at).
  status text not null default 'application_pending' check (status in (
    'demo_requested','demo_completed','application_pending','awaiting_payment',
    'payment_confirmed','active','rejected','suspended')),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  company text not null check (char_length(company) between 1 and 160),
  phone text check (phone is null or char_length(phone) <= 40),
  website text check (website is null or char_length(website) <= 300),
  industry text check (industry is null or char_length(industry) <= 100),
  plan text check (plan is null or plan in ('starter','growth','autopilot')),
  message text check (message is null or char_length(message) <= 2000),
  preferred_time text check (preferred_time is null or char_length(preferred_time) <= 200),
  -- 'not_started' until a hosted checkout exists; 'paid' only from a verified
  -- provider webhook or an audited manual confirmation by an administrator;
  -- 'waived' for pilots / manual invoicing.
  payment_status text not null default 'not_started' check (payment_status in ('not_started','pending','paid','failed','refunded','waived')),
  demo_completed_at timestamptz,
  workspace_id uuid references public.workspaces on delete set null,
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 500),
  consent_at timestamptz not null,
  status_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists account_applications_status_idx on public.account_applications (status, created_at desc);
create index if not exists account_applications_email_idx on public.account_applications (lower(email));

create table if not exists public.account_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.account_applications on delete cascade,
  actor_id uuid references auth.users on delete set null,
  from_status text,
  to_status text not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists account_application_events_app_idx on public.account_application_events (application_id, created_at);

alter table public.account_applications enable row level security;
alter table public.account_application_events enable row level security;
revoke all on public.account_applications, public.account_application_events from anon, authenticated;
