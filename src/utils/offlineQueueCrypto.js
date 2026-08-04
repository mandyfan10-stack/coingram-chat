const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getCryptoApi() {
  const cryptoApi = globalThis.crypto || globalThis.window?.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto is unavailable; offline messages cannot be stored safely.');
  }
  return cryptoApi;
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length % 2 !== 0 || /[^0-9a-f]/i.test(value)) {
    throw new Error('Invalid encrypted offline queue payload.');
  }
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    output[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return output;
}

function additionalData(context) {
  return context ? encoder.encode(String(context)) : undefined;
}

/** Create a non-exportable AES key that stays inside IndexedDB. */
export async function generateOfflineQueueKey() {
  return getCryptoApi().subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt queue metadata before it is persisted to localStorage. */
export async function encryptOfflineQueuePayload(payload, key, context) {
  const cryptoApi = getCryptoApi();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(context) },
    key,
    plaintext
  );
  return { version: 1, iv: toHex(iv), ciphertext: toHex(ciphertext) };
}

/** Decrypt a locally persisted queue record. */
export async function decryptOfflineQueuePayload(record, key, context) {
  if (!record || record.version !== 1) {
    throw new Error('Unsupported encrypted offline queue payload.');
  }
  const plaintext = await getCryptoApi().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromHex(record.iv),
      additionalData: additionalData(context)
    },
    key,
    fromHex(record.ciphertext)
  );
  return JSON.parse(decoder.decode(plaintext));
}

/** Encrypt an offline media blob before storing it in IndexedDB. */
export async function encryptOfflineAttachment(blob, key, context) {
  const cryptoApi = getCryptoApi();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(context) },
    key,
    await blob.arrayBuffer()
  );
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);
  return new Blob([result], { type: 'application/octet-stream' });
}

/** Restore a locally encrypted offline media blob. */
export async function decryptOfflineAttachment(encryptedBlob, key, mimeType, context) {
  const source = await encryptedBlob.arrayBuffer();
  if (source.byteLength <= 12) throw new Error('Invalid encrypted offline attachment.');

  const iv = new Uint8Array(source, 0, 12);
  const ciphertext = new Uint8Array(source, 12);
  const plaintext = await getCryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(context) },
    key,
    ciphertext
  );
  return new Blob([plaintext], { type: mimeType || 'application/octet-stream' });
}
