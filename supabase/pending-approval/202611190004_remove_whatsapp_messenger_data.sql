-- WhatsApp en Facebook Messenger verwijderen uit de database.
--
-- LET OP: NIET UITVOEREN ZONDER AKKOORD VAN DE EIGENAAR.
-- Dit bestand staat bewust NIET in supabase/migrations/, zodat het nooit
-- automatisch meedraait. Na akkoord: plakken in de Supabase SQL Editor van
-- project llwfsghipxkddwkgdsuy en uitvoeren. Daarna dit bestand naar
-- supabase/migrations/ verplaatsen, zodat de geschiedenis klopt.
--
-- Stand op 19 november 2026 (gecontroleerd):
--   - 1 rij in integration_connections met provider 'whatsapp' (status
--     connected, versleuteld token, metadata.wabaId).
--   - 0 WhatsApp-gesprekken en 0 WhatsApp-berichten in de Inbox.
-- De Mavix-code gebruikt WhatsApp niet meer; deze stap ruimt alleen op.

begin;

-- 1. De koppeling: het opgeslagen token en de account-gegevens gaan weg.
delete from public.integration_connections where provider in ('whatsapp', 'messenger');

-- 2. Inbox-gegevens van WhatsApp (nu 0 rijen; voor de volledigheid).
delete from public.inbox_messages where provider in ('whatsapp', 'messenger');
delete from public.inbox_conversations where provider in ('whatsapp', 'messenger');
delete from public.inbox_sync_state where provider in ('whatsapp', 'messenger');
delete from public.inbox_webhook_events where provider in ('whatsapp', 'messenger');

-- 3. Index en toegestane waarden zonder WhatsApp.
drop index if exists public.integration_connections_whatsapp_number_uidx;

alter table public.inbox_conversations drop constraint if exists inbox_conversations_provider_check;
alter table public.inbox_conversations add constraint inbox_conversations_provider_check
  check (provider in ('gmail', 'instagram'));

alter table public.integration_connections drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections add constraint integration_connections_provider_check
  check (provider in ('google_business', 'gmail', 'instagram', 'google_calendar', 'google_search_console'));

commit;
