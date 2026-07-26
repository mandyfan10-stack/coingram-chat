import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dataLayer = await readFile(new URL('../src/services/dataLayer.js', import.meta.url), 'utf8');
const drawer = await readFile(new URL('../src/components/MainMenuDrawer.jsx', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../supabase/migrations/20260726075715_ensure_saved_messages_chat.sql', import.meta.url),
  'utf8'
);

test('saved messages creation is atomic and uses supported member roles', () => {
  assert.doesNotMatch(dataLayer, /role:\s*['"]owner['"]/);
  assert.match(dataLayer, /\.rpc\('ensure_saved_messages_chat'\)/);
  assert.match(drawer, /\.rpc\('ensure_saved_messages_chat'\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /values \(saved_chat_id, caller_id, 'admin'\)/);
  assert.match(migration, /chats_one_saved_per_owner_idx/);
  assert.match(migration, /security invoker/);
});