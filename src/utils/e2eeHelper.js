if (typeof window === 'undefined') {
  globalThis.window = { crypto: globalThis.crypto };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Helper to convert ArrayBuffer to Hex String
function bufToHex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

// Helper to convert Hex String to Uint8Array
function hexToBuf(hexString) {
  const badCharacters = /[^0-9a-fA-F]/g;
  const cleanHex = hexString.replace(badCharacters, '');
  const result = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    result[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return result;
}

// 1. Generate ECDH Key Pair
export async function generateE2EEKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );
}

// 2. Export / Import Public Key to JWK
export async function exportPublicKey(key) {
  const jwk = await window.crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    []
  );
}

// 3. Export / Import Private Key to JWK
export async function exportPrivateKey(key) {
  const jwk = await window.crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPrivateKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// 4. Derive AES-GCM Key from Password via PBKDF2
async function derivePasswordKey(password, salt) {
  const passwordKeyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000,
      hash: 'SHA-256'
    },
    passwordKeyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// 4.5 Generate 24-character Recovery Code
export function generateRecoveryCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
  const array = new Uint8Array(24);
  window.crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < 24; i++) {
    if (i > 0 && i % 4 === 0) {
      result += '-';
    }
    const val = array[i] % chars.length;
    result += chars[val];
  }
  return result;
}

// 5. Encrypt Private Key (Cloud Backup)
export async function backupPrivateKey(privateKey, password, recoveryCode) {
  const privateKeyJwk = await exportPrivateKey(privateKey);
  const rawJwk = encoder.encode(privateKeyJwk);

  // 1. Password backup
  const saltPwd = window.crypto.getRandomValues(new Uint8Array(16));
  const ivPwd = window.crypto.getRandomValues(new Uint8Array(12));
  const aesKeyPwd = await derivePasswordKey(password, saltPwd);
  const encryptedContentPwd = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivPwd },
    aesKeyPwd,
    rawJwk
  );

  const pwdBackup = {
    ciphertext: bufToHex(encryptedContentPwd),
    salt: bufToHex(saltPwd),
    iv: bufToHex(ivPwd)
  };

  // 2. Recovery code backup (clean formatting dashes first)
  const cleanRecoveryCode = recoveryCode.replace(/-/g, '').toUpperCase();
  const saltRec = window.crypto.getRandomValues(new Uint8Array(16));
  const ivRec = window.crypto.getRandomValues(new Uint8Array(12));
  const aesKeyRec = await derivePasswordKey(cleanRecoveryCode, saltRec);
  const encryptedContentRec = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivRec },
    aesKeyRec,
    rawJwk
  );

  const recBackup = {
    ciphertext: bufToHex(encryptedContentRec),
    salt: bufToHex(saltRec),
    iv: bufToHex(ivRec)
  };

  return JSON.stringify({
    password_backup: pwdBackup,
    recovery_backup: recBackup
  });
}

// 6. Decrypt Private Key (Restore Backup)
export async function restorePrivateKey(backupJsonString, secret, isRecovery = false) {
  const backup = JSON.parse(backupJsonString);

  // Backward compatibility: check if it's the old single-backup format
  if (backup.ciphertext && backup.salt && backup.iv) {
    if (isRecovery) {
      throw new Error("Восстановление по коду недоступно для старых аккаунтов. Пожалуйста, используйте ваш пароль.");
    }
    const ciphertext = hexToBuf(backup.ciphertext);
    const salt = hexToBuf(backup.salt);
    const iv = hexToBuf(backup.iv);

    const aesKey = await derivePasswordKey(secret, salt);
    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      aesKey,
      ciphertext
    );
    const jwkString = decoder.decode(decryptedContent);
    return await importPrivateKey(jwkString);
  }

  // Dual-backup format
  const targetBackup = isRecovery ? backup.recovery_backup : backup.password_backup;
  if (!targetBackup) {
    throw new Error("Неверный формат резервной копии ключей.");
  }

  const ciphertext = hexToBuf(targetBackup.ciphertext);
  const salt = hexToBuf(targetBackup.salt);
  const iv = hexToBuf(targetBackup.iv);

  const cleanSecret = isRecovery ? secret.replace(/-/g, '').toUpperCase() : secret;
  const aesKey = await derivePasswordKey(cleanSecret, salt);
  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    aesKey,
    ciphertext
  );

  const jwkString = decoder.decode(decryptedContent);
  return await importPrivateKey(jwkString);
}

// 7. Derive Shared Symmetric Key (ECDH)
export async function deriveSymmetricKey(privateKey, otherPublicKey) {
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: otherPublicKey
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false, // extractable (disabled for security)
    ['encrypt', 'decrypt']
  );
}

// 8. Encrypt Message using Derived AES-GCM Key
export async function encryptMessage(plaintext, aesKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: bufToHex(encryptedContent),
    iv: bufToHex(iv)
  };
}

// 9. Decrypt Message using Derived AES-GCM Key
export async function decryptMessage(ciphertextHex, ivHex, aesKey) {
  const ciphertext = hexToBuf(ciphertextHex);
  const iv = hexToBuf(ivHex);

  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    ciphertext
  );

  return decoder.decode(decryptedContent);
}

// 10. Encrypt File Blob using AES-GCM Key
export async function encryptFile(fileBlob, aesKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const arrayBuffer = await fileBlob.arrayBuffer();
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    aesKey,
    arrayBuffer
  );

  // Combine IV and ciphertext into a single binary blob
  const resultBuffer = new Uint8Array(iv.length + encryptedContent.byteLength);
  resultBuffer.set(iv, 0);
  resultBuffer.set(new Uint8Array(encryptedContent), iv.length);
  return new Blob([resultBuffer], { type: 'application/octet-stream' });
}

// 11. Decrypt File Blob using AES-GCM Key
export async function decryptFile(encryptedBlob, aesKey, outputType = '') {
  const arrayBuffer = await encryptedBlob.arrayBuffer();
  const iv = new Uint8Array(arrayBuffer, 0, 12);
  const ciphertext = new Uint8Array(arrayBuffer, 12);
  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    aesKey,
    ciphertext
  );
  return new Blob([decryptedContent], outputType ? { type: outputType } : undefined);
}

