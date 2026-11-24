-- Google Analytics 4 as its own, optional read-only connection
-- (src/lib/server/google-analytics.ts). Keeps all existing provider values.
alter table public.integration_connections
  drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('google_business','gmail','instagram','google_calendar','messenger','whatsapp','google_search_console','google_ads','google_analytics'));
