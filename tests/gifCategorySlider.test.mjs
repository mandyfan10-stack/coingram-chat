import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const mediaPickerJsx = await readFile(
  new URL('../src/components/chat/MediaPickerPanel.jsx', import.meta.url),
  'utf8'
);

const mediaPickerCss = await readFile(
  new URL('../src/components/chat/MediaPickerPanel.css', import.meta.url),
  'utf8'
);

test('MediaPickerPanel imports Chevron navigation icons from lucide-react', () => {
  assert.match(mediaPickerJsx, /ChevronLeft/);
  assert.match(mediaPickerJsx, /ChevronRight/);
});

test('MediaPickerPanel renders gif-cat-slider-container with slider buttons and pills', () => {
  assert.match(mediaPickerJsx, /gif-cat-slider-container/);
  assert.match(mediaPickerJsx, /gif-cat-slider-btn left/);
  assert.match(mediaPickerJsx, /gif-cat-slider-btn right/);
  assert.match(mediaPickerJsx, /canScrollLeft/);
  assert.match(mediaPickerJsx, /canScrollRight/);
  assert.match(mediaPickerJsx, /handlePillsSlide/);
});

test('MediaPickerPanel implements mouse wheel horizontal scrolling for categories', () => {
  assert.match(mediaPickerJsx, /deltaY/);
  assert.match(mediaPickerJsx, /scrollLeft\s*\+=\s*e\.deltaY/);
  assert.match(mediaPickerJsx, /addEventListener\('wheel'/);
});

test('MediaPickerPanel implements mouse drag-to-scroll for categories', () => {
  assert.match(mediaPickerJsx, /handlePillsMouseDown/);
  assert.match(mediaPickerJsx, /handlePillsMouseMove/);
  assert.match(mediaPickerJsx, /handlePillsMouseUpOrLeave/);
  assert.match(mediaPickerJsx, /isDraggingPills/);
});

test('MediaPickerPanel scrolls active category into view', () => {
  assert.match(mediaPickerJsx, /data-cat-id/);
  assert.match(mediaPickerJsx, /scrollIntoView/);
});

test('MediaPickerPanel CSS contains rules for slider container, buttons, and gradient fades', () => {
  assert.match(mediaPickerCss, /\.gif-cat-slider-container\s*\{/);
  assert.match(mediaPickerCss, /\.gif-cat-slider-btn\s*\{/);
  assert.match(mediaPickerCss, /\.gif-cat-slider-btn\.left\s*\{/);
  assert.match(mediaPickerCss, /\.gif-cat-slider-btn\.right\s*\{/);
  assert.match(mediaPickerCss, /\.gif-cat-slider-container\.has-left-overflow::before/);
  assert.match(mediaPickerCss, /\.gif-cat-slider-container\.has-right-overflow::after/);
  assert.match(mediaPickerCss, /scroll-behavior:\s*smooth/);
  assert.match(mediaPickerCss, /cursor:\s*grab/);
  assert.match(mediaPickerCss, /cursor:\s*grabbing/);
});
