begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

select has_table('public', 'e2ee_identities');
select has_table('public', 'e2ee_recovery_backups');
select has_table('public', 'user_devices');
select has_table('public', 'e2ee_key_packages');
select has_table('public', 'e2ee_conversations');
select has_table('public', 'e2ee_handshake_events');
select has_table('public', 'e2ee_welcomes');
select has_table('public', 'device_transfers');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'e2ee_identities','e2ee_recovery_backups','user_devices','e2ee_key_packages',
     'e2ee_conversations','e2ee_handshake_events','e2ee_welcomes','device_transfers'
   ) and c.relrowsecurity),
  8::bigint,
  'all E2EE v2 API tables have RLS enabled'
);

select has_column('public', 'messages', 'crypto_version');
select has_column('public', 'messages', 'sender_device_id');
select has_column('public', 'messages', 'encrypted_payload');
select col_is_null('public', 'messages', 'text');

select ok(
  (select not p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'claim_e2ee_key_package'),
  'public KeyPackage wrapper is security invoker'
);
select ok(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'claim_e2ee_key_package'),
  'private KeyPackage implementation is security definer'
);
select ok(has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated wrapper can resolve private implementation');
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon cannot address private schema');
select ok(not has_function_privilege('anon', 'public.claim_e2ee_key_package(uuid,uuid)', 'EXECUTE'), 'anon cannot claim KeyPackages');
select ok(has_function_privilege('authenticated', 'public.claim_e2ee_key_package(uuid,uuid)', 'EXECUTE'), 'authenticated can call wrapper');
select ok(
  (select count(*) = 0 from unnest(current_schemas(true)) schema_name where schema_name = 'private'),
  'private is not in the API role search path'
);

select is(
  (select count(*) from pg_trigger where tgname in (
    'e2ee_conversations_append_only','e2ee_handshake_events_append_only',
    'e2ee_welcomes_append_only','validate_v2_message_mutation','validate_v2_message_insert'
  ) and not tgisinternal),
  5::bigint,
  'append-only and fail-closed triggers are installed'
);

select is((select public from storage.buckets where id = 'avatars'), false, 'avatars are private');
select is((select public from storage.buckets where id = 'stories'), false, 'stories are private');
select is((select public from storage.buckets where id = 'wallpapers'), false, 'wallpapers are private');
select is((select public from storage.buckets where id = 'stickers'), true, 'stickers remain intentionally public');

select * from finish();
rollback;
