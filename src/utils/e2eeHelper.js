import { argon2id } from 'hash-wasm';

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
  if (typeof hexString !== 'string' || hexString.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hexString)) {
    throw new Error('Invalid hexadecimal crypto payload.');
  }
  const result = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    result[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
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

export async function importPrivateKey(jwkString, extractable = true) {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    extractable,
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

const ARGON2ID_PARAMETERS = Object.freeze({
  memorySize: 65536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32
});

async function deriveArgon2idKey(secret, salt, parameters = ARGON2ID_PARAMETERS) {
  if (
    typeof secret !== 'string' || secret.length < 1 || secret.length > 1024
    || !(salt instanceof Uint8Array) || salt.length !== 16
    || !Number.isInteger(parameters?.memorySize) || parameters.memorySize < 8192 || parameters.memorySize > 262144
    || !Number.isInteger(parameters?.iterations) || parameters.iterations < 1 || parameters.iterations > 10
    || !Number.isInteger(parameters?.parallelism) || parameters.parallelism < 1 || parameters.parallelism > 4
    || parameters?.hashLength !== 32
  ) {
    throw new Error('Unsafe Argon2id parameters.');
  }
  const rawKey = await argon2id({
    password: secret,
    salt,
    parallelism: parameters.parallelism,
    iterations: parameters.iterations,
    memorySize: parameters.memorySize,
    hashLength: parameters.hashLength,
    outputType: 'binary'
  });
  return window.crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function createArgon2idEnvelope(rawJwk, secret) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveArgon2idKey(secret, salt);
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, rawJwk);
  return {
    kdf: 'argon2id',
    parameters: ARGON2ID_PARAMETERS,
    salt: bufToHex(salt),
    iv: bufToHex(iv),
    ciphertext: bufToHex(ciphertext)
  };
}

// 4.5 Generate 24-character Recovery Code
export function generateRecoveryCode() {
  const chars = 'ABCDEFGHJKMNPQRSTVWXYZ2345678901';
  const array = new Uint8Array(24);
  window.crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < 24; i++) {
    if (i > 0 && i % 4 === 0) {
      result += '-';
    }
    const val = array[i] & 31;
    result += chars[val];
  }
  return result;
}

// 5. Encrypt Private Key (Cloud Backup)
export async function backupPrivateKey(privateKey, password, recoveryCode) {
  const privateKeyJwk = await exportPrivateKey(privateKey);
  const rawJwk = encoder.encode(privateKeyJwk);
  const cleanRecoveryCode = recoveryCode.replace(/-/g, '').toUpperCase();
  return JSON.stringify({
    version: 2,
    password_backup: await createArgon2idEnvelope(rawJwk, password),
    recovery_backup: await createArgon2idEnvelope(rawJwk, cleanRecoveryCode)
  });
}

// 6. Decrypt Private Key (Restore Backup)
export async function restorePrivateKey(backupJsonString, secret, isRecovery = false) {
  if (typeof backupJsonString !== 'string' || backupJsonString.length > 1048576 || typeof secret !== 'string') {
    throw new Error('Invalid recovery backup input.');
  }
  const backup = JSON.parse(backupJsonString);

  if (backup.version === 2) {
    const target = isRecovery ? backup.recovery_backup : backup.password_backup;
    if (!target || target.kdf !== 'argon2id' || !target.parameters) {
      throw new Error('Invalid Argon2id recovery backup.');
    }
    if (
      typeof target.salt !== 'string' || target.salt.length !== 32
      || typeof target.iv !== 'string' || target.iv.length !== 24
      || typeof target.ciphertext !== 'string' || target.ciphertext.length < 32 || target.ciphertext.length > 2097152
    ) {
      throw new Error('Invalid Argon2id recovery envelope.');
    }
    const cleanSecret = isRecovery ? secret.replace(/-/g, '').toUpperCase() : secret;
    const key = await deriveArgon2idKey(cleanSecret, hexToBuf(target.salt), target.parameters);
    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBuf(target.iv) },
      key,
      hexToBuf(target.ciphertext)
    );
    return importPrivateKey(decoder.decode(plaintext));
  }

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

export function requireE2EEKey(aesKey) {
  if (!aesKey) {
    const error = new Error('Ключ сквозного шифрования недоступен. Повторите попытку после синхронизации ключей.');
    error.code = 'E2EE_KEY_UNAVAILABLE';
    throw error;
  }
  return aesKey;
}

export async function encryptFileForE2EE(fileBlob, aesKey) {
  try {
    return await encryptFile(fileBlob, requireE2EEKey(aesKey));
  } catch (cause) {
    if (cause?.code === 'E2EE_KEY_UNAVAILABLE') throw cause;
    const error = new Error('Не удалось зашифровать вложение. Файл не был загружен.', { cause });
    error.code = 'E2EE_ENCRYPTION_FAILED';
    throw error;
  }
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

