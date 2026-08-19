-- Profile banners were added as columns without Data API GRANTs after the
-- column-level revoke. Also give banners their own private bucket so other
-- users can read cover photos (wallpapers stay owner-only).

grant select (banner, banner_path) on public.profiles to authenticated;
grant update (banner, banner_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  false,
  10485760,
  array['image/avif', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users read banners" on storage.objects;
create policy "Authenticated users read banners"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'banners');
