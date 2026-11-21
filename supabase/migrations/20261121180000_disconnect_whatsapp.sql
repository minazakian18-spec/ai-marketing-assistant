-- WhatsApp is no longer part of Mavix. The connection is switched off and its
-- stored token removed; the per-number index goes. Inbox conversations and
-- messages are NOT deleted here (there are none today; deleting them needs the
-- owner's explicit approval, see supabase/pending-approval/).
update public.integration_connections
   set status = 'disconnected', encrypted_credentials = null
 where provider = 'whatsapp';
drop index if exists public.integration_connections_whatsapp_number_uidx;
