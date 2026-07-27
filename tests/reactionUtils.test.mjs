import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReaction, normalizeReactions } from '../src/utils/reactionUtils.ts';

test('normalizes legacy reactions without a users array', () => {
  assert.deepEqual(
    normalizeReaction({ emoji: '👍', userId: 'user-1' }),
    { emoji: '👍', userId: 'user-1', count: 1, users: ['user-1'] }
  );
});

test('preserves current reaction data without mutating it', () => {
  const source = [{ emoji: '🔥', count: 2, users: ['a', 'b'] }];
  const normalized = normalizeReactions(source);

  assert.deepEqual(normalized, source);
  assert.notEqual(normalized[0].users, source[0].users);
});

test('treats missing or invalid reaction collections as empty', () => {
  assert.deepEqual(normalizeReactions(undefined), []);
  assert.deepEqual(normalizeReactions({}), []);
});