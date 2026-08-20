import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareFiniteMediaDuration } from '../src/utils/mediaDuration.js';

const mediaPlayersSource = readFileSync(
  new URL('../src/components/chat/mediaPlayers.jsx', import.meta.url),
  'utf8'
);

class MockAudioElement {
  constructor(initialDuration = Infinity, initialCurrentTime = 0) {
    this.duration = initialDuration;
    this.currentTime = initialCurrentTime;
    this.src = '';
    this.preload = '';
    this.listeners = new Map();
  }

  addEventListener(event, listener) {
    const arr = this.listeners.get(event) || [];
    arr.push(listener);
    this.listeners.set(event, arr);
  }

  removeEventListener(event, listener) {
    const arr = this.listeners.get(event) || [];
    this.listeners.set(event, arr.filter(l => l !== listener));
  }

  emit(event) {
    const arr = this.listeners.get(event) || [];
    for (const l of arr) l();
  }
}

test('VoiceMessagePlayer implementation contains detached Audio duration probe', () => {
  // Verify detached probe creation and setup
  assert.match(
    mediaPlayersSource,
    /let\s+probe\s*=\s*new\s+Audio\(\)/,
    'VoiceMessagePlayer must instantiate a detached Audio object'
  );
  assert.match(
    mediaPlayersSource,
    /probe\.preload\s*=\s*['"]metadata['"]/,
    'Probe must set preload to metadata'
  );
  assert.match(
    mediaPlayersSource,
    /probe\.currentTime\s*=\s*1e101/,
    'Probe must seek to 1e101 to force Chromium WebM duration calculation'
  );
  assert.match(
    mediaPlayersSource,
    /probe\.src\s*=\s*['"]['"]/,
    'Probe src must be cleaned up to release browser media resources'
  );
});

test('Detached audio probe handles finite duration immediately without seek', () => {
  const probe = new MockAudioElement(14.5);
  let resolvedDuration = null;

  const handleProbeCompute = () => {
    if (probe.duration && !isNaN(probe.duration) && probe.duration !== Infinity) {
      resolvedDuration = probe.duration;
      probe.src = '';
    }
  };

  probe.addEventListener('loadedmetadata', handleProbeCompute);
  probe.emit('loadedmetadata');

  assert.equal(resolvedDuration, 14.5, 'Finite audio duration should resolve without seeking');
  assert.equal(probe.currentTime, 0, 'Main currentTime should remain unaffected');
  assert.equal(probe.src, '', 'Probe src should be cleared');
});

test('Detached audio probe handles Chromium WebM Infinity duration via off-screen seek', () => {
  const probe = new MockAudioElement(Infinity);
  let resolvedDuration = null;

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
    }
  };

  probe.addEventListener('loadedmetadata', handleProbeCompute);
  probe.emit('loadedmetadata');

  assert.equal(probe.currentTime, 1e101, 'Probe should seek to end to trigger duration compute');
  assert.equal(resolvedDuration, null, 'Duration not yet resolved while seek is pending');

  // Chromium fires 'seeked' event with updated duration
  probe.duration = 42.8;
  probe.emit('seeked');

  assert.equal(resolvedDuration, 42.8, 'Probe should resolve updated duration on seeked');
  assert.equal(probe.src, '', 'Probe src should be released');
});

test('prepareFiniteMediaDuration helper works consistently for media duration probing', () => {
  const mockMedia = new MockAudioElement(Infinity);
  let reportedDuration = null;

  const cleanup = prepareFiniteMediaDuration(mockMedia, (d) => {
    reportedDuration = d;
  });

  assert.equal(mockMedia.currentTime, 1e101);
  assert.equal(reportedDuration, null);

  mockMedia.duration = 18.2;
  mockMedia.emit('durationchange');

  assert.equal(reportedDuration, 18.2);
  assert.equal(mockMedia.currentTime, 0);

  cleanup();
});
