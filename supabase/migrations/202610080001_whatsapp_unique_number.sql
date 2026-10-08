-- One WhatsApp Business phone number (Phone Number ID) can be connected to
-- only one Mavix workspace. Meta webhooks are routed by phone_number_id, so a
-- number in two workspaces would deliver one customer's messages to both.
--
-- Safe to run more than once. Nothing is updated or deleted: if duplicates
-- already exist the migration stops with a list of them, so they can be
-- resolved by hand (disconnect the number in the wrong workspace) before
-- running it again. Disconnected rows do not count and are left untouched.

do $$
declare
  duplicates text;
begin
  select string_agg(
           format('phone_number_id %s in %s workspaces (%s)',
                  provider_account_id, n, workspaces),
           '; ')
    into duplicates
    from (
      select provider_account_id,
             count(*) as n,
             string_agg(workspace_id::text, ', ' order by workspace_id) as workspaces
        from public.integration_connections
       where provider = 'whatsapp'
         and provider_account_id is not null
         and status is distinct from 'disconnected'
       group by provider_account_id
      having count(*) > 1
    ) d;

  if duplicates is not null then
    raise exception 'WhatsApp numbers connected to more than one workspace: %', duplicates
      using hint = 'Disconnect each number in all but one workspace (Integraties -> WhatsApp Business -> Ontkoppelen), then run this migration again. No data was changed.';
  end if;
end
$$;

create unique index if not exists integration_connections_whatsapp_number_uidx
  on public.integration_connections (provider_account_id)
  where provider = 'whatsapp'
    and provider_account_id is not null
    and status is distinct from 'disconnected';
