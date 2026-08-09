import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const hardeningMigration = await readFile(
  new URL('../supabase/migrations/20260722101500_harden_remaining_security_definers.sql', import.meta.url),
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
