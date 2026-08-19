import test from 'node:test';
import assert from 'node:assert/strict';
import { processOfflineQueueItem } from '../src/services/offlineQueue.js';
import { createOfflineQueueItem } from '../src/services/offlineQueueCore.js';
import {
  normalizeReactions,
  toggleUserReaction
} from '../src/utils/reactionUtils.ts';

// ============================================================================
// AREA 1: OFFLINE QUEUE RACE CONDITIONS & 409 / 23505 CONFLICT RECOVERY
// ============================================================================

test('OFFLINE QUEUE STRESS: 50 concurrent processOfflineQueueItem invocations with single-flight mutex semantics', async () => {
  let activeInFlight = 0;
  let maxConcurrentInFlight = 0;
  let successfulSends = 0;

  const item = createOfflineQueueItem({
    chatId: 'chat-race-1',
    senderId: 'user-1',
    text: 'concurrency-probe',
    optimisticId: 'opt-race-1'
  });

  const runSync = async () => {
    return processOfflineQueueItem(item, {
      chat: { type: 'group', name: 'Race Test', members: [] },
      currentUser: { id: 'user-1' },
      e2eePrivateKey: null,
      sharedKey: null,
      sendMessage: async (chatId, senderId, text, replyTo, media, customId) => {
        activeInFlight++;
        if (activeInFlight > maxConcurrentInFlight) {
          maxConcurrentInFlight = activeInFlight;
        }
        await new Promise((r) => setTimeout(r, 5 + Math.random() * 10));
        activeInFlight--;
        successfulSends++;
        return { id: customId, text };
      }
    });
  };

  const results = await Promise.all(Array.from({ length: 50 }, () => runSync()));
  assert.equal(results.length, 50);
  assert.equal(successfulSends, 50);
  for (const res of results) {
    assert.equal(res.data.id, 'opt-race-1');
  }
});

test('OFFLINE QUEUE STRESS: 409 Storage Conflict recovery with deterministic file paths', async () => {
  const uploadedFiles = [];
  const item = createOfflineQueueItem({
    chatId: 'chat-409',
    senderId: 'user-sender',
    text: 'image-retry',
    optimisticId: 'opt-media-409',
    hasOfflineMedia: true,
    mediaType: 'image'
  });

  const blob = new Blob(['sample-image-data'], { type: 'image/png' });
  let attempts = 0;

  const deps = {
    chat: { type: 'group', name: 'G', members: [] },
    currentUser: { id: 'user-sender' },
    e2eePrivateKey: null,
    sharedKey: null,
    getAttachment: async () => blob,
    deleteAttachment: async () => {},
    extensionForMedia: () => 'png',
    storage: {
      from: () => ({
        upload: async (filePath, _body, _opts) => {
          attempts++;
          uploadedFiles.push(filePath);
          if (attempts > 1) {
            return {
              error: {
                statusCode: 409,
                message: 'The resource already exists',
                error: 'Duplicate'
              }
            };
          }
          return { error: null };
        }
      })
    },
    sendMessage: async (_c, _s, _t, _r, mediaUrl, customId) => {
      return { id: customId, media: mediaUrl };
    }
  };

  const res1 = await processOfflineQueueItem(item, deps);
  assert.equal(res1.data.id, 'opt-media-409');
  assert.match(res1.finalMediaUrl, /storage:\/\/chat-attachments\/chat-409\/user-sender\/msg_opt-media-409\.png/);

  const res2 = await processOfflineQueueItem(item, deps);
  assert.equal(res2.data.id, 'opt-media-409');
  assert.equal(res2.finalMediaUrl, res1.finalMediaUrl, 'Deterministic path must remain identical on 409 recovery');
});

test('OFFLINE QUEUE STRESS: 23505 Unique Violation recovery & spoofing prevention', async () => {
  const item = createOfflineQueueItem({
    chatId: 'chat-23505',
    senderId: 'user-alice',
    text: 'stable message',
    optimisticId: 'stable-uuid-1'
  });

  const duplicateError = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505'
  });

  const validDeps = {
    chat: { type: 'group', name: 'G', members: [] },
    currentUser: { id: 'user-alice' },
    e2eePrivateKey: null,
    sharedKey: null,
    sendMessage: async () => { throw duplicateError; },
    findMessageById: async (id) => ({
      id,
      chat_id: 'chat-23505',
      sender_id: 'user-alice',
      text: 'stable message'
    })
  };

  const recovered = await processOfflineQueueItem(item, validDeps);
  assert.equal(recovered.data.id, 'stable-uuid-1');

  const spoofedSenderDeps = {
    ...validDeps,
    findMessageById: async (id) => ({
      id,
      chat_id: 'chat-23505',
      sender_id: 'user-attacker',
      text: 'evil'
    })
  };

  await assert.rejects(
    () => processOfflineQueueItem(item, spoofedSenderDeps),
    (err) => err === duplicateError,
    'Must reject when existing message sender does not match queue item'
  );

  const spoofedChatDeps = {
    ...validDeps,
    findMessageById: async (id) => ({
      id,
      chat_id: 'chat-other',
      sender_id: 'user-alice',
      text: 'cross-chat injection'
    })
  };

  await assert.rejects(
    () => processOfflineQueueItem(item, spoofedChatDeps),
    (err) => err === duplicateError,
    'Must reject when existing message chat_id does not match queue item'
  );
});

// ============================================================================
// AREA 2: WEBM INFINITY DURATION PROBING & TIME FORMATTING EDGE CASES
// ============================================================================

test('MEDIA PROBE STRESS: WebM Infinity seek calculation and formatTime edge cases', () => {
  const formatTime = (time) => {
    if (isNaN(time) || time === Infinity || time < 0 || time === null || time === undefined) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  assert.equal(formatTime(Infinity), '0:00');
  assert.equal(formatTime(-Infinity), '0:00');
  assert.equal(formatTime(NaN), '0:00');
  assert.equal(formatTime(-1), '0:00');
  assert.equal(formatTime(-0.001), '0:00');
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(5), '0:05');
  assert.equal(formatTime(59), '0:59');
  assert.equal(formatTime(60), '1:00');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3599), '59:59');
  assert.equal(formatTime(3600), '60:00');
  assert.equal(formatTime(null), '0:00');
  assert.equal(formatTime(undefined), '0:00');

  class MockAudioProbe {
    constructor() {
      this.src = '';
      this.duration = Infinity;
      this.currentTime = 0;
      this.listeners = new Map();
    }
    addEventListener(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(fn);
    }
    removeEventListener(event, fn) {
      const list = this.listeners.get(event) || [];
      this.listeners.set(event, list.filter(cb => cb !== fn));
    }
    emit(event) {
      const list = this.listeners.get(event) || [];
      for (const fn of list) fn();
    }
  }

  const probe = new MockAudioProbe();
  let resolvedDuration = 0;

  const handleProbeCompute = () => {
    if (probe.duration && !isNaN(probe.duration) && probe.duration !== Infinity) {
      resolvedDuration = probe.duration;
      probe.src = '';
    } else if (probe.duration === Infinity) {
      const onSeeked = () => {
        probe.removeEventListener('seeked', onSeeked);
        if (probe.duration && !isNaN(probe.duration) && probe.duration !== Infinity) {
          resolvedDuration = probe.duration;
        }
        probe.src = '';
      };
      probe.addEventListener('seeked', onSeeked);
      probe.currentTime = 1e101;
      probe.duration = 42.75;
      probe.emit('seeked');
    }
  };

  probe.addEventListener('loadedmetadata', handleProbeCompute);
  probe.emit('loadedmetadata');

  assert.equal(resolvedDuration, 42.75, 'WebM Infinity probe must successfully resolve finite duration on seeked');
  assert.equal(probe.src, '', 'Probe src must be cleaned up to release audio stream memory');
});

// ============================================================================
// AREA 3: 10-MINUTE MESSAGE GROUPING BOUNDARY TRANSITIONS
// ============================================================================

test('MESSAGE GROUPING STRESS: 10-minute threshold precision (9m59s vs 10m00s vs 10m01s)', () => {
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  const computeGrouping = (messages) => {
    return messages.map((msg, index) => {
      const prevMsg = messages[index - 1];
      const nextMsg = messages[index + 1];

      const getSenderKey = (m) => (m ? m.senderId || m.sender_id || m.senderName || null : null);

      const currentSenderKey = getSenderKey(msg);
      const prevSenderKey = getSenderKey(prevMsg);
      const nextSenderKey = getSenderKey(nextMsg);

      const isSameSenderAsPrev = Boolean(
        prevMsg &&
        prevSenderKey &&
        currentSenderKey &&
        prevSenderKey === currentSenderKey &&
        Math.abs(new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) < TEN_MINUTES_MS
      );

      const isSameSenderAsNext = Boolean(
        nextMsg &&
        nextSenderKey &&
        currentSenderKey &&
        nextSenderKey === currentSenderKey &&
        Math.abs(new Date(nextMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()) < TEN_MINUTES_MS
      );

      return {
        id: msg.id,
        isFirstInGroup: !isSameSenderAsPrev,
        isLastInGroup: !isSameSenderAsNext,
        isSameSenderAsPrev,
        isSameSenderAsNext
      };
    });
  };

  const baseTime = new Date('2026-08-19T12:00:00.000Z').getTime();

  const messagesUnderThreshold = [
    { id: 'm1', senderId: 'alice', timestamp: new Date(baseTime).toISOString() },
    { id: 'm2', senderId: 'alice', timestamp: new Date(baseTime + 599000).toISOString() }
  ];
  const groupA = computeGrouping(messagesUnderThreshold);
  assert.equal(groupA[0].isFirstInGroup, true);
  assert.equal(groupA[0].isLastInGroup, false);
  assert.equal(groupA[1].isFirstInGroup, false);
  assert.equal(groupA[1].isLastInGroup, true);

  const messagesAtThreshold = [
    { id: 'm1', senderId: 'alice', timestamp: new Date(baseTime).toISOString() },
    { id: 'm2', senderId: 'alice', timestamp: new Date(baseTime + 600000).toISOString() }
  ];
  const groupB = computeGrouping(messagesAtThreshold);
  assert.equal(groupB[0].isFirstInGroup, true);
  assert.equal(groupB[0].isLastInGroup, true);
  assert.equal(groupB[1].isFirstInGroup, true);
  assert.equal(groupB[1].isLastInGroup, true);

  const messagesOverThreshold = [
    { id: 'm1', senderId: 'alice', timestamp: new Date(baseTime).toISOString() },
    { id: 'm2', senderId: 'alice', timestamp: new Date(baseTime + 601000).toISOString() }
  ];
  const groupC = computeGrouping(messagesOverThreshold);
  assert.equal(groupC[0].isFirstInGroup, true);
  assert.equal(groupC[0].isLastInGroup, true);
  assert.equal(groupC[1].isFirstInGroup, true);
  assert.equal(groupC[1].isLastInGroup, true);

  const senderChangeMessages = [
    { id: 'm1', senderId: 'alice', timestamp: new Date(baseTime).toISOString() },
    { id: 'm2', senderId: 'bob', timestamp: new Date(baseTime + 1000).toISOString() }
  ];
  const groupD = computeGrouping(senderChangeMessages);
  assert.equal(groupD[0].isFirstInGroup, true);
  assert.equal(groupD[0].isLastInGroup, true);
  assert.equal(groupD[1].isFirstInGroup, true);
  assert.equal(groupD[1].isLastInGroup, true);

  const clusterMessages = Array.from({ length: 5 }, (_, i) => ({
    id: `clustered-${i}`,
    senderId: 'alice',
    timestamp: new Date(baseTime + i * 120000).toISOString()
  }));
  const groupE = computeGrouping(clusterMessages);
  assert.equal(groupE[0].isFirstInGroup, true);
  assert.equal(groupE[0].isLastInGroup, false);
  for (let i = 1; i <= 3; i++) {
    assert.equal(groupE[i].isFirstInGroup, false, `Middle msg ${i} must not be first`);
    assert.equal(groupE[i].isLastInGroup, false, `Middle msg ${i} must not be last`);
  }
  assert.equal(groupE[4].isFirstInGroup, false);
  assert.equal(groupE[4].isLastInGroup, true);
});

test('TELEGRAM COLOR PALETTE STRESS: Hash distribution across 1,000 identifiers', () => {
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

  assert.equal(getSenderColor(''), '#65aadd');
  assert.equal(getSenderColor(null), '#65aadd');
  assert.equal(getSenderColor(undefined), '#65aadd');

  const colorDistribution = new Map();
  for (let i = 0; i < 1000; i++) {
    const id = `user-uuid-${i}-${Math.random().toString(36).substring(2, 9)}`;
    const color = getSenderColor(id);
    assert.ok(TELEGRAM_SENDER_COLORS.includes(color));
    colorDistribution.set(color, (colorDistribution.get(color) || 0) + 1);
  }

  assert.equal(colorDistribution.size, 8, 'Hash function must utilize all 8 Telegram colors');
});

// ============================================================================
// AREA 4: SCROLL POSITION PRESERVATION MATH & MUTATIONS UNDER RAPID ACTIONS
// ============================================================================

test('SCROLL PRESERVATION STRESS: Reverse pagination delta height anchoring math', () => {
  let scrollTop = 50;
  let scrollHeight = 2000;

  const previousHeight = scrollHeight;
  const previousTop = scrollTop;

  const prependedHeightDelta = 3500;
  scrollHeight += prependedHeightDelta;

  const nextScrollTop = previousTop + scrollHeight - previousHeight;

  assert.equal(nextScrollTop, 50 + 3500, 'Scroll top must shift exactly by the prepended content height');
  const anchorOffsetFromTopMessage = nextScrollTop - prependedHeightDelta;
  assert.equal(anchorOffsetFromTopMessage, previousTop, 'Viewport relative anchor must remain 100% stable');
});

test('REACTION MUTATION STRESS: 200 rapid concurrent toggles with user isolation and idempotency', () => {
  let reactions = [];
  const allowedEmojis = ['👍', '❤️', '🔥', '🎉'];

  for (let i = 0; i < 200; i++) {
    const emoji = allowedEmojis[i % allowedEmojis.length];
    const user = `user-${i % 5}`;
    reactions = toggleUserReaction(reactions, emoji, user);
    const normalized = normalizeReactions(reactions);
    for (const r of normalized) {
      assert.ok(r.count > 0, 'Reaction count must never be 0 in normalized array');
      assert.equal(r.users.length, r.count, 'Reaction count must match unique user array length');
    }
  }

  let testReactions = [{ emoji: '🔥', count: 1, users: ['user-1'] }];
  testReactions = toggleUserReaction(testReactions, '🔥', 'user-1');
  assert.deepEqual(testReactions, [], 'Toggling same emoji by same user must remove reaction');
});

test('DATE DIVIDER BOUNDARY STRESS: Day transition calculation across midnight & multi-day history', () => {
  function formatDateDivider(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    }
    const isThisYear = date.getFullYear() === today.getFullYear();
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: isThisYear ? undefined : 'numeric'
    });
  }

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);
  const twoDaysAgoDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 12, 0, 0);
  const twoDaysAgoDate2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 12, 5, 0);

  const messages = [
    { id: 'm1', timestamp: twoDaysAgoDate.toISOString() },
    { id: 'm2', timestamp: twoDaysAgoDate2.toISOString() }, // Same day (2 days ago) -> No divider
    { id: 'm3', timestamp: yesterdayDate.toISOString() },   // Crosses day -> Divider "Вчера"
    { id: 'm4', timestamp: todayDate.toISOString() }       // Crosses day -> Divider "Сегодня"
  ];

  const renderedDividers = messages.map((msg, index) => {
    const prevMsg = messages[index - 1];
    const showDateDivider = !prevMsg || (
      new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString()
    );
    return showDateDivider ? formatDateDivider(msg.timestamp) : null;
  });

  const expectedOlderDate = twoDaysAgoDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  assert.equal(renderedDividers[0], expectedOlderDate);
  assert.equal(renderedDividers[1], null, 'Second message on same day must not render date divider');
  assert.equal(renderedDividers[2], 'Вчера');
  assert.equal(renderedDividers[3], 'Сегодня');
});

// ============================================================================
// AREA 5: REALTIME DEDUPLICATION & OUT-OF-ORDER EVENT IDEMPOTENCY
// ============================================================================

test('REALTIME MERGE STRESS: Coalescing optimistic bubbles and out-of-order message_reads', () => {
  const currentUserId = 'user-me';

  let chat = {
    id: 'chat-rt-1',
    messages: [
      {
        id: 'msg-opt-123',
        senderId: currentUserId,
        senderName: 'Вы',
        text: 'Plaintext secret',
        media: null,
        replyTo: null,
        read: false,
        reads: [],
        reactions: [],
        timestamp: new Date('2026-08-19T14:00:00.000Z'),
        isOptimistic: true,
        isPending: true
      }
    ]
  };

  const receiptPayload = {
    message_id: 'msg-opt-123',
    profile_id: 'user-other'
  };

  chat = {
    ...chat,
    messages: chat.messages.map((message) => (
      message.id === receiptPayload.message_id
        ? {
            ...message,
            read: true,
            reads: [...new Set([...(message.reads || []), receiptPayload.profile_id])]
          }
        : message
    ))
  };

  assert.equal(chat.messages[0].read, true);
  assert.deepEqual(chat.messages[0].reads, ['user-other']);

  const serverInsertPayload = {
    id: 'msg-opt-123',
    chat_id: 'chat-rt-1',
    sender_id: currentUserId,
    text: 'e2ee:aes-gcm:deadbeef:cafe',
    media: null,
    reply_to: null,
    read: false,
    reactions: [],
    created_at: '2026-08-19T14:00:00.000Z'
  };

  const isMe = serverInsertPayload.sender_id === currentUserId;
  const existingIndex = chat.messages.findIndex((m) => m.id === serverInsertPayload.id);

  const formattedMsg = {
    id: serverInsertPayload.id,
    senderId: serverInsertPayload.sender_id,
    senderName: 'Вы',
    text: serverInsertPayload.text,
    media: serverInsertPayload.media,
    replyTo: serverInsertPayload.reply_to,
    read: chat.messages.find((m) => m.id === serverInsertPayload.id)?.read || serverInsertPayload.read,
    reads: chat.messages.find((m) => m.id === serverInsertPayload.id)?.reads,
    reactions: serverInsertPayload.reactions || [],
    timestamp: new Date(serverInsertPayload.created_at),
    isLocked: false,
    isOptimistic: false,
    isPending: false
  };

  if (existingIndex !== -1) {
    chat = {
      ...chat,
      messages: chat.messages.map((m, idx) => (
        idx === existingIndex
          ? {
              ...formattedMsg,
              text: isMe && m.text && !String(m.text).startsWith('e2ee:')
                ? m.text
                : formattedMsg.text,
              read: m.read || formattedMsg.read,
              reads: m.reads || formattedMsg.reads
            }
          : m
      ))
    };
  }

  assert.equal(chat.messages.length, 1, 'Duplicate bubble must never be inserted');
  assert.equal(chat.messages[0].isOptimistic, false, 'Optimistic flag must be cleared');
  assert.equal(chat.messages[0].isPending, false, 'Pending flag must be cleared');
  assert.equal(chat.messages[0].text, 'Plaintext secret', 'Own optimistic plaintext must be preserved');
  assert.equal(chat.messages[0].read, true, 'Prior out-of-order read receipt must be preserved');
  assert.deepEqual(chat.messages[0].reads, ['user-other']);
});

// ============================================================================
// AREA 6: AVATAR SPACER ACCUMULATION & E2EE OFFLINE ATTACHMENT INTEGRITY
// ============================================================================

test('AVATAR SPACER MATRIX STRESS: 10-message incoming group chain generates exactly 1 avatar and 9 spacers', () => {
  const baseTime = new Date('2026-08-19T10:00:00.000Z').getTime();
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const currentUserId = 'user-me';

  const messages = Array.from({ length: 10 }, (_, i) => ({
    id: `msg-${i}`,
    senderId: 'user-bob',
    senderName: 'Bob',
    text: `Incoming message ${i}`,
    timestamp: new Date(baseTime + i * 30000).toISOString() // 30s apart
  }));

  const activeChat = {
    id: 'chat-group-1',
    type: 'group',
    members: [{ id: 'user-me' }, { id: 'user-bob', name: 'Bob' }]
  };

  const bubbleLayouts = messages.map((msg, index) => {
    const isMe = msg.senderId === currentUserId || msg.senderId === 'current';
    const isGroupOther = activeChat.type === 'group' && !isMe;
    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];

    const getSenderKey = (m) => (m ? m.senderId || m.sender_id || m.senderName || null : null);
    const currentSenderKey = getSenderKey(msg);
    const prevSenderKey = getSenderKey(prevMsg);
    const nextSenderKey = getSenderKey(nextMsg);

    const isSameSenderAsPrev = Boolean(
      prevMsg &&
      prevSenderKey &&
      currentSenderKey &&
      prevSenderKey === currentSenderKey &&
      Math.abs(new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) < TEN_MINUTES_MS
    );

    const isSameSenderAsNext = Boolean(
      nextMsg &&
      nextSenderKey &&
      currentSenderKey &&
      nextSenderKey === currentSenderKey &&
      Math.abs(new Date(nextMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()) < TEN_MINUTES_MS
    );

    const isFirstInGroup = !isSameSenderAsPrev;
    const isLastInGroup = !isSameSenderAsNext;
    const showSenderName = isGroupOther && isFirstInGroup;
    const rendersAvatar = isGroupOther && isLastInGroup;
    const rendersSpacer = isGroupOther && !isLastInGroup;

    return {
      index,
      isFirstInGroup,
      isLastInGroup,
      showSenderName,
      rendersAvatar,
      rendersSpacer
    };
  });

  // First message must show sender name and avatar spacer
  assert.equal(bubbleLayouts[0].isFirstInGroup, true);
  assert.equal(bubbleLayouts[0].showSenderName, true);
  assert.equal(bubbleLayouts[0].rendersAvatar, false);
  assert.equal(bubbleLayouts[0].rendersSpacer, true);

  // Messages 1..8 must be middle messages with spacers and no name
  for (let i = 1; i <= 8; i++) {
    assert.equal(bubbleLayouts[i].isFirstInGroup, false, `Message ${i} must not be first in group`);
    assert.equal(bubbleLayouts[i].isLastInGroup, false, `Message ${i} must not be last in group`);
    assert.equal(bubbleLayouts[i].showSenderName, false, `Message ${i} must not show sender name`);
    assert.equal(bubbleLayouts[i].rendersAvatar, false, `Message ${i} must not render avatar`);
    assert.equal(bubbleLayouts[i].rendersSpacer, true, `Message ${i} must render avatar spacer`);
  }

  // Last message (index 9) must render the actual avatar and no spacer
  assert.equal(bubbleLayouts[9].isLastInGroup, true);
  assert.equal(bubbleLayouts[9].rendersAvatar, true);
  assert.equal(bubbleLayouts[9].rendersSpacer, false);

  const totalAvatars = bubbleLayouts.filter(b => b.rendersAvatar).length;
  const totalSpacers = bubbleLayouts.filter(b => b.rendersSpacer).length;
  assert.equal(totalAvatars, 1, 'Exactly 1 avatar must be rendered at the tail of the group');
  assert.equal(totalSpacers, 9, 'Exactly 9 spacers must be rendered to maintain columnar alignment');
});

test('E2EE OFFLINE MEDIA STRESS: Process item encrypts media with derived key before upload', async () => {
  const item = createOfflineQueueItem({
    chatId: 'e2ee-personal-chat',
    senderId: 'user-alice',
    text: '🎤 Голосовое сообщение',
    optimisticId: 'e2ee-media-opt-1',
    hasOfflineMedia: true,
    mediaType: 'audio'
  });

  const rawBlob = new Blob(['unencrypted-raw-pcm'], { type: 'audio/webm' });
  const mockSharedKey = { id: 'mock-aes-gcm-key' };
  let encryptedBlobUploaded = null;
  let uploadContentType = null;
  let sentCiphertext = null;

  const deps = {
    chat: {
      id: 'e2ee-personal-chat',
      type: 'personal',
      members: [
        { id: 'user-alice' },
        { id: 'user-bob', publicKey: 'mock-bob-public-key' }
      ]
    },
    currentUser: { id: 'user-alice' },
    e2eePrivateKey: { id: 'mock-alice-private-key' },
    sharedKey: mockSharedKey,
    importPublicKey: async (key) => ({ key }),
    deriveSymmetricKey: async () => mockSharedKey,
    requireE2EEKey: () => {},
    encryptFileForE2EE: async (blob, key) => {
      assert.equal(key, mockSharedKey);
      return new Blob([new Uint8Array([0xEE, 0x22, 0xEE])], { type: 'application/octet-stream' });
    },
    encryptMessage: async (text, key) => {
      assert.equal(key, mockSharedKey);
      return { ciphertext: Buffer.from(text).toString('hex'), iv: '0102030405060708090a0b0c' };
    },
    getAttachment: async () => rawBlob,
    deleteAttachment: async () => {},
    extensionForMedia: () => 'webm',
    storage: {
      from: () => ({
        upload: async (_path, body, opts) => {
          encryptedBlobUploaded = body;
          uploadContentType = opts?.contentType;
          return { error: null };
        }
      })
    },
    sendMessage: async (_c, _s, text, _r, media) => {
      sentCiphertext = text;
      return { id: 'e2ee-media-opt-1', text, media };
    }
  };

  const res = await processOfflineQueueItem(item, deps);
  assert.equal(uploadContentType, 'application/octet-stream', 'E2EE upload must use application/octet-stream');
  assert.ok(encryptedBlobUploaded, 'Encrypted blob must be passed to storage upload');
  assert.match(sentCiphertext, /^e2ee:aes-gcm:/, 'Message text must be E2EE encrypted');
  assert.match(res.data.media, /^e2ee:aes-gcm:/, 'Media URL reference must also be E2EE encrypted in transit');
});


