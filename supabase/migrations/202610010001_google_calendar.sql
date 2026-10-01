-- Adds google_calendar as an allowed integration_connections.provider value.
-- Apply in the Supabase SQL editor (same project as the other migrations).
alter table public.integration_connections
  drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('google_business','gmail','instagram','google_calendar'));
