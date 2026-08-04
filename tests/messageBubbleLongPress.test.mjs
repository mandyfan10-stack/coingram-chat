import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bubble = await readFile(
  new URL('../src/components/chat/MessageBubble.jsx', import.meta.url),
  'utf8'
);

test('MessageBubble defines long-press handlers used on the bubble surface', () => {
  assert.match(bubble, /const handleBubblePointerDown = /);
  assert.match(bubble, /const handleBubblePointerMove = /);
  assert.match(bubble, /const clearLongPress = /);
  assert.match(bubble, /onPointerDown=\{handleBubblePointerDown\}/);
  assert.match(bubble, /onPointerMove=\{handleBubblePointerMove\}/);
  assert.match(bubble, /onPointerUp=\{clearLongPress\}/);
  assert.match(bubble, /onPointerCancel=\{clearLongPress\}/);
  assert.match(bubble, /setShowMsgActionsId\(msg\.id\)/);
});
