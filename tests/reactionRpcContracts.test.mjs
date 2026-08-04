import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20260804120000_toggle_message_reaction.sql', import.meta.url),
  'utf8'
);
const messageService = await readFile(
  new URL('../src/services/messageService.js', import.meta.url),
  'utf8'
);
const useChatActions = await readFile(
  new URL('../src/context/chat/useChatActions.js', import.meta.url),
  'utf8'
);

test('toggle_message_reaction migration is atomic and authenticated-only', () => {
  assert.match(migration, /create or replace function public\.toggle_message_reaction/);
  assert.match(migration, /for update/i);
  assert.match(migration, /private\.is_chat_member/);
  assert.match(migration, /set_config\('coiny\.reaction_rpc'/);
  assert.match(migration, /grant execute on function public\.toggle_message_reaction\(uuid, text\)\s+to authenticated/i);
  assert.match(migration, /revoke execute on function public\.toggle_message_reaction\(uuid, text\)\s+from public, anon/i);
  assert.match(migration, /Reactions may only be changed via toggle_message_reaction/);
});

test('client toggles reactions via RPC, not full-array UPDATE', () => {
  assert.match(messageService, /toggle_message_reaction/);
  assert.match(messageService, /p_message_id/);
  assert.match(messageService, /p_emoji/);
  assert.doesNotMatch(
    messageService,
    /toggleReaction:[\s\S]*?\.update\(\{\s*reactions:\s*newReactions/
  );
  assert.match(useChatActions, /toggleUserReaction/);
  assert.match(useChatActions, /previousReactions/);
  assert.match(useChatActions, /serverReactions/);
});
