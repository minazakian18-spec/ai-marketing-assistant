-- Security hardening from the Supabase Advisors (19 november 2026).

-- member_role(): SECURITY DEFINER, used inside RLS policies for signed-in
-- users. Without a login it has no meaning, so anon (and PUBLIC) lose EXECUTE.
-- authenticated keeps it: the RLS policies call it as that role. The function
-- already runs with an empty search_path (fully qualified names).
revoke execute on function public.member_role(uuid) from public, anon;
grant execute on function public.member_role(uuid) to authenticated, service_role;

-- Tables with RLS on and deliberately NO policies: only the service role (the
-- Next.js API routes, after their own session, workspace and role checks)
-- reads or writes them. Browsers never use these tables with the anon key.
-- RLS without policies already returns nothing to anon and authenticated;
-- grants are left as they are so a server query with a user session gets an
-- empty result (as today) instead of a new permission error.
do $$
declare t text;
begin
  foreach t in array array[
    'account_application_events', 'account_applications', 'audit_logs', 'billing_events',
    'calendar_event_links', 'calendar_sync_state', 'email_deliveries', 'email_suppressions',
    'inbox_sync_state', 'inbox_webhook_events', 'integration_connections', 'notification_recipients',
    'oauth_states', 'platform_admins', 'rate_limits', 'workspace_invites'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format($c$comment on table public.%I is 'Server-only: RLS on without policies on purpose. Only the service role (Mavix API routes) may read or write; never use with the anon key.'$c$, t);
    end if;
  end loop;
end $$;
