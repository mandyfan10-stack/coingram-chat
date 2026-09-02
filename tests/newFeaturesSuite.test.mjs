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
  assert.match(chatAreaCode, /coingram_chat_scroll_/);
  assert.match(chatAreaCode, /getSavedChatScroll/);
  assert.match(chatAreaCode, /saveChatScroll/);
  assert.match(chatAreaCode, /saveCurrentScrollPosition/);
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
  const notif = await showIncomingNotification({ title: 'Test', body: 'Body' });
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

test('useChatUiState implements window.handleAndroidBackButton for Android hardware back', async () => {
  const uiStateCode = await readFile(
    new URL('../src/context/chat/useChatUiState.js', import.meta.url),
    'utf8'
  );
  assert.match(uiStateCode, /handleAndroidBackButton/);
});

test('MainActivity.java delegates onBackPressed to window.handleAndroidBackButton', async () => {
  const mainActivityCode = await readFile(
    new URL('../android/app/src/main/java/com/coingram/chat/MainActivity.java', import.meta.url),
    'utf8'
  );
  assert.match(mainActivityCode, /onBackPressed/);
  assert.match(mainActivityCode, /handleAndroidBackButton/);
});

test('getReplyPreviewText formats media and text reply previews intuitively without emojis', async () => {
  const { getReplyPreviewText, getReplyType } = await import('../src/utils/mobileActionSheetUtils.js');
  assert.equal(getReplyPreviewText({ text: 'Привет, как дела?' }), 'Привет, как дела?');
  assert.equal(getReplyPreviewText({ media: 'https://example.com/photo.jpg' }), 'Фото');
  assert.equal(getReplyPreviewText({ media: 'https://example.com/video.mp4', mediaType: 'video' }), 'Видео');
  assert.equal(getReplyPreviewText({ media: 'https://example.com/round.webm', mediaType: 'video_note' }), 'Видеосообщение');
  assert.equal(getReplyPreviewText({ media: 'https://example.com/voice.ogg', mediaType: 'voice' }), 'Голосовое сообщение');
  assert.equal(getReplyPreviewText({ media: 'https://example.com/sticker.tgs', mediaType: 'sticker' }), 'Стикер');
  assert.equal(getReplyPreviewText({ text: 'Подпись к фото', media: 'https://example.com/photo.jpg' }), 'Подпись к фото');

  assert.deepEqual(getReplyType({ media: 'https://example.com/photo.jpg' }), { type: 'image', label: 'Фото' });
  assert.deepEqual(getReplyType({ media: 'https://example.com/voice.ogg', mediaType: 'voice' }), { type: 'voice', label: 'Голосовое сообщение' });
});

test('ChatArea and MessageBubble use getReplyType and SVG icons for reply previews', () => {
  assert.match(chatAreaCode, /getReplyType\(replyingTo\)/);
  assert.match(messageBubbleCode, /getReplyType\(replyMsg\)/);
  assert.match(chatAreaCode, /reply-media-svg/);
  assert.match(messageBubbleCode, /reply-media-svg/);
});

test('ChatArea.css guarantees media bubble overflow: visible and precise desktop hover hitbox', async () => {
  const chatAreaCss = await readFile(
    new URL('../src/components/ChatArea.css', import.meta.url),
    'utf8'
  );
  assert.match(chatAreaCss, /\.message-bubble\.bubble-media-only\s*\{[^}]*overflow:\s*visible/s);
  assert.match(chatAreaCss, /\.message-bubble\.bubble-media-with-caption\s*\{[^}]*overflow:\s*visible/s);
  assert.match(chatAreaCss, /\.message-bubble\.bubble-media-only\s+\.bubble-media-wrapper\s*\{[^}]*overflow:\s*hidden/s);
  assert.ok(!chatAreaCss.includes('.message-row:hover .message-hover-actions'), 'Must not use full-width row hover for message action triggers');
});

test('StoryViewer implements robust separate manual pause and hold-to-pause gestures', async () => {
  const storyViewerCode = await readFile(
    new URL('../src/components/StoryViewer.jsx', import.meta.url),
    'utf8'
  );
  assert.match(storyViewerCode, /isManualPaused/);
  assert.match(storyViewerCode, /isHolding/);
  assert.match(storyViewerCode, /startTimeRef\.current\s*=\s*null;/);
  assert.match(storyViewerCode, /e\.code\s*===\s*'Space'/);
  assert.match(storyViewerCode, /handlePointerDown/);
  assert.match(storyViewerCode, /handlePointerUp/);
});

test('Telegram Stories: Story Studio camera/editor and StoryViewer cross-user playback and reactions', async () => {
  const createStoryCode = await readFile(
    new URL('../src/components/CreateStoryModal.jsx', import.meta.url),
    'utf8'
  );
  const storyViewerCode = await readFile(
    new URL('../src/components/StoryViewer.jsx', import.meta.url),
    'utf8'
  );
  const mediaServiceCode = await readFile(
    new URL('../src/services/mediaService.js', import.meta.url),
    'utf8'
  );

  // 1. CreateStoryModal provides live camera viewfinder & Telegram-style editor
  assert.match(createStoryCode, /getUserMedia/);
  assert.match(createStoryCode, /facingMode/);
  assert.match(createStoryCode, /handleCapturePhoto/);
  assert.match(createStoryCode, /story-shutter-btn/);
  assert.match(createStoryCode, /story-caption-pill/);
  assert.match(createStoryCode, /24 часа/);

  // 2. StoryViewer provides cross-user continuous playback, reactions, and owner actions
  assert.match(storyViewerCode, /groupedUsers/);
  assert.match(storyViewerCode, /currentUserGroupIndex/);
  assert.match(storyViewerCode, /story-reactions-row/);
  assert.match(storyViewerCode, /story-reply-form/);
  assert.match(storyViewerCode, /deleteStory/);
  assert.match(storyViewerCode, /story-owner-bar/);

  // 3. mediaService provides deleteStory capability
  assert.match(mediaServiceCode, /deleteStory:\s*async/);
});
