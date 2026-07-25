import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const callContext = await readFile(new URL('../src/context/CallContext.jsx', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260723114811_harden_messenger_security_and_limits.sql', import.meta.url), 'utf8');

test('call signaling uses only private chat-scoped topics', () => {
  assert.doesNotMatch(callContext, /call:user:/);
  assert.match(callContext, /call:chat:/);
  assert.match(callContext, /private:\s*true/);
});

test('database migration locks routing and abuse boundaries', () => {
  assert.match(migration, /Message identity and routing fields are immutable/);
  assert.match(migration, /Message rate limit exceeded/);
  assert.match(migration, /file_size_limit = 15728640/);
  assert.match(migration, /drop column if exists encrypted_private_key/);
});