-- The previous synthetic-auth migration revoked USAGE on private from
-- authenticated, which broke SECURITY INVOKER wrappers that resolve
-- private.* implementations (is_chat_member, claim_e2ee_key_package, …).

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
