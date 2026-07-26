import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chatContext = readFileSync(new URL('../src/context/ChatContext.jsx', import.meta.url), 'utf8');
const dataLayer = readFileSync(new URL('../src/services/dataLayer.js', import.meta.url), 'utf8');

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
  assert.match(dataLayer, /latestReadMessageIds\.has\(latestMsg\.id\)/);
  assert.match(chatContext, /table:\s*'message_reads'/);
  assert.match(chatContext, /message\.id === receipt\.message_id/);
});