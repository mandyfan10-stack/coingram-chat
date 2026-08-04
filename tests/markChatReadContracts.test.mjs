import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20260804120100_mark_chat_as_read.sql', import.meta.url),
  'utf8'
);
const messageService = await readFile(
  new URL('../src/services/messageService.js', import.meta.url),
  'utf8'
);
const chatProvider = await readFile(
  new URL('../src/context/chat/ChatProvider.jsx', import.meta.url),
  'utf8'
);

test('mark_chat_as_read migration inserts receipts and flips read flag', () => {
  assert.match(migration, /create or replace function public\.mark_chat_as_read/);
  assert.match(migration, /private\.is_chat_member/);
  assert.match(migration, /insert into public\.message_reads/);
  assert.match(migration, /on conflict \(message_id, profile_id\) do nothing/i);
  assert.match(migration, /set read = true/);
  assert.match(migration, /grant execute on function public\.mark_chat_as_read\(uuid\)\s+to authenticated/i);
  assert.match(migration, /revoke execute on function public\.mark_chat_as_read\(uuid\)\s+from public, anon/i);
});

test('client marks read via RPC without selecting all message ids', () => {
  assert.match(messageService, /mark_chat_as_read/);
  assert.match(messageService, /p_chat_id/);
  // Live path must not pull every message id for the chat.
  assert.doesNotMatch(
    messageService,
    /markMessagesAsRead:[\s\S]*?\.from\('messages'\)\s*\.select\('id'\)/
  );
});

test('ChatProvider marks chat as read when active chat changes', () => {
  assert.match(chatProvider, /markMessagesAsRead/);
  assert.match(chatProvider, /activeChatId/);
});
