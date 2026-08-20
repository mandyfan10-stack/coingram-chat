import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { prepareFiniteMediaDuration } from '../src/utils/mediaDuration.js';

class MockMediaElement {
  constructor(duration, currentTime = 0) {
    this.duration = duration;
    this.currentTime = currentTime;
    this.listeners = new Map();
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    this.listeners.set(name, listeners.filter((item) => item !== listener));
  }

  emit(name) {
    for (const listener of this.listeners.get(name) ?? []) listener();
  }
}

test('finite video duration starts the viewer timeline from zero', () => {
  const media = new MockMediaElement(8.25, 8.25);
  const durations = [];

  prepareFiniteMediaDuration(media, (duration) => durations.push(duration));

  assert.equal(media.currentTime, 0);
  assert.deepEqual(durations, [8.25]);
});
test('WebM Infinity duration is probed before the viewer becomes ready', () => {
  const media = new MockMediaElement(Infinity);
  const durations = [];
  const cleanup = prepareFiniteMediaDuration(media, (duration) => durations.push(duration));

  assert.equal(media.currentTime, 1e101);
  assert.deepEqual(durations, []);

  media.duration = 12.5;
  media.emit('durationchange');

  assert.equal(media.currentTime, 0);
  assert.deepEqual(durations, [12.5]);

  cleanup();
  media.duration = 20;
  media.emit('durationchange');
  assert.deepEqual(durations, [12.5]);
});

test('ImageViewer hides native controls until duration probing finishes', () => {
  const source = readFileSync(new URL('../src/components/chat/ImageViewer.jsx', import.meta.url), 'utf8');

  assert.match(source, /prepareFiniteMediaDuration\(video/);
  assert.match(source, /controls=\{videoReady\}/);
  assert.match(source, /aria-busy=\{!videoReady\}/);
  assert.doesNotMatch(source, /\sautoPlay(?:\s|=)/);
});
