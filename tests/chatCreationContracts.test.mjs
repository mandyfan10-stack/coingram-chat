import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dataLayer = readFileSync(new URL('../src/services/dataLayer.js', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../src/components/NewChatModal.jsx', import.meta.url), 'utf8');
const chatContext = readFileSync(new URL('../src/context/ChatContext.jsx', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260726151000_create_managed_chat.sql', import.meta.url), 'utf8');

test('group and channel creation is atomic', () => {
  assert.match(dataLayer, /\.rpc\('create_managed_chat'/);
  assert.match(dataLayer, /p_member_ids:\s*memberIds/);
  assert.doesNotMatch(dataLayer, /const memberRows = \[\{ chat_id: newChat\.id/);
});

test('creation modal stays open until the request succeeds', () => {
  assert.match(modal, /if \(chat\) setIsNewChatOpen\(false\)/);
  assert.match(modal, /setCreateError\('Не удалось создать группу/);
  assert.match(modal, /creating \? 'Создание\.\.\.'/);
});

test('managed-chat RPC validates input and preserves RLS', () => {
  assert.match(migration, /security invoker/i);
  assert.match(migration, /p_type not in \('group', 'channel'\)/i);
  assert.match(migration, /member_id = caller_id then 'admin'/i);
  assert.match(migration, /revoke execute[\s\S]*from public, anon/i);
  assert.match(migration, /grant execute[\s\S]*to authenticated/i);
});
test('channel creation cannot leave the modal in an endless loading state', () => {
  assert.match(dataLayer, /const controller = new AbortController\(\)/);
  assert.match(dataLayer, /setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
  assert.match(dataLayer, /\.rpc\('create_managed_chat'[\s\S]*?\.abortSignal\(controller\.signal\)/);
  assert.match(modal, /finally \{\s*setCreating\(false\)/);
});

test('successful managed chat creation does not wait for a full chat-list refresh', () => {
  assert.match(chatContext, /fetchChats\(\)\.catch/);
  assert.doesNotMatch(chatContext, /else \{\s*await fetchChats\(\);/);
});
