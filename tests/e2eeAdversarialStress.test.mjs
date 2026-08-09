import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  generateE2EEKeyPair,
  exportPublicKey,
  importPublicKey,
  exportPrivateKey,
  importPrivateKey,
  generateRecoveryCode,
  backupPrivateKey,
  restorePrivateKey,
  deriveSymmetricKey,
  encryptMessage,
  decryptMessage,
  encryptFileForE2EE,
  decryptFile
} from '../src/utils/e2eeHelper.js';

const e2eeHelperCode = readFileSync(new URL('../src/utils/e2eeHelper.js', import.meta.url), 'utf8');

// 1. PBKDF2 Iteration Count Verification
test('PBKDF2 uses explicitly 600,000 iterations for password key derivation', () => {
  assert.match(e2eeHelperCode, /iterations:\s*600000/, 'PBKDF2 must be set to 600,000 iterations');
});

// 2. Non-Extractable Key Operations & Export Prevention
test('Non-extractable private key operations (ECDH derive, encrypt, decrypt)', async () => {
  const keys = await generateE2EEKeyPair();
  const jwkString = await exportPrivateKey(keys.privateKey);

  // Import private key as NON-EXTRACTABLE
  const nonExtractableKey = await importPrivateKey(jwkString, false);
  assert.equal(nonExtractableKey.extractable, false, 'Key must be non-extractable');

  // Attempt to export non-extractable key MUST fail
  await assert.rejects(
    () => exportPrivateKey(nonExtractableKey),
    (err) => err instanceof Error || err.name === 'InvalidAccessError' || err.name === 'NotSupportedError',
    'Exporting non-extractable private key must be rejected'
  );

  // ECDH symmetric key derivation with non-extractable private key MUST succeed
  const bobKeys = await generateE2EEKeyPair();
  const bobPub = await importPublicKey(await exportPublicKey(bobKeys.publicKey));
  const sharedKey = await deriveSymmetricKey(nonExtractableKey, bobPub);
  assert.ok(sharedKey, 'Shared key must be derived successfully from non-extractable private key');
  assert.equal(sharedKey.extractable, false, 'Derived AES-GCM key must also be non-extractable');

  // Encryption & Decryption roundtrip with derived key
  const message = 'Secret payload with non-extractable key';
  const encrypted = await encryptMessage(message, sharedKey);
  const decrypted = await decryptMessage(encrypted.ciphertext, encrypted.iv, sharedKey);
  assert.equal(decrypted, message, 'Decrypted message must match original plaintext');

  // File blob encryption & decryption roundtrip
  const blobData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const originalBlob = new Blob([blobData], { type: 'application/json' });
  const encryptedBlob = await encryptFileForE2EE(originalBlob, sharedKey);
  const decryptedBlob = await decryptFile(encryptedBlob, sharedKey, 'application/json');
  const restoredBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
  assert.deepEqual([...restoredBytes], [...blobData], 'Decrypted file bytes must match original');
  assert.equal(decryptedBlob.type, 'application/json');
});

// 3. PBKDF2 Backup & Restore Roundtrip & Formatting Tolerance
test('PBKDF2 backup and restore roundtrip with password and recovery code', async () => {
  const keys = await generateE2EEKeyPair();
  const password = 'Super$ecure#Password99!';
  const recoveryCode = generateRecoveryCode();

  const backupJsonStr = await backupPrivateKey(keys.privateKey, password, recoveryCode);
  const backupObj = JSON.parse(backupJsonStr);

  assert.ok(backupObj.password_backup, 'Backup JSON must contain password_backup');
  assert.ok(backupObj.recovery_backup, 'Backup JSON must contain recovery_backup');
  assert.ok(backupObj.password_backup.ciphertext, 'password_backup must contain ciphertext');
  assert.ok(backupObj.password_backup.salt, 'password_backup must contain salt');
  assert.ok(backupObj.password_backup.iv, 'password_backup must contain iv');
  assert.ok(backupObj.recovery_backup.ciphertext, 'recovery_backup must contain ciphertext');

  // Restore via password
  const restoredFromPwd = await restorePrivateKey(backupJsonStr, password, false);
  assert.ok(restoredFromPwd, 'Restored key from password must be non-null');

  // Restore via recovery code (exact match)
  const restoredFromCode = await restorePrivateKey(backupJsonStr, recoveryCode, true);
  assert.ok(restoredFromCode, 'Restored key from recovery code must be non-null');

  // Restore via lowercase / unformatted recovery code
  const lowercaseCodeNoDashes = recoveryCode.replace(/-/g, '').toLowerCase();
  const restoredFromFormattedCode = await restorePrivateKey(backupJsonStr, lowercaseCodeNoDashes, true);
  assert.ok(restoredFromFormattedCode, 'Restored key from lowercase/unformatted recovery code must succeed');
});

// 4. Invalid Password and Recovery Code Rejection
test('Rejection of invalid passwords, corrupted recovery codes, and tampered ciphertexts', async () => {
  const keys = await generateE2EEKeyPair();
  const password = 'CorrectPassword123';
  const recoveryCode = generateRecoveryCode();
  const backupJsonStr = await backupPrivateKey(keys.privateKey, password, recoveryCode);

  // 4a. Wrong password
  await assert.rejects(
    () => restorePrivateKey(backupJsonStr, 'WrongPassword123', false),
    /./,
    'Wrong password must fail decryption'
  );

  // 4b. Wrong recovery code
  const anotherCode = generateRecoveryCode();
  await assert.rejects(
    () => restorePrivateKey(backupJsonStr, anotherCode, true),
    /./,
    'Wrong recovery code must fail decryption'
  );

  // 4c. Single character change in recovery code
  const tamperedCode = recoveryCode.slice(0, -1) + (recoveryCode.slice(-1) === 'A' ? 'B' : 'A');
  await assert.rejects(
    () => restorePrivateKey(backupJsonStr, tamperedCode, true),
    /./,
    'Single-char modified recovery code must fail decryption'
  );

  // 4d. Empty inputs
  await assert.rejects(
    () => restorePrivateKey(backupJsonStr, '', false),
    /./,
    'Empty password must fail decryption'
  );
  await assert.rejects(
    () => restorePrivateKey(backupJsonStr, '', true),
    /./,
    'Empty recovery code must fail decryption'
  );

  // 4e. Tampered ciphertext in password backup
  const backupObj = JSON.parse(backupJsonStr);
  const tamperedCiphertext = backupObj.password_backup.ciphertext.slice(0, -4) + '0000';
  const tamperedPwdBackupStr = JSON.stringify({
    ...backupObj,
    password_backup: { ...backupObj.password_backup, ciphertext: tamperedCiphertext }
  });
  await assert.rejects(
    () => restorePrivateKey(tamperedPwdBackupStr, password, false),
    /./,
    'Tampered ciphertext must fail AES-GCM authentication'
  );

  // 4f. Tampered IV in recovery backup
  const tamperedIv = '00'.repeat(12);
  const tamperedRecBackupStr = JSON.stringify({
    ...backupObj,
    recovery_backup: { ...backupObj.recovery_backup, iv: tamperedIv }
  });
  await assert.rejects(
    () => restorePrivateKey(tamperedRecBackupStr, recoveryCode, true),
    /./,
    'Tampered IV must fail AES-GCM authentication'
  );
});

// 5. Recovery Code Stress Test & Base32 Alphabet Coverage
test('Stress test generateRecoveryCode across 1000 samples for format, alphabet, and zero undefined', () => {
  const allowedChars = new Set('ABCDEFGHJKMNPQRSTVWXYZ2345678901');
  const seenChars = new Set();

  for (let i = 0; i < 1000; i++) {
    const code = generateRecoveryCode();
    assert.equal(code.length, 29, 'Recovery code length must be 29 chars (24 chars + 5 hyphens)');
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.doesNotMatch(code, /undefined|null|NaN/);

    const rawChars = code.replace(/-/g, '');
    for (const char of rawChars) {
      assert.ok(allowedChars.has(char), `Character '${char}' must belong to Base32 alphabet`);
      seenChars.add(char);
    }
  }

  // Verify all 32 characters in the custom Base32 alphabet appear in 1000 samples
  assert.equal(seenChars.size, 32, 'All 32 characters of the Base32 alphabet must be reachable');
});

// 6. Legacy Single-Backup Format Compatibility & Rejection
test('Legacy single-backup format behavior for password and recovery code restores', async () => {
  // Simulate legacy backup payload with only top-level ciphertext, salt, iv
  const legacyBackupStr = JSON.stringify({
    ciphertext: '1234567890abcdef',
    salt: '1234567890abcdef1234567890abcdef',
    iv: '1234567890abcdef12345678'
  });

  // Rejection when attempting recovery restore on legacy backup
  await assert.rejects(
    () => restorePrivateKey(legacyBackupStr, 'someCode', true),
    (err) => err.message.includes('Восстановление по коду недоступно для старых аккаунтов'),
    'Legacy backup recovery restore must reject with explicit user message'
  );
});
