-- One Instagram professional account can be connected to only one Mavix
-- workspace. Instagram message webhooks are routed by the account id
-- (entry.id = provider_account_id), so an account in two workspaces would
-- deliver one customer's messages to both.
--
-- Safe to run more than once. Nothing is updated or deleted: if duplicates
-- already exist the migration stops with a list of them, so they can be
-- resolved by hand (disconnect the account in the wrong workspace) before
-- running it again. Disconnected rows and rows still waiting for an account
-- choice (provider_account_id null) do not count.

do $$
declare
  duplicates text;
begin
  select string_agg(
           format('instagram account %s in %s workspaces (%s)',
                  provider_account_id, n, workspaces),
           '; ')
    into duplicates
    from (
      select provider_account_id,
             count(*) as n,
             string_agg(workspace_id::text, ', ' order by workspace_id) as workspaces
        from public.integration_connections
       where provider = 'instagram'
         and provider_account_id is not null
         and status is distinct from 'disconnected'
       group by provider_account_id
      having count(*) > 1
    ) d;

  if duplicates is not null then
    raise exception 'Instagram accounts connected to more than one workspace: %', duplicates
      using hint = 'Disconnect each account in all but one workspace (Integraties -> Instagram -> Verbinding verwijderen), then run this migration again. No data was changed.';
  end if;
end
$$;

create unique index if not exists integration_connections_instagram_account_uidx
  on public.integration_connections (provider_account_id)
  where provider = 'instagram'
    and provider_account_id is not null
    and status is distinct from 'disconnected';
