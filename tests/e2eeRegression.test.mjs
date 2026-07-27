import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  generateE2EEKeyPair,
  exportPublicKey,
  importPublicKey,
  backupPrivateKey,
  restorePrivateKey,
  deriveSymmetricKey,
  encryptMessage,
  decryptMessage,
  encryptFileForE2EE,
  decryptFile
} from '../src/utils/e2eeHelper.js';

const chatInfo = readFileSync(new URL('../src/components/ChatInfo.jsx', import.meta.url), 'utf8');
const e2eeTab = readFileSync(new URL('../src/components/settings/E2EETab.jsx', import.meta.url), 'utf8');
const e2eeContext = readFileSync(new URL('../src/context/E2EEContext.jsx', import.meta.url), 'utf8');

test('wrong password cannot restore E2EE private key backup', async () => {
  const keys = await generateE2EEKeyPair();
  const backup = await backupPrivateKey(keys.privateKey, 'Correct#Password1', 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF');
  await assert.rejects(
    () => restorePrivateKey(backup, 'Wrong#Password1', false),
    /./,
    'restore with wrong password must reject'
  );
});

test('wrong recovery code cannot restore E2EE private key backup', async () => {
  const keys = await generateE2EEKeyPair();
  const backup = await backupPrivateKey(keys.privateKey, 'Correct#Password1', 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF');
  await assert.rejects(
    () => restorePrivateKey(backup, 'ZZZZ-YYYY-XXXX-WWWW-VVVV-UUUU', true),
    /./,
    'restore with wrong recovery code must reject'
  );
});

test('message decrypt after key re-derivation (reload simulation)', async () => {
  const alice = await generateE2EEKeyPair();
  const bob = await generateE2EEKeyPair();
  const bobPub = await importPublicKey(await exportPublicKey(bob.publicKey));

  const aliceShared = await deriveSymmetricKey(alice.privateKey, bobPub);
  const encrypted = await encryptMessage('reload-safe plaintext', aliceShared);

  // Simulate reload: re-import public key and re-derive
  const bobPubAgain = await importPublicKey(await exportPublicKey(bob.publicKey));
  const aliceSharedAfterReload = await deriveSymmetricKey(alice.privateKey, bobPubAgain);
  const decrypted = await decryptMessage(
    encrypted.ciphertext,
    encrypted.iv,
    aliceSharedAfterReload
  );
  assert.equal(decrypted, 'reload-safe plaintext');
});

test('media blob decrypt round-trip after re-derive', async () => {
  const alice = await generateE2EEKeyPair();
  const bob = await generateE2EEKeyPair();
  const bobPublic = await importPublicKey(await exportPublicKey(bob.publicKey));
  const shared = await deriveSymmetricKey(alice.privateKey, bobPublic);

  const bytes = new Uint8Array([9, 8, 7, 6, 5, 4]);
  const original = new Blob([bytes], { type: 'image/png' });
  const encrypted = await encryptFileForE2EE(original, shared);

  const alicePublic = await importPublicKey(await exportPublicKey(alice.publicKey));
  const bobShared = await deriveSymmetricKey(bob.privateKey, alicePublic);
  const decrypted = await decryptFile(encrypted, bobShared, 'image/png');
  const out = new Uint8Array(await decrypted.arrayBuffer());
  assert.deepEqual([...out], [...bytes]);
  assert.equal(decrypted.type, 'image/png');
});

test('UI exposes Safety Number and public key fingerprint surfaces', () => {
  assert.match(chatInfo, /computeSafetyNumber/);
  assert.match(chatInfo, /Код безопасности \(Safety Number\)/);
  assert.match(chatInfo, /safetyNumber/);
  assert.match(e2eeTab, /fingerprint-code/);
  assert.match(e2eeTab, /public_key/);
});

test('E2EE context persists and restores private key path', () => {
  assert.match(e2eeContext, /saveE2EEBackup|getE2EEBackup/);
  assert.match(e2eeContext, /backupPrivateKey|restorePrivateKey/);
});
