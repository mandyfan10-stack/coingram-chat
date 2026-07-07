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
      iterations: 100000,
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

// 5. Encrypt Private Key (Cloud Backup)
export async function backupPrivateKey(privateKey, password) {
  const privateKeyJwk = await exportPrivateKey(privateKey);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await derivePasswordKey(password, salt);
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    encoder.encode(privateKeyJwk)
  );

  return JSON.stringify({
    ciphertext: bufToHex(encryptedContent),
    salt: bufToHex(salt),
    iv: bufToHex(iv)
  });
}

// 6. Decrypt Private Key (Restore Backup)
export async function restorePrivateKey(backupJsonString, password) {
  const backup = JSON.parse(backupJsonString);
  const ciphertext = hexToBuf(backup.ciphertext);
  const salt = hexToBuf(backup.salt);
  const iv = hexToBuf(backup.iv);

  const aesKey = await derivePasswordKey(password, salt);
  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
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
    true, // extractable (so we can debug/log if necessary, or check it)
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
