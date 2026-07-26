import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chatContext = readFileSync(new URL('../src/context/ChatContext.jsx', import.meta.url), 'utf8');
const dataLayer = readFileSync(new URL('../src/services/dataLayer.js', import.meta.url), 'utf8');
const latestMessagesMigration = readFileSync(new URL('../supabase/migrations/20260726144500_get_latest_chat_messages.sql', import.meta.url), 'utf8');

test('chat list refresh preserves an already loaded message history', () => {
  assert.doesNotMatch(chatContext, /setChats\(updatedChats\)/);
  assert.match(chatContext, /existingChat\?\.messages\?\.length/);
  assert.match(chatContext, /missingPreviewMessages/);
  assert.match(chatContext, /messages: \[\.\.\.existingMessages, \.\.\.missingPreviewMessages\]/);
});

test('active encrypted chat reloads after the private key becomes available', () => {
  assert.match(
    chatContext,
    /\[activeChatId, e2eePrivateKey, loadActiveChatMessages\]/,
  );
});

test('read receipts survive reload and update senders in realtime', () => {
  assert.match(dataLayer, /\.rpc\('get_latest_chat_messages'/);
  assert.doesNotMatch(dataLayer, /latestMsgPromises/);
  assert.match(dataLayer, /latestMsg\.read_by/);
  assert.match(chatContext, /table:\s*'message_reads'/);
  assert.match(chatContext, /message\.id === receipt\.message_id/);
});
test('latest-message RPC is batched and keeps caller RLS', () => {
  assert.match(latestMessagesMigration, /security invoker/i);
  assert.match(latestMessagesMigration, /distinct on \(message\.chat_id\)/i);
  assert.match(latestMessagesMigration, /revoke execute[\s\S]*from public, anon/i);
  assert.match(latestMessagesMigration, /grant execute[\s\S]*to authenticated/i);
});