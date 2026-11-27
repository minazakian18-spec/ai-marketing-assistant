-- Mavix administration (/beheer): plan demos, set a price per workspace and
-- keep track of invoices by hand. Server-only (service role); no customer
-- content. Adds columns and one table; changes no existing data.

alter table public.account_applications
  add column if not exists demo_scheduled_at timestamptz,
  add column if not exists demo_note text check (char_length(demo_note) <= 1000);

alter table public.workspaces
  add column if not exists monthly_price_cents integer check (monthly_price_cents is null or monthly_price_cents >= 0),
  add column if not exists admin_note text check (char_length(admin_note) <= 2000);

create table if not exists public.workspace_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  period date not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'open' check (status in ('open', 'paid', 'overdue', 'void')),
  paid_at timestamptz,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period)
);
create index if not exists workspace_invoices_workspace_idx on public.workspace_invoices (workspace_id, period desc);
alter table public.workspace_invoices enable row level security;
comment on table public.workspace_invoices is 'Server-only: RLS on without policies on purpose. Invoices Mavix staff track by hand in /beheer.';
create trigger trg_workspace_invoices_updated_at before update on public.workspace_invoices for each row execute function public.set_updated_at();
