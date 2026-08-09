import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const hardeningMigration = await readFile(
  new URL('../supabase/migrations/20260722101500_harden_remaining_security_definers.sql', import.meta.url),
  'utf8'
);
const optimizationMigration = await readFile(
  new URL('../supabase/migrations/20260722101600_optimize_rls_and_foreign_keys.sql', import.meta.url),
  'utf8'
);
const messengerHardeningMigration = await readFile(
  new URL('../supabase/migrations/20260723114811_harden_messenger_security_and_limits.sql', import.meta.url),
  'utf8'
);
const e2eeSecuritySql = await readFile(
  new URL('../supabase/tests/e2ee_v2_security.test.sql', import.meta.url),
  'utf8'
);

test('live E2E requires the complete secret set and runs only live specs', () => {
  for (const name of [
    'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY',
    'E2E_USER_A', 'E2E_PASSWORD_A', 'E2E_ENCRYPTION_PASSWORD_A',
    'E2E_USER_B', 'E2E_PASSWORD_B', 'E2E_ENCRYPTION_PASSWORD_B'
  ]) {
    assert.match(workflow, new RegExp(`for name in[\\s\\S]*${name}`));
  }
  assert.match(workflow, /LIVE_E2E_READY=true/);
  assert.match(workflow, /github\.ref \}\}" = "refs\/heads\/main"[\s\S]*exit 1/);
  assert.match(workflow, /if: \$\{\{ env\.LIVE_E2E_READY == 'true' \}\}/);
  assert.match(workflow, /npx playwright test[\s\S]*two-user-call\.spec\.mjs[\s\S]*two-user-read-receipt\.spec\.mjs[\s\S]*reaction-drawer-layout\.spec\.mjs/);
});

test('mock UI E2E always builds mock mode and runs only mock-compatible specs', () => {
  const mockJob = workflow.slice(workflow.indexOf('  mock-ui-e2e:'), workflow.indexOf('  supabase:'));
  assert.match(mockJob, /VITE_ALLOW_MOCK: 'true'/);
  assert.match(mockJob, /VITE_SUPABASE_URL: 'your-supabase-project-url'/);
  assert.match(mockJob, /VITE_SUPABASE_PUBLISHABLE_KEY: 'your-supabase-publishable-key'/);
  assert.match(mockJob, /VITE_SUPABASE_ANON_KEY: 'your-supabase-anon-key'/);
  assert.match(mockJob, /npm run build/);
  assert.match(mockJob, /npx playwright test tests\/e2e\/lazy-loading\.spec\.mjs/);
  assert.doesNotMatch(mockJob, /reaction-drawer-layout|two-user/);
});

test('Supabase retry fails SQL errors before considering stale pull errors', () => {
  const sqlCheck = workflow.indexOf("'SQLSTATE|failed to apply migration");
  const transientCheck = workflow.indexOf("'toomanyrequests|rate exceeded");
  assert.ok(sqlCheck > 0 && transientCheck > sqlCheck);
  assert.match(workflow, /attempts=3/);
});

test('optional legacy and later RPC hardening is safe on a fresh schema', () => {
  for (const signature of [
    'is_message_unmodified(uuid,uuid,uuid,text,text,uuid)',
    'pin_chat_message(uuid,uuid)',
    'unpin_chat_message(uuid)'
  ]) {
    assert.match(hardeningMigration, new RegExp(`to_regprocedure\\('public\\.${signature.replace(/[()]/g, '\\$&')}`));
  }
  assert.match(hardeningMigration, /do \$block\$/);
});

test('RLS/index optimization restores the pinned-message schema before using it', () => {
  const addColumn = optimizationMigration.indexOf('add column if not exists pinned_message_id uuid');
  const addForeignKey = optimizationMigration.indexOf('foreign key (pinned_message_id)');
  const createIndex = optimizationMigration.indexOf('create index if not exists chats_pinned_message_id_idx');
  assert.ok(addColumn > 0 && addForeignKey > addColumn && createIndex > addForeignKey);
  assert.match(optimizationMigration, /references public\.messages\(id\)[\s\S]*on delete set null/);
  assert.match(optimizationMigration, /constraint_record\.contype = 'f'/);
});

test('RLS optimization is independent of historical policy names', () => {
  assert.match(optimizationMigration, /from pg_policies/);
  assert.match(optimizationMigration, /\(tablename, cmd\) in/);
  assert.match(optimizationMigration, /execute format\('alter policy %I/);
  assert.doesNotMatch(optimizationMigration, /alter policy "(?:Users can insert their own stories|chat_members_delete_policy|profiles_update_policy)"/);
});

test('legacy profile key migration is conditional and source-qualified', () => {
  const guard = messengerHardeningMigration.indexOf("column_name = 'encrypted_private_key'");
  const copy = messengerHardeningMigration.indexOf('select profile.id, profile.encrypted_private_key');
  const drop = messengerHardeningMigration.indexOf('drop column if exists encrypted_private_key');
  assert.ok(guard > 0 && copy > guard && drop > copy);
  assert.match(messengerHardeningMigration, /execute \$sql\$[\s\S]*from public\.profiles as profile/);
  assert.doesNotMatch(messengerHardeningMigration, /\nselect id, encrypted_private_key\nfrom public\.profiles/);
});

test('messenger hardening creates or repairs objects before referencing them', () => {
  const addExpiry = messengerHardeningMigration.indexOf('add column if not exists expires_at');
  const expiryIndex = messengerHardeningMigration.indexOf('create index if not exists stories_expires_at_idx');
  const messageValidator = messengerHardeningMigration.indexOf('create or replace function public.validate_message_update()');
  const messageTrigger = messengerHardeningMigration.indexOf('create trigger on_message_updated');
  const chatValidator = messengerHardeningMigration.indexOf('create or replace function public.validate_chat_update()');
  const chatTrigger = messengerHardeningMigration.indexOf('create trigger on_chat_updated');
  const memberValidator = messengerHardeningMigration.indexOf('create or replace function public.validate_chat_member_update()');
  const memberTrigger = messengerHardeningMigration.indexOf('create trigger on_chat_member_updated');
  const limiter = messengerHardeningMigration.indexOf('create or replace function public.enforce_message_rate_limit()');
  const limiterTrigger = messengerHardeningMigration.indexOf('create trigger before_message_rate_limit');
  assert.ok(addExpiry > 0 && expiryIndex > addExpiry);
  assert.ok(messageValidator > 0 && messageTrigger > messageValidator);
  assert.ok(chatValidator > 0 && chatTrigger > chatValidator);
  assert.ok(memberValidator > 0 && memberTrigger > memberValidator);
  assert.ok(limiter > 0 && limiterTrigger > limiter);
});

test('schema-qualified pgTAP assertions use unambiguous descriptions', () => {
  assert.doesNotMatch(e2eeSecuritySql, /has_table\('public',\s*'[^']+'\s*\)/);
  assert.doesNotMatch(e2eeSecuritySql, /has_column\('public',\s*'[^']+',\s*'[^']+'\s*\)/);
  assert.doesNotMatch(e2eeSecuritySql, /col_is_null\('public',\s*'[^']+',\s*'[^']+'\s*\)/);
  assert.equal((e2eeSecuritySql.match(/has_table\('public',/g) || []).length, 8);
  assert.equal((e2eeSecuritySql.match(/has_column\('public',\s*'messages'/g) || []).length, 3);
});
