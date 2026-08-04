import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSavedMessagesChat,
  requiresPersonalE2EE,
  savedMessagesDisplayName,
  SAVED_MESSAGES_DISPLAY_NAME,
} from '../src/utils/savedMessages.ts';

test('isSavedMessagesChat detects RU, EN, and username aliases', () => {
  assert.equal(isSavedMessagesChat({ type: 'personal', name: 'Избранное' }), true);
  assert.equal(isSavedMessagesChat({ type: 'personal', name: 'Saved Messages 🔖' }), true);
  assert.equal(isSavedMessagesChat({ type: 'personal', name: 'Saved Messages' }), true);
  assert.equal(
    isSavedMessagesChat({ type: 'personal', name: 'Notes', username: 'saved_messages' }),
    true,
  );
  assert.equal(
    isSavedMessagesChat({ type: 'personal', name: 'Alice', username: 'alice' }),
    false,
  );
  assert.equal(isSavedMessagesChat({ type: 'group', name: 'Избранное' }), false);
  assert.equal(isSavedMessagesChat(null), false);
});

test('requiresPersonalE2EE is false only for saved notes chat', () => {
  assert.equal(requiresPersonalE2EE({ type: 'personal', name: 'Избранное' }), false);
  assert.equal(requiresPersonalE2EE({ type: 'personal', name: 'Saved Messages 🔖' }), false);
  assert.equal(requiresPersonalE2EE({ type: 'personal', name: 'Bob', username: 'bob' }), true);
  assert.equal(requiresPersonalE2EE({ type: 'group', name: 'Team' }), false);
});

test('savedMessagesDisplayName prefers canonical RU label', () => {
  assert.equal(SAVED_MESSAGES_DISPLAY_NAME, 'Избранное');
  assert.equal(
    savedMessagesDisplayName({ type: 'personal', name: 'Saved Messages 🔖' }),
    'Избранное',
  );
  assert.equal(
    savedMessagesDisplayName({ type: 'personal', name: 'Charlie' }),
    'Charlie',
  );
});
