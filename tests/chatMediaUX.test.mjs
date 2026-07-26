import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chatArea = readFileSync(new URL('../src/components/ChatArea.jsx', import.meta.url), 'utf8');
const chatAreaCss = readFileSync(new URL('../src/components/ChatArea.css', import.meta.url), 'utf8');

test('incoming messages preserve the reader scroll position away from the bottom', () => {
  assert.match(chatArea, /shouldAutoScrollRef\.current = distanceFromBottom < 120/);
  assert.match(chatArea, /shouldAutoScrollRef\.current \|\| isOwnMessage/);
});

test('chat images open in an in-app viewer', () => {
  assert.match(chatArea, /className="chat-image-viewer"/);
  assert.match(chatArea, /onOpen=\{setOpenedImageUrl\}/);
  assert.match(chatAreaCss, /\.chat-image-viewer\s*\{/);
});

test('round video messages stop when playback reaches the end', () => {
  const player = chatArea.slice(
    chatArea.indexOf('function VideoMessagePlayer'),
    chatArea.indexOf('export default function ChatArea'),
  );
  assert.doesNotMatch(player, /\sloop(?:\s|=)/);
  assert.match(player, /setProgress\(100\)/);
  assert.match(player, /setHasEnded\(true\)/);
});
