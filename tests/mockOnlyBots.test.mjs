import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMockOnlyBotProfile,
  isMockOnlyBotUsername
} from '../src/utils/mockOnlyBots.ts';

test('mock-only bot usernames are detected', () => {
  assert.equal(isMockOnlyBotUsername('echo_bot'), true);
  assert.equal(isMockOnlyBotUsername('@Quiz_Bot'), true);
  assert.equal(isMockOnlyBotUsername('alice'), false);
});

test('mock-only bot profiles match id or username', () => {
  assert.equal(isMockOnlyBotProfile({
    id: '00000000-0000-0000-0000-000000000003',
    username: 'something'
  }), true);
  assert.equal(isMockOnlyBotProfile({ id: 'real-uuid', username: 'weather_bot' }), true);
  assert.equal(isMockOnlyBotProfile({ id: 'real-uuid', username: 'alice' }), false);
});
