import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  extractMessageText,
  copyTextToClipboard,
  canUserDeleteMessage,
  triggerHaptic
} from '../src/utils/mobileActionSheetUtils.js';
import { normalizeReaction } from '../src/utils/reactionUtils.ts';

const sheetCode = await readFile(
  new URL('../src/components/chat/MobileActionSheet.jsx', import.meta.url),
  'utf8'
);
const bubbleCode = await readFile(
  new URL('../src/components/chat/MessageBubble.jsx', import.meta.url),
  'utf8'
);
const cssCode = await readFile(
  new URL('../src/components/chat/MobileActionSheet.css', import.meta.url),
  'utf8'
);

// ===========================================================================
// CATEGORY 1: extractMessageText Exhaustive Edge-Case & Payload Testing
// ===========================================================================

test('EMPIRICAL [M2-T1.1]: extractMessageText handles empty, whitespace, and non-string inputs safely', () => {
  assert.equal(extractMessageText(null), '');
  assert.equal(extractMessageText(undefined), '');
  assert.equal(extractMessageText('string payload'), '');
  assert.equal(extractMessageText(12345), '');
  assert.equal(extractMessageText(true), '');
  assert.equal(extractMessageText(false), '');
  assert.equal(extractMessageText([]), '');
  assert.equal(extractMessageText({}), '');

  assert.equal(extractMessageText({ text: null }), '');
  assert.equal(extractMessageText({ text: undefined }), '');
  assert.equal(extractMessageText({ text: 12345 }), '');
  assert.equal(extractMessageText({ text: {} }), '');
  assert.equal(extractMessageText({ text: [] }), '');
  assert.equal(extractMessageText({ text: true }), '');

  assert.equal(extractMessageText({ text: '' }), '');
  assert.equal(extractMessageText({ text: '   ' }), '');
  assert.equal(extractMessageText({ text: '\t\n\r  \n' }), '');
  assert.equal(extractMessageText({ caption: '' }), '');
  assert.equal(extractMessageText({ caption: '   ' }), '');
  assert.equal(extractMessageText({ text: '   ', caption: '   ' }), '');
});

test('EMPIRICAL [M2-T1.2]: extractMessageText trims valid text and preserves multiline content', () => {
  assert.equal(extractMessageText({ text: 'Hello world' }), 'Hello world');
  assert.equal(extractMessageText({ text: '  Leading and trailing spaces  ' }), 'Leading and trailing spaces');
  assert.equal(extractMessageText({ text: 'Line 1\nLine 2\nLine 3' }), 'Line 1\nLine 2\nLine 3');
  assert.equal(extractMessageText({ text: '   Line 1\nLine 2   ' }), 'Line 1\nLine 2');
});

test('EMPIRICAL [M2-T1.3]: extractMessageText handles media captions & priority fallback', () => {
  assert.equal(extractMessageText({ caption: 'Check this sunset' }), 'Check this sunset');
  assert.equal(extractMessageText({ caption: '  Trimmed caption  ', media: 'https://cdn.example.com/p.jpg' }), 'Trimmed caption');

  assert.equal(
    extractMessageText({ text: 'Primary text', caption: 'Secondary caption' }),
    'Primary text'
  );

  assert.equal(
    extractMessageText({ text: '   ', caption: 'Fallback caption' }),
    'Fallback caption'
  );
});

test('EMPIRICAL [M2-T1.4]: extractMessageText filters all media placeholders, voice, video notes, and stickers', () => {
  const placeholders = [
    '🖼️ [Изображение]',
    '[Изображение]',
    'Изображение',
    '🎬 [Видео]',
    '[Видео]',
    'Видео'
  ];

  for (const placeholder of placeholders) {
    assert.equal(extractMessageText({ text: placeholder }), '', `Should filter placeholder: ${placeholder}`);
    assert.equal(extractMessageText({ caption: placeholder }), '', `Should filter caption placeholder: ${placeholder}`);
  }

  assert.equal(extractMessageText({ text: '🎤 Голосовое сообщение (0:15)' }), '');
  assert.equal(extractMessageText({ text: '🎤 Голосовое сообщение (1:30)' }), '');
  assert.equal(extractMessageText({ text: 'Голосовое сообщение' }), '');

  assert.equal(extractMessageText({ text: '🎬 Видеосообщение (0:45)' }), '');
  assert.equal(extractMessageText({ text: 'Видеосообщение' }), '');

  assert.equal(extractMessageText({ text: 'sticker:tgs:crypto_pack_01' }), '');
  assert.equal(extractMessageText({ text: 'sticker:webp:stars_99' }), '');
});

test('EMPIRICAL [M2-T1.5]: extractMessageText handles forwarded message structures', () => {
  assert.equal(
    extractMessageText({ text: 'Forwarded message body', isForwarded: true, forwardedFrom: 'Alice' }),
    'Forwarded message body'
  );
  assert.equal(
    extractMessageText({ caption: 'Forwarded photo caption', isForwarded: true, forwardedFrom: 'Bob' }),
    'Forwarded photo caption'
  );
  assert.equal(
    extractMessageText({ text: '🖼️ [Изображение]', isForwarded: true, forwardedFrom: 'Charlie' }),
    ''
  );
});

// ===========================================================================
// CATEGORY 2: canUserDeleteMessage Permission Matrix & Default Prop Analysis
// ===========================================================================

test('EMPIRICAL [M2-T2.1]: canUserDeleteMessage strict permission matrix evaluation', () => {
  const currentUser = { id: 'usr_me_1', name: 'Alice' };

  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, { id: 'chat1' }, false), false);
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, { id: 'chat1' }, true), true);
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, { id: 'chat1' }, undefined, true), true);
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, { id: 'chat1' }, undefined, false), false);

  assert.equal(canUserDeleteMessage({ senderId: 'usr_me_1' }, currentUser, { id: 'group_1' }), true);
  assert.equal(canUserDeleteMessage({ sender_id: 'usr_me_1' }, currentUser, { id: 'group_1' }), true);
  assert.equal(canUserDeleteMessage({ senderId: 'current' }, currentUser, { id: 'group_1' }), true);
  assert.equal(canUserDeleteMessage({ sender_id: 'current' }, currentUser, { id: 'group_1' }), true);
  assert.equal(canUserDeleteMessage({ isOutgoing: true }, currentUser, { id: 'group_1' }), true);
  assert.equal(canUserDeleteMessage({ isMe: true }, currentUser, { id: 'group_1' }), true);

  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, { id: 'saved' }), true);
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, { id: 'chat_x', isSaved: true }), true);
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, { id: 'chat_x', type: 'saved' }), true);

  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, { id: 'dm_1', type: 'direct' }), true);

  const adminChat = {
    id: 'grp_1',
    members: [{ id: 'usr_me_1', role: 'admin' }, { id: 'usr_other', role: 'member' }]
  };
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, adminChat), true);

  const ownerChat = {
    id: 'grp_2',
    members: [{ id: 'usr_me_1', role: 'owner' }, { id: 'usr_other', role: 'member' }]
  };
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, ownerChat), true);

  const creatorChat = {
    id: 'grp_3',
    creatorId: 'usr_me_1',
    members: [{ id: 'usr_me_1', role: 'member' }, { id: 'usr_other', role: 'member' }]
  };
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, creatorChat), true);

  const regularGroup = {
    id: 'grp_regular',
    type: 'group',
    creatorId: 'usr_boss',
    members: [{ id: 'usr_me_1', role: 'member' }, { id: 'usr_other', role: 'member' }]
  };
  assert.equal(canUserDeleteMessage({ senderId: 'usr_other' }, currentUser, regularGroup), false);
});

test('EMPIRICAL [M2-T2.2]: Nullish and malformed payload resilience in canUserDeleteMessage', () => {
  const currentUser = { id: 'usr_me_1' };
  const chat = { id: 'grp_1', type: 'group' };

  assert.equal(canUserDeleteMessage(null, currentUser, chat), false);
  assert.equal(canUserDeleteMessage(undefined, currentUser, chat), false);
  assert.equal(canUserDeleteMessage('invalid', currentUser, chat), false);
});

test('EMPIRICAL [M2-T2.3]: canUserDeleteMessage safely denies unauthenticated or empty session delete permissions', () => {
  const unauthedResult = canUserDeleteMessage({}, null, { id: 'group_1', type: 'group' });
  const emptyUserResult = canUserDeleteMessage({}, {}, { id: 'group_1', type: 'group' });
  
  assert.equal(unauthedResult, false, 'Unauthenticated user without senderId must not have delete permission');
  assert.equal(emptyUserResult, false, 'Empty user object without senderId must not have delete permission');
});

// ===========================================================================
// CATEGORY 3: Multi-Tier Clipboard Copy Resilience & Failure Handlers
// ===========================================================================

test('EMPIRICAL [M2-T3.1]: copyTextToClipboard successfully utilizes Tier 1 navigator.clipboard', async () => {
  let copiedValue = null;
  const originalClipboard = globalThis.navigator.clipboard;

  try {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: async (text) => {
          copiedValue = text;
        }
      },
      configurable: true
    });

    const res = await copyTextToClipboard('Test tier 1 copy');
    assert.equal(res, true);
    assert.equal(copiedValue, 'Test tier 1 copy');
  } finally {
    if (originalClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', { value: originalClipboard, configurable: true });
    } else {
      delete globalThis.navigator.clipboard;
    }
  }
});

test('EMPIRICAL [M2-T3.2]: copyTextToClipboard falls back to Tier 2 execCommand when Tier 1 throws', async () => {
  const originalClipboard = globalThis.navigator.clipboard;
  const origDoc = globalThis.document;

  try {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('NotAllowedError: Permission denied');
        }
      },
      configurable: true
    });

    let appendedElement = null;
    let removedElement = null;
    let executedCommand = null;

    globalThis.document = {
      body: {
        appendChild: (el) => { appendedElement = el; },
        removeChild: (el) => { removedElement = el; }
      },
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        value: '',
        style: {},
        setAttribute: () => {},
        focus: () => {},
        select: () => {},
        setSelectionRange: () => {}
      }),
      execCommand: (cmd) => {
        executedCommand = cmd;
        return true;
      }
    };

    const res = await copyTextToClipboard('Tier 2 fallback payload');
    assert.equal(res, true);
    assert.equal(executedCommand, 'copy');
    assert.equal(appendedElement.value, 'Tier 2 fallback payload');
    assert.equal(removedElement, appendedElement);
  } finally {
    if (originalClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', { value: originalClipboard, configurable: true });
    } else {
      delete globalThis.navigator.clipboard;
    }
    globalThis.document = origDoc;
  }
});

test('EMPIRICAL [M2-T3.3]: copyTextToClipboard returns false when both Tier 1 and Tier 2 fail', async () => {
  const originalClipboard = globalThis.navigator.clipboard;
  const origDoc = globalThis.document;

  try {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('NotAllowedError');
        }
      },
      configurable: true
    });

    globalThis.document = {
      body: {
        appendChild: () => {},
        removeChild: () => {}
      },
      createElement: () => ({
        style: {},
        setAttribute: () => {},
        focus: () => {},
        select: () => {},
        setSelectionRange: () => {}
      }),
      execCommand: () => false
    };

    const res = await copyTextToClipboard('Should fail completely');
    assert.equal(res, false);
  } finally {
    if (originalClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', { value: originalClipboard, configurable: true });
    } else {
      delete globalThis.navigator.clipboard;
    }
    globalThis.document = origDoc;
  }
});

test('EMPIRICAL [M2-T3.4]: copyTextToClipboard handles missing global objects safely without crash', async () => {
  const originalClipboard = globalThis.navigator.clipboard;
  const origDoc = globalThis.document;

  try {
    delete globalThis.navigator.clipboard;
    delete globalThis.document;

    const res = await copyTextToClipboard('Payload without globals');
    assert.equal(res, false);
  } finally {
    if (originalClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', { value: originalClipboard, configurable: true });
    }
    globalThis.document = origDoc;
  }
});

// ===========================================================================
// CATEGORY 4: Reaction Normalization & Active State Matching Under Stress
// ===========================================================================

test('EMPIRICAL [M2-T4.1]: Reaction matching handles malformed, legacy, and null reaction objects', () => {
  const currentUser = { id: 'usr_me_1' };

  const testReactions = [
    null,
    undefined,
    'invalid_reaction_string',
    { emoji: '❤️' },
    { emoji: '🔥', users: ['usr_other', 'usr_me_1'] },
    { emoji: '👍', userId: 'current' },
    { emoji: '😂', userId: 'me' },
    { emoji: '👏', users: ['usr_other'] }
  ];

  const isEmojiActive = (emo) => {
    return testReactions.some((r) => {
      if (!r || typeof r !== 'object') return false;
      const norm = normalizeReaction(r);
      return (
        r.emoji === emo &&
        (norm.users.includes('current') ||
          norm.users.includes('me') ||
          (currentUser && norm.users.includes(currentUser.id)))
      );
    });
  };

  assert.equal(isEmojiActive('🔥'), true);
  assert.equal(isEmojiActive('👍'), true);
  assert.equal(isEmojiActive('😂'), true);
  assert.equal(isEmojiActive('❤️'), false);
  assert.equal(isEmojiActive('👏'), false);
  assert.equal(isEmojiActive('🎉'), false);
});

test('EMPIRICAL [M2-T4.2]: Rapid 100-cycle reaction toggle stress does not mutate source data', () => {
  let reactions = [
    { emoji: '❤️', users: ['usr_other'], count: 1 },
    { emoji: '👍', users: ['usr_me_1'], count: 1 }
  ];

  for (let i = 0; i < 100; i++) {
    const updated = reactions.map(r => normalizeReaction(r));
    assert(Array.isArray(updated));
  }
  assert.equal(reactions.length, 2);
});

// ===========================================================================
// CATEGORY 5: Component Defects & Vulnerability Verifications
// ===========================================================================

test('EMPIRICAL [M2-T5.1]: MobileActionSheet.jsx passes copyableText to clipboard copy', () => {
  assert.match(
    sheetCode,
    /copyTextToClipboard\s*\(\s*copyableText\s*\)/,
    'MobileActionSheet must pass copyableText to copyTextToClipboard'
  );
  assert.doesNotMatch(
    sheetCode,
    /navigator\.clipboard(?:\.|\?\.)writeText\(msg\.text\)/,
    'MobileActionSheet must not directly pass raw msg.text to writeText'
  );
});

test('EMPIRICAL [M2-T5.2]: MobileActionSheet.jsx renders copy button strictly when copyableText is truthy', () => {
  assert.match(
    sheetCode,
    /\{\s*Boolean\(copyableText\)\s*&&\s*\(/,
    'Copy button must be rendered strictly with Boolean(copyableText)'
  );
  assert.doesNotMatch(
    sheetCode,
    /Boolean\(copyableText\)\s*\|\|\s*Boolean\(msg\.text\)/,
    'Copy button must not use fallback to raw msg.text'
  );
});

test('EMPIRICAL [M2-T5.3]: canDelete prop in MobileActionSheet.jsx does not default to true', () => {
  assert.doesNotMatch(
    sheetCode,
    /canDelete\s*=\s*true/,
    'canDelete must not default to true'
  );
  assert.match(
    bubbleCode,
    /<MobileActionSheet/,
    'MessageBubble must mount MobileActionSheet'
  );
});

test('EMPIRICAL [M2-T5.4]: handleCopyText checks copyTextToClipboard result before setting copied state', () => {
  assert.match(
    sheetCode,
    /const\s+success\s*=\s*await\s+copyTextToClipboard\(copyableText\);[\s\S]*?if\s*\(\s*success\s*\)\s*\{[\s\S]*?setCopied\(true\);/,
    'handleCopyText must verify copy success before setting copied state'
  );
});

test('EMPIRICAL [M2-T5.5]: Safe haptic invocation with out-of-range or throwing navigator.vibrate', () => {
  const origVibrate = globalThis.navigator.vibrate;

  try {
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: () => {
        throw new Error('Vibrate permission rejected by platform');
      },
      configurable: true
    });
    assert.doesNotThrow(() => {
      triggerHaptic(12);
      triggerHaptic(0);
      triggerHaptic(-10);
      triggerHaptic(99999);
      triggerHaptic(null);
      triggerHaptic(undefined);
    });
  } finally {
    if (origVibrate) {
      Object.defineProperty(globalThis.navigator, 'vibrate', { value: origVibrate, configurable: true });
    } else {
      delete globalThis.navigator.vibrate;
    }
  }
});

// ===========================================================================
// CATEGORY 6: Dual-Contract & Handler Safety Verification
// ===========================================================================

test('EMPIRICAL [M2-T6.1]: MobileActionSheet dual handler contracts and fallback paths', () => {
  assert.match(sheetCode, /typeof onReactionSelect === 'function'/);
  assert.match(sheetCode, /typeof toggleReaction === 'function'/);

  assert.match(sheetCode, /typeof onReply === 'function'/);
  assert.match(sheetCode, /typeof setReplyingTo === 'function'/);

  assert.match(sheetCode, /typeof onDelete === 'function'/);
  assert.match(sheetCode, /typeof deleteMessage === 'function'/);

  assert.match(sheetCode, /typeof onCopy === 'function'/);
});

test('EMPIRICAL [M2-T6.2]: MobileActionSheet.css enforces accessibility, touch targets >= 44px, and safe area', () => {
  assert.match(cssCode, /min-height:\s*48px/);
  assert.match(cssCode, /width:\s*44px/);
  assert.match(cssCode, /height:\s*44px/);
  assert.match(cssCode, /env\(safe-area-inset-bottom/);
  assert.match(cssCode, /touch-action:\s*manipulation/);
  assert.match(cssCode, /@media \(prefers-reduced-motion: reduce\)/);
});
