import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showIncomingNotification
} from '../src/services/notificationService.js';
import useEdgeSwipeBack from '../src/hooks/useSwipeGesture.js';

const callOverlayCode = await readFile(
  new URL('../src/components/call/CallOverlay.jsx', import.meta.url),
  'utf8'
);
const messageBubbleCode = await readFile(
  new URL('../src/components/chat/MessageBubble.jsx', import.meta.url),
  'utf8'
);
const chatAreaCode = await readFile(
  new URL('../src/components/ChatArea.jsx', import.meta.url),
  'utf8'
);
const useMessageTouchCode = await readFile(
  new URL('../src/hooks/useMessageTouch.js', import.meta.url),
  'utf8'
);
const appearanceTabCode = await readFile(
  new URL('../src/components/settings/AppearanceTab.jsx', import.meta.url),
  'utf8'
);

test('CallOverlay renders Sparkles icon with intuitive noise suppression title and aria-label', () => {
  assert.match(callOverlayCode, /<Sparkles\s+size=\{20\}\s*\/>/);
  assert.match(callOverlayCode, /Шумоподавление:\s*Включено/);
  assert.match(callOverlayCode, /Шумоподавление:\s*Выключено/);
});

test('useMessageTouch hook provides swipe-to-reply gesture support', () => {
  assert.match(useMessageTouchCode, /onSwipeReply/);
  assert.match(useMessageTouchCode, /swipeOffset/);
  assert.match(useMessageTouchCode, /isSwiping/);
});

test('MessageBubble integrates swipeOffset transform and reply indicator', () => {
  assert.match(messageBubbleCode, /onSwipeReply/);
  assert.match(messageBubbleCode, /transform:\s*swipeOffset\s*\?\s*`translateX\(\$\{swipeOffset\}px\)`/);
  assert.match(messageBubbleCode, /message-swipe-reply-indicator/);
});

test('ChatArea preserves scroll positions per chat and handles unread divider', () => {
  assert.match(chatAreaCode, /chatScrollPositionsRef/);
  assert.match(chatAreaCode, /unread-messages-divider/);
  assert.match(chatAreaCode, /Непрочитанные сообщения/);
  assert.match(chatAreaCode, /useEdgeSwipeBack/);
});

test('useSwipeGesture module exports useEdgeSwipeBack function', () => {
  assert.equal(typeof useEdgeSwipeBack, 'function');
});

test('notificationService safely handles non-browser / node environments without crashing', async () => {
  assert.equal(isNotificationSupported(), false);
  assert.equal(getNotificationPermission(), 'denied');
  const perm = await requestNotificationPermission();
  assert.equal(perm, 'denied');
  const notif = showIncomingNotification({ title: 'Test', body: 'Body' });
  assert.equal(notif, null);
});

test('AppearanceTab requests notification permissions on toggle', () => {
  assert.match(appearanceTabCode, /requestNotificationPermission/);
  assert.match(appearanceTabCode, /Звуковые и push-уведомления/);
});

test('Video message metadata is placed at top right to prevent collision with bottom seek timeline', async () => {
  const chatAreaCss = await readFile(
    new URL('../src/components/ChatArea.css', import.meta.url),
    'utf8'
  );
  assert.match(messageBubbleCode, /video-floating-badge/);
  assert.match(chatAreaCss, /\.bubble-metadata\.floating-badge\.video-floating-badge\s*\{[^}]*top:\s*8px/);
});

