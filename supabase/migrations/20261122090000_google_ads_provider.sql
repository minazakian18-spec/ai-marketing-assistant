-- Google Ads as its own, optional connection (src/lib/server/google-ads.ts).
-- Keeps the existing provider values so no existing row breaks.
alter table public.integration_connections
  drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('google_business','gmail','instagram','google_calendar','messenger','whatsapp','google_search_console','google_ads'));
