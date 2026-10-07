-- Serialize Gmail polling across tabs and Hostinger server instances. Existing
-- normalized Inbox tables and encrypted connection storage remain authoritative.
alter table public.inbox_sync_state
  add column if not exists lease_owner uuid,
  add column if not exists lease_until timestamptz;

create or replace function public.claim_gmail_sync(
  p_workspace uuid, p_account text, p_generation uuid, p_owner uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
  if not exists (select 1 from public.integration_connections
    where workspace_id=p_workspace and provider='gmail'
      and provider_account_id=p_account and status='connected'
      and connection_generation=p_generation) then return false; end if;
  insert into public.inbox_sync_state(workspace_id,provider,provider_account_id)
    values(p_workspace,'gmail',p_account) on conflict do nothing;
  update public.inbox_sync_state set lease_owner=p_owner,
    lease_until=now()+interval '2 minutes'
    where workspace_id=p_workspace and provider='gmail' and provider_account_id=p_account
      and (lease_until is null or lease_until<now());
  get diagnostics claimed = row_count;
  return claimed=1;
end;
$$;
revoke all on function public.claim_gmail_sync(uuid,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_gmail_sync(uuid,text,uuid,uuid) to service_role;

update public.integration_connections set account_email=display_name
  where provider='gmail' and account_email is null and status='connected';
