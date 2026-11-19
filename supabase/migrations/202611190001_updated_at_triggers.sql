-- updated_at is kept current by the database itself. Until now it was only
-- set on insert, so integration_connections (and others) never showed when a
-- token was refreshed or a status changed. Safe to run more than once; changes
-- no existing data.

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'account_applications', 'agent_conversations', 'agent_folders', 'automation_permissions',
    'business_profiles', 'calendar_sync_state', 'email_campaign_runs', 'email_deliveries',
    'inbox_conversations', 'inbox_sync_state', 'instagram_publications', 'integration_connections',
    'library_albums', 'library_files', 'newsletter_forms', 'newsletter_subscribers',
    'seo_sites', 'subscriptions'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
      execute format('create trigger trg_%1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
    end if;
  end loop;
end $$;
