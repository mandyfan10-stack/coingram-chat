import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const messageBubbleSource = readFileSync(
  new URL('../src/components/chat/MessageBubble.jsx', import.meta.url),
  'utf8'
);

const TELEGRAM_SENDER_COLORS = [
  '#e17076', '#faa774', '#a695e7', '#7bc862',
  '#6ec9cb', '#65aadd', '#ee7aae', '#e5a55d'
];

function getSenderColor(idOrName) {
  if (!idOrName) return '#65aadd';
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = (hash * 31 + idOrName.charCodeAt(i)) >>> 0;
  }
  return TELEGRAM_SENDER_COLORS[hash % TELEGRAM_SENDER_COLORS.length];
}

function computeGrouping({ messages, index, currentUser, activeChat }) {
  const msg = messages[index];
  const isMe = msg.senderId === currentUser?.id || msg.senderId === 'current';
  const isGroupOther = activeChat?.type === 'group' && !isMe;

  const nextMsg = messages[index + 1];
  const prevMsg = messages[index - 1];

  const getSenderKey = (m) => {
    if (!m) return null;
    return m.senderId || m.sender_id || m.senderName || null;
  };

  const currentSenderKey = getSenderKey(msg);
  const prevSenderKey = getSenderKey(prevMsg);
  const nextSenderKey = getSenderKey(nextMsg);

  const isSameSenderAsPrev = Boolean(
    prevMsg &&
    prevSenderKey &&
    currentSenderKey &&
    prevSenderKey === currentSenderKey &&
    Math.abs(new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) < 10 * 60 * 1000
  );

  const isSameSenderAsNext = Boolean(
    nextMsg &&
    nextSenderKey &&
    currentSenderKey &&
    nextSenderKey === currentSenderKey &&
    Math.abs(new Date(nextMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 10 * 60 * 1000
  );

  const isFirstInGroup = !isSameSenderAsPrev;
  const isLastInGroup = !isSameSenderAsNext;
  const showSenderName = isGroupOther && isFirstInGroup;

  return {
    isMe,
    isGroupOther,
    isFirstInGroup,
    isLastInGroup,
    showSenderName,
    senderColor: getSenderColor(msg.senderId || msg.sender_id || msg.senderName)
  };
}

test('MessageBubble source defines 8-color Telegram palette and 10-minute threshold', () => {
  assert.match(
    messageBubbleSource,
    /TELEGRAM_SENDER_COLORS\s*=\s*\[\s*['"]#e17076['"],\s*['"]#faa774['"],\s*['"]#a695e7['"],\s*['"]#7bc862['"],\s*['"]#6ec9cb['"],\s*['"]#65aadd['"],\s*['"]#ee7aae['"],\s*['"]#e5a55d['"]\s*\]/,
    'MessageBubble must include exact 8-color Telegram palette'
  );
  assert.match(
    messageBubbleSource,
    /10\s*\*\s*60\s*\*\s*1000/,
    'Grouping time threshold must be 10 minutes (600000 ms)'
  );
  assert.match(
    messageBubbleSource,
    /isFirstInGroup\s*=\s*!isSameSenderAsPrev/,
    'First in group must be derived from !isSameSenderAsPrev'
  );
  assert.match(
    messageBubbleSource,
    /isLastInGroup\s*=\s*!isSameSenderAsNext/,
    'Last in group must be derived from !isSameSenderAsNext'
  );
  assert.match(
    messageBubbleSource,
    /showSenderName\s*=\s*isGroupOther\s*&&\s*isFirstInGroup/,
    'Sender name should only be shown on first-in-group for other senders in group chat'
  );
});

test('Sender color hashing is deterministic and spans the 8 colors', () => {
  const testSenders = ['alice_123', 'bob_456', 'carol_789', 'dave_999', 'eve_111', 'frank_222', 'grace_333', 'heidi_444'];
  const colors = testSenders.map(s => getSenderColor(s));
  
  for (const c of colors) {
    assert.ok(TELEGRAM_SENDER_COLORS.includes(c), `Color ${c} must be in palette`);
  }
  // Deterministic
  assert.equal(getSenderColor('alice_123'), getSenderColor('alice_123'));
  assert.equal(getSenderColor(''), '#65aadd');
});

test('Consecutive messages from same sender within 10 minutes form a cluster', () => {
  const baseTime = new Date('2026-08-20T12:00:00Z').getTime();
  const messages = [
    { id: 'm1', senderId: 'user_bob', senderName: 'Bob', timestamp: new Date(baseTime).toISOString() },
    { id: 'm2', senderId: 'user_bob', senderName: 'Bob', timestamp: new Date(baseTime + 2 * 60 * 1000).toISOString() },
    { id: 'm3', senderId: 'user_bob', senderName: 'Bob', timestamp: new Date(baseTime + 5 * 60 * 1000).toISOString() },
  ];
  const activeChat = { id: 'group_1', type: 'group' };
  const currentUser = { id: 'user_alice' };

  const r1 = computeGrouping({ messages, index: 0, currentUser, activeChat });
  const r2 = computeGrouping({ messages, index: 1, currentUser, activeChat });
  const r3 = computeGrouping({ messages, index: 2, currentUser, activeChat });

  // First message: first-in-group, not last-in-group, shows sender name
  assert.equal(r1.isFirstInGroup, true);
  assert.equal(r1.isLastInGroup, false);
  assert.equal(r1.showSenderName, true);

  // Middle message: neither first nor last, no sender name
  assert.equal(r2.isFirstInGroup, false);
  assert.equal(r2.isLastInGroup, false);
  assert.equal(r2.showSenderName, false);

  // Last message: not first, is last-in-group (gets avatar), no sender name
  assert.equal(r3.isFirstInGroup, false);
  assert.equal(r3.isLastInGroup, true);
  assert.equal(r3.showSenderName, false);
});

test('Messages exceeding 10-minute threshold break group clusters', () => {
  const baseTime = new Date('2026-08-20T12:00:00Z').getTime();
  const messages = [
    { id: 'm1', senderId: 'user_bob', senderName: 'Bob', timestamp: new Date(baseTime).toISOString() },
    { id: 'm2', senderId: 'user_bob', senderName: 'Bob', timestamp: new Date(baseTime + 11 * 60 * 1000).toISOString() },
  ];
  const activeChat = { id: 'group_1', type: 'group' };
  const currentUser = { id: 'user_alice' };

  const r1 = computeGrouping({ messages, index: 0, currentUser, activeChat });
  const r2 = computeGrouping({ messages, index: 1, currentUser, activeChat });

  // m1 is both first and last in its own 1-message group
  assert.equal(r1.isFirstInGroup, true);
  assert.equal(r1.isLastInGroup, true);
  assert.equal(r1.showSenderName, true);

  // m2 is both first and last in its own 1-message group (>10 mins later)
  assert.equal(r2.isFirstInGroup, true);
  assert.equal(r2.isLastInGroup, true);
  assert.equal(r2.showSenderName, true);
});

test('Different senders never group together', () => {
  const baseTime = new Date('2026-08-20T12:00:00Z').getTime();
  const messages = [
    { id: 'm1', senderId: 'user_bob', senderName: 'Bob', timestamp: new Date(baseTime).toISOString() },
    { id: 'm2', senderId: 'user_carol', senderName: 'Carol', timestamp: new Date(baseTime + 1000).toISOString() },
  ];
  const activeChat = { id: 'group_1', type: 'group' };
  const currentUser = { id: 'user_alice' };

  const r1 = computeGrouping({ messages, index: 0, currentUser, activeChat });
  const r2 = computeGrouping({ messages, index: 1, currentUser, activeChat });

  assert.equal(r1.isFirstInGroup, true);
  assert.equal(r1.isLastInGroup, true);
  assert.equal(r1.showSenderName, true);

  assert.equal(r2.isFirstInGroup, true);
  assert.equal(r2.isLastInGroup, true);
  assert.equal(r2.showSenderName, true);
});
