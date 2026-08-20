import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedReactionEmoji,
  normalizeReaction,
  normalizeReactions,
  toggleUserReaction
} from '../src/utils/reactionUtils.ts';

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

test('reaction emoji validation rejects empty, oversized, control, and non-string values', () => {
  assert.equal(isAllowedReactionEmoji('👍'), true);
  assert.equal(isAllowedReactionEmoji('  ❤️  '), true);
  assert.equal(isAllowedReactionEmoji(''), false);
  assert.equal(isAllowedReactionEmoji('   '), false);
  assert.equal(isAllowedReactionEmoji('12345678901234567'), false);
  assert.equal(isAllowedReactionEmoji(`👍${String.fromCharCode(10)}🔥`), false);
  assert.equal(isAllowedReactionEmoji(String.fromCharCode(127)), false);
  assert.equal(isAllowedReactionEmoji(null), false);
});

test('reaction toggling adds users, removes empty rows, and does not mutate the source', () => {
  const source = [{ emoji: '👍', count: 1, users: ['user-1'] }];
  const withSecondUser = toggleUserReaction(source, '👍', 'user-2');
  assert.deepEqual(withSecondUser, [{ emoji: '👍', count: 2, users: ['user-1', 'user-2'] }]);
  assert.deepEqual(source, [{ emoji: '👍', count: 1, users: ['user-1'] }]);

  const withoutFirstUser = toggleUserReaction(withSecondUser, '👍', 'user-1');
  assert.deepEqual(withoutFirstUser, [{ emoji: '👍', count: 1, users: ['user-2'] }]);
  assert.deepEqual(toggleUserReaction(withoutFirstUser, '👍', 'user-2'), []);
  assert.deepEqual(toggleUserReaction([], '🔥', 'user-1'), [
    { emoji: '🔥', count: 1, users: ['user-1'] }
  ]);
});
