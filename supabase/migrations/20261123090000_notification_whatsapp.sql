-- WhatsApp as a notification channel (src/lib/server/notify.ts).
alter table public.notification_preferences
  drop constraint if exists notification_preferences_channel_check;
alter table public.notification_preferences
  add constraint notification_preferences_channel_check
  check (channel in ('IN_APP','EMAIL','SMS','WHATSAPP'));
