-- Harden remaining SECURITY DEFINER functions and remove broad sticker policies.

-- Existing deployments can contain legacy helpers/RPCs that are absent from a
-- fresh schema at this point in migration order. Harden only functions that
-- already exist; later migrations create pin/unpin with the same protections.
do $block$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    execute $sql$alter function public.handle_new_user() set search_path = ''$sql$;
    execute 'revoke execute on function public.handle_new_user() from public, anon, authenticated';
  end if;

  if to_regprocedure('public.validate_message_update()') is not null then
    execute $sql$alter function public.validate_message_update() set search_path = ''$sql$;
    execute 'revoke execute on function public.validate_message_update() from public, anon, authenticated';
  end if;

  if to_regprocedure('public.is_message_unmodified(uuid,uuid,uuid,text,text,uuid)') is not null then
    execute $sql$alter function public.is_message_unmodified(uuid, uuid, uuid, text, text, uuid) set search_path = ''$sql$;
    execute 'revoke execute on function public.is_message_unmodified(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.pin_chat_message(uuid,uuid)') is not null then
    execute $sql$alter function public.pin_chat_message(uuid, uuid) set search_path = ''$sql$;
    execute 'revoke execute on function public.pin_chat_message(uuid, uuid) from public, anon';
    execute 'grant execute on function public.pin_chat_message(uuid, uuid) to authenticated';
  end if;

  if to_regprocedure('public.unpin_chat_message(uuid)') is not null then
    execute $sql$alter function public.unpin_chat_message(uuid) set search_path = ''$sql$;
    execute 'revoke execute on function public.unpin_chat_message(uuid) from public, anon';
    execute 'grant execute on function public.unpin_chat_message(uuid) to authenticated';
  end if;
end;
$block$;

-- The stickers bucket is public, so object delivery does not need a SELECT
-- policy. Imports use the service-role Edge Function, which bypasses RLS.
drop policy if exists "Sticker media is publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload sticker media" on storage.objects;
