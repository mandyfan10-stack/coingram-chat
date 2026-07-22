-- Complete the backend schema used by the client and tighten privileged access.

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media text not null,
  caption text default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists stories_created_at_idx on public.stories (created_at desc);
create index if not exists stories_expires_at_idx on public.stories (expires_at);

create table if not exists public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  title text not null,
  is_animated boolean not null default false,
  is_video boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  emoji text default '',
  file_path text not null unique,
  width integer not null default 512 check (width > 0),
  height integer not null default 512 check (height > 0),
  created_at timestamptz not null default now()
);

create index if not exists stickers_pack_id_idx on public.stickers (pack_id, created_at);

create table if not exists public.user_sticker_packs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

alter table public.stories enable row level security;
alter table public.sticker_packs enable row level security;
alter table public.stickers enable row level security;
alter table public.user_sticker_packs enable row level security;

create policy "Authenticated users can view active stories"
  on public.stories for select
  to authenticated
  using (expires_at > now());

create policy "Users can publish their own stories"
  on public.stories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own stories"
  on public.stories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can view sticker packs"
  on public.sticker_packs for select
  to authenticated
  using (true);

create policy "Authenticated users can view stickers"
  on public.stickers for select
  to authenticated
  using (true);

create policy "Users can view their installed sticker packs"
  on public.user_sticker_packs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can install sticker packs for themselves"
  on public.user_sticker_packs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their installed sticker packs"
  on public.user_sticker_packs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Enable the tables used by postgres_changes subscriptions.
do $$
declare
  target_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target_table in array array['messages', 'chat_members', 'stories']
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      end if;
    end loop;
  end if;
end
$$;
-- Keep the existing policy helpers safe even when called directly through the Data API.
create or replace function public.is_chat_member(chat_id uuid, user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select $2 = (select auth.uid())
    and exists (
      select 1
      from public.chat_members
      where chat_members.chat_id = $1
        and chat_members.profile_id = $2
    );
$$;

create or replace function public.is_chat_admin(chat_id uuid, user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select $2 = (select auth.uid())
    and exists (
      select 1
      from public.chat_members
      where chat_members.chat_id = $1
        and chat_members.profile_id = $2
        and chat_members.role = 'admin'
    );
$$;

revoke execute on function public.is_chat_member(uuid, uuid) from public, anon;
revoke execute on function public.is_chat_admin(uuid, uuid) from public, anon;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated;
grant execute on function public.is_chat_admin(uuid, uuid) to authenticated;

-- Replace permissive update policies with ownership-preserving variants.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and cmd = 'UPDATE'
      and tablename in ('profiles', 'user_private_keys')
  loop
    execute format('drop policy %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end
$$;

create policy "Users can update only their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can update only their own private key backup"
  on public.user_private_keys for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can delete only their own private key backup"
  on public.user_private_keys for delete
  to authenticated
  using ((select auth.uid()) = id);

-- Explicit Data API privileges. RLS still decides which rows are accessible.
grant select on table public.profiles to authenticated;
grant update (display_name, avatar, avatar_color, bio, theme, wallpaper, last_seen, public_key, has_e2ee)
  on table public.profiles to authenticated;
grant select, insert, update, delete on table public.chats to authenticated;
grant select, insert, update, delete on table public.chat_members to authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant select, insert, update, delete on table public.user_private_keys to authenticated;
grant select, insert on table public.message_reads to authenticated;
grant select, delete on table public.stories to authenticated;
grant insert (user_id, media, caption) on table public.stories to authenticated;
grant select on table public.sticker_packs to authenticated;
grant select on table public.stickers to authenticated;
grant select, insert, delete on table public.user_sticker_packs to authenticated;

-- Private encrypted chat attachments.
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do update set public = false;

-- Public profile/story media is intentionally separate from private chat data.
insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true)
on conflict (id) do update set public = true;

-- Sticker files are public assets; only the service-role Edge Function writes them.
insert into storage.buckets (id, name, public)
values ('stickers', 'stickers', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow authenticated insert to chat-attachments" on storage.objects;
drop policy if exists "Allow authenticated select from chat-attachments" on storage.objects;
drop policy if exists "Users upload their own chat attachments" on storage.objects;
drop policy if exists "Chat members read referenced attachments" on storage.objects;
drop policy if exists "Users update their own chat attachments" on storage.objects;
drop policy if exists "Users delete their own chat attachments" on storage.objects;
drop policy if exists "Users upload their own public media" on storage.objects;
drop policy if exists "Users update their own public media" on storage.objects;
drop policy if exists "Users delete their own public media" on storage.objects;

create policy "Users upload their own chat attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_chat_member(
      ((storage.foldername(name))[1])::uuid,
      (select auth.uid())
    )
  );

create policy "Chat members read referenced attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      -- Backward-compatible owner access for legacy userId/file paths.
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_chat_member(
        ((storage.foldername(name))[1])::uuid,
        (select auth.uid())
      )
    )
  );

create policy "Users update their own chat attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_chat_member(
      ((storage.foldername(name))[1])::uuid,
      (select auth.uid())
    )
  );

create policy "Users delete their own chat attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (storage.foldername(name))[2] = (select auth.uid())::text
    )
  );
create policy "Users upload their own public media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users update their own public media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users delete their own public media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );