-- Mavix Bibliotheek: files in a private Supabase Storage bucket, metadata
-- and albums per workspace. Apply in the Supabase SQL editor after the
-- earlier migrations. Uploads, downloads and changes go through Mavix API
-- routes (service role); workspace members may read metadata (RLS). The
-- bucket is private: files are only reachable through short-lived signed
-- URLs that the server issues after checking workspace membership.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library', 'library', false, 52428800,
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;

create table if not exists public.library_albums (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  -- Built-in albums (instagram, email, ads, products, brand, videos, ai);
  -- null for albums people create themselves.
  system_key text,
  cover_file_id uuid,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, system_key)
);
create index if not exists library_albums_workspace_idx on public.library_albums (workspace_id);

create table if not exists public.library_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  album_id uuid references public.library_albums on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  kind text not null check (kind in ('image','video','logo','ai','document','other')),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  -- <workspace_id>/<uuid>.<ext> inside the 'library' bucket.
  storage_path text not null unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists library_files_workspace_idx on public.library_files (workspace_id, created_at desc);
create index if not exists library_files_album_idx on public.library_files (album_id);

alter table public.library_albums
  drop constraint if exists library_albums_cover_fk;
alter table public.library_albums
  add constraint library_albums_cover_fk foreign key (cover_file_id)
  references public.library_files on delete set null;

-- Storage used by a workspace (bytes).
create or replace function public.library_usage(p_workspace uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(size_bytes), 0)::bigint from public.library_files where workspace_id = p_workspace;
$$;
revoke all on function public.library_usage(uuid) from public, anon, authenticated;
grant execute on function public.library_usage(uuid) to service_role;

alter table public.library_albums enable row level security;
alter table public.library_files enable row level security;
revoke all on public.library_albums, public.library_files from anon, authenticated;
grant select on public.library_albums, public.library_files to authenticated;

drop policy if exists library_albums_read on public.library_albums;
create policy library_albums_read on public.library_albums
  for select to authenticated using (public.member_role(workspace_id) is not null);
drop policy if exists library_files_read on public.library_files;
create policy library_files_read on public.library_files
  for select to authenticated using (public.member_role(workspace_id) is not null);
