begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into public.profiles (id, username, display_name) values
  ('a0000000-0000-4000-8000-000000000001', 'security_alice', 'Security Alice'),
  ('b0000000-0000-4000-8000-000000000002', 'security_bob', 'Security Bob'),
  ('c0000000-0000-4000-8000-000000000003', 'security_mallory', 'Security Mallory');

insert into public.chats (id, name, type, created_by) values
  ('d0000000-0000-4000-8000-000000000004', 'Security fixture', 'personal', 'a0000000-0000-4000-8000-000000000001');
insert into public.chat_members (chat_id, profile_id, role) values
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'admin'),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'member');

insert into public.user_devices (
  id, user_id, device_name, credential, certificate, certificate_signature, status, approved_at, revoked_at
) values
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Alice active',
    decode(repeat('01', 32), 'hex'), decode(repeat('02', 32), 'hex'), decode(repeat('03', 64), 'hex'), 'active', now(), null),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Alice revoked',
    decode(repeat('04', 32), 'hex'), decode(repeat('05', 32), 'hex'), decode(repeat('06', 64), 'hex'), 'revoked', now(), now()),
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'Bob active',
    decode(repeat('07', 32), 'hex'), decode(repeat('08', 32), 'hex'), decode(repeat('09', 64), 'hex'), 'active', now(), null);

insert into public.e2ee_conversations (chat_id, mls_group_id, activation_epoch, created_by) values
  ('d0000000-0000-4000-8000-000000000004', decode(repeat('0a', 32), 'hex'), 1,
   'a0000000-0000-4000-8000-000000000001');
insert into public.e2ee_key_packages (device_id, owner_id, key_package, expires_at) values
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002',
   decode(repeat('0b', 96), 'hex'), now() + interval '1 day');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(
  (select count(*) from public.e2ee_conversations where chat_id = 'd0000000-0000-4000-8000-000000000004'),
  0::bigint,
  'a foreign user cannot read conversation routing state'
);

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.messages (id, chat_id, sender_id, crypto_version, sender_device_id, encrypted_payload)
    values ('f0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000004',
      'a0000000-0000-4000-8000-000000000001', 2, 'e0000000-0000-4000-8000-000000000007', decode(repeat('11', 32), 'hex'))$$,
  '42501', 'Unknown, foreign, or revoked sender device',
  'sender_device_id cannot be spoofed'
);
select throws_ok(
  $$insert into public.messages (id, chat_id, sender_id, crypto_version, sender_device_id, encrypted_payload)
    values ('f0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000004',
      'a0000000-0000-4000-8000-000000000001', 2, 'e0000000-0000-4000-8000-000000000006', decode(repeat('12', 32), 'hex'))$$,
  '42501', 'Unknown, foreign, or revoked sender device',
  'a revoked device cannot append messages'
);
select throws_ok(
  $$insert into public.messages (id, chat_id, sender_id, text)
    values ('f0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000004',
      'a0000000-0000-4000-8000-000000000001', 'plaintext downgrade')$$,
  '42501', 'This conversation requires E2EE v2',
  'an activated v2 conversation rejects v1 downgrade messages'
);
select lives_ok(
  $$insert into public.messages (id, chat_id, sender_id, crypto_version, sender_device_id, encrypted_payload)
    values ('f0000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000004',
      'a0000000-0000-4000-8000-000000000001', 2, 'e0000000-0000-4000-8000-000000000005', decode(repeat('14', 32), 'hex'))$$,
  'an active owned device can append a valid v2 envelope'
);
select is(
  (select count(*) from public.claim_e2ee_key_package(
    'd0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002')),
  1::bigint,
  'the first KeyPackage claim succeeds atomically'
);
select is(
  (select count(*) from public.claim_e2ee_key_package(
    'd0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002')),
  0::bigint,
  'the same KeyPackage cannot be claimed twice'
);

reset role;
delete from public.chat_members
where chat_id = 'd0000000-0000-4000-8000-000000000004'
  and profile_id = 'b0000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*) from public.messages where chat_id = 'd0000000-0000-4000-8000-000000000004'),
  0::bigint,
  'a former member cannot read encrypted messages'
);

select * from finish();
rollback;
