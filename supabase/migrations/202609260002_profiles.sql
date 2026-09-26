-- Personal data belongs to the authenticated user, never the shared business blob.
alter table public.profiles add column first_name text not null default '';
alter table public.profiles add column last_name text not null default '';
alter table public.profiles add column phone text not null default '';
alter table public.profiles add column photo text not null default '';
create policy own_profile_write on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
revoke update on public.profiles from authenticated;
grant update(full_name,first_name,last_name,phone,photo,username) on public.profiles to authenticated;
