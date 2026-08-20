import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  generateE2EEKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSymmetricKey,
  encryptMessage,
  decryptMessage,
  encryptFileForE2EE,
  decryptFile,
  generateRecoveryCode,
  backupPrivateKey,
  restorePrivateKey
} from '../src/utils/e2eeHelper.js';

const e2eeHelperSource = readFileSync(
  new URL('../src/utils/e2eeHelper.js', import.meta.url),
  'utf8'
);

const e2eeV2Migration = readFileSync(
  new URL('../supabase/migrations/20260808194137_e2ee_v2_security_foundation.sql', import.meta.url),
  'utf8'
);

test('E2EE key generation creates P-256 ECDH keys and derives non-extractable AES-GCM keys', async () => {
  const alice = await generateE2EEKeyPair();
  const bob = await generateE2EEKeyPair();

  assert.ok(alice.privateKey);
  assert.ok(alice.publicKey);
  assert.equal(alice.privateKey.algorithm.name, 'ECDH');
  assert.equal(alice.publicKey.algorithm.name, 'ECDH');

  const bobPubStr = await exportPublicKey(bob.publicKey);
  const bobPubImported = await importPublicKey(bobPubStr);

  const aliceShared = await deriveSymmetricKey(alice.privateKey, bobPubImported);
  assert.equal(aliceShared.algorithm.name, 'AES-GCM');
  assert.equal(aliceShared.extractable, false, 'Derived AES-GCM shared key must not be extractable');
});

test('E2EE message & file encryption and decryption roundtrips match exactly', async () => {
  const alice = await generateE2EEKeyPair();
  const bob = await generateE2EEKeyPair();

  const alicePub = await importPublicKey(await exportPublicKey(alice.publicKey));
  const bobPub = await importPublicKey(await exportPublicKey(bob.publicKey));

  const aliceShared = await deriveSymmetricKey(alice.privateKey, bobPub);
  const bobShared = await deriveSymmetricKey(bob.privateKey, alicePub);

  // Message roundtrip
  const msg = 'Top secret coingram payload 🔐';
  const encryptedMsg = await encryptMessage(msg, aliceShared);
  assert.ok(encryptedMsg.ciphertext);
  assert.ok(encryptedMsg.iv);

  const decryptedMsg = await decryptMessage(encryptedMsg.ciphertext, encryptedMsg.iv, bobShared);
  assert.equal(decryptedMsg, msg);

  // File roundtrip
  const fileBytes = new Uint8Array([7, 14, 21, 28, 35, 42, 49, 56]);
  const originalBlob = new Blob([fileBytes], { type: 'audio/webm' });
  const encryptedBlob = await encryptFileForE2EE(originalBlob, aliceShared);
  const decryptedBlob = await decryptFile(encryptedBlob, bobShared, 'audio/webm');

  const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
  assert.deepEqual([...decryptedBytes], [...fileBytes]);
  assert.equal(decryptedBlob.type, 'audio/webm');
});

test('E2EE fails closed on tampered ciphertext or altered IV', async () => {
  const alice = await generateE2EEKeyPair();
  const bob = await generateE2EEKeyPair();
  const shared = await deriveSymmetricKey(alice.privateKey, bob.publicKey);

  const encrypted = await encryptMessage('Untampered', shared);

  // Alter last char of ciphertext
  const tamperedCipher = encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.endsWith('00') ? 'ff' : '00');
  await assert.rejects(
    () => decryptMessage(tamperedCipher, encrypted.iv, shared),
    /OperationError|operation failed|cipher/i
  );

  // Alter last char of IV
  const tamperedIv = encrypted.iv.slice(0, -2) + (encrypted.iv.endsWith('00') ? 'ff' : '00');
  await assert.rejects(
    () => decryptMessage(encrypted.ciphertext, tamperedIv, shared),
    /OperationError|operation failed|cipher/i
  );
});

test('Private key backup uses PBKDF2 with 600,000 iterations and Base32 recovery codes', async () => {
  assert.match(
    e2eeHelperSource,
    /iterations:\s*600000/,
    'PBKDF2 must use 600,000 iterations'
  );

  const keys = await generateE2EEKeyPair();
  const recoveryCode = generateRecoveryCode();
  assert.match(recoveryCode, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  const backupJson = await backupPrivateKey(keys.privateKey, 'MyStrongP@ssword1', recoveryCode);
  const restoredFromPwd = await restorePrivateKey(backupJson, 'MyStrongP@ssword1', false);
  const restoredFromCode = await restorePrivateKey(backupJson, recoveryCode, true);

  assert.ok(restoredFromPwd);
  assert.ok(restoredFromCode);
});

test('MLS / E2EE v2 migration enforces atomic keypackage claim with FOR UPDATE SKIP LOCKED', () => {
  assert.match(
    e2eeV2Migration,
    /for\s+update(\s+of\s+\w+)?\s+skip\s+locked/i,
    'KeyPackage claim query must use FOR UPDATE SKIP LOCKED to prevent concurrency races'
  );
  assert.match(
    e2eeV2Migration,
    /e2ee_key_packages/i,
    'E2EE v2 migration must define e2ee_key_packages table'
  );
});
