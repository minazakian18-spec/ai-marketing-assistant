-- Workspace data (business_profiles.data) is only written by the server, after
-- the checks in /api/workspace (no client-set "published", Instagram and
-- e-mail confirmations only from Mavix, unsubscribe protection, plan limits,
-- approved workspace). Until now OWNER/ADMIN could also update the row
-- directly through the Supabase API and skip those checks (own workspace only).
--
-- ORDER: deploy the application first (it writes with the service role since
-- the commit that adds this file), then run this file. Running it before the
-- deploy makes saving the workspace fail with an RLS error.
-- Reading stays unchanged (policy business_read). Safe to run more than once.
--
-- ROLLBACK (restores the previous behaviour exactly):
--   create policy business_write on public.business_profiles for update to authenticated
--     using (public.member_role(workspace_id) in ('OWNER','ADMIN'))
--     with check (public.member_role(workspace_id) in ('OWNER','ADMIN'));

drop policy if exists business_write on public.business_profiles;
revoke insert, update, delete on public.business_profiles from anon, authenticated;
