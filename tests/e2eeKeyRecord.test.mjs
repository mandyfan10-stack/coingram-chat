import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateKeyRecordCurrent } from '../src/utils/indexedDbHelper.js';

test('accepts only a local E2EE key tagged with the current public key', () => {
  const key = { type: 'private' };
  assert.equal(isPrivateKeyRecordCurrent({ key, publicKey: 'current' }, 'current'), true);
  assert.equal(isPrivateKeyRecordCurrent({ key, publicKey: 'old' }, 'current'), false);
});

test('rejects unversioned legacy local E2EE keys', () => {
  assert.equal(isPrivateKeyRecordCurrent({ type: 'private' }, 'current'), false);
  assert.equal(isPrivateKeyRecordCurrent(null, 'current'), false);
});