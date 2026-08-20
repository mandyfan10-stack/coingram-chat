import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSupportedRecordingMimeTypes,
  normalizeRecordingMimeType,
} from '../src/utils/mediaRecording.ts';
import { extensionForMedia } from '../src/utils/mediaValidation.ts';

test('mobile Safari recording falls back to MP4 for voice and video notes', () => {
  const safariRecorder = {
    isTypeSupported: (mimeType) => mimeType === 'audio/mp4' || mimeType === 'video/mp4',
  };

  assert.deepEqual(getSupportedRecordingMimeTypes('voice', safariRecorder), ['audio/mp4']);
  assert.deepEqual(getSupportedRecordingMimeTypes('video', safariRecorder), ['video/mp4']);
});

test('recording MIME normalization preserves the actual mobile container', () => {
  assert.equal(normalizeRecordingMimeType('audio/mp4;codecs=mp4a.40.2', 'voice'), 'audio/mp4');
  assert.equal(normalizeRecordingMimeType('video/mp4;codecs=avc1.42E01E', 'video'), 'video/mp4');
  assert.equal(extensionForMedia('audio/mp4;codecs=mp4a.40.2', 'audio'), 'm4a');
  assert.equal(extensionForMedia('video/mp4;codecs=avc1.42E01E', 'video'), 'mp4');
});

test('recording MIME normalization fails safely when a browser omits its type', () => {
  assert.equal(normalizeRecordingMimeType('', 'voice'), 'audio/webm');
  assert.equal(normalizeRecordingMimeType(null, 'video'), 'video/webm');
});
