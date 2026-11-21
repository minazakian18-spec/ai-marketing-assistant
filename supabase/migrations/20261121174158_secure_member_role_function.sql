-- Already applied in production on 21 November 2026 (Supabase migration
-- history: secure_member_role_function). Kept here so the repository matches.
revoke execute on function public.member_role(uuid) from anon, public;
grant execute on function public.member_role(uuid) to authenticated, service_role;
alter function public.member_role(uuid) set search_path = public;
