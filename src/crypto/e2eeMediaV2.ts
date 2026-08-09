import { validateChatMedia } from '../utils/mediaValidation.ts';

export interface EncryptedMediaMetadataV2 {
  version: 2;
  contentKey: string;
  iv: string;
  mimeType: string;
  size: number;
  sha256: string;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

/** Encrypt every v2 attachment with an independent random content key. */
export async function encryptMediaV2(file: Blob): Promise<{ blob: Blob; metadata: EncryptedMediaMetadataV2 }> {
  const validatedMedia = validateChatMedia(file);
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', contentKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const [ciphertext, digest] = await Promise.all([
    crypto.subtle.encrypt({ name: 'AES-GCM', iv }, contentKey, plaintext),
    crypto.subtle.digest('SHA-256', plaintext)
  ]);
  const encodedContentKey = base64(rawKey);
  rawKey.fill(0);
  return {
    blob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    metadata: {
      version: 2,
      contentKey: encodedContentKey,
      iv: base64(iv),
      mimeType: validatedMedia.mimeType,
      size: file.size,
      sha256: base64(new Uint8Array(digest))
    }
  };
}

export async function decryptMediaV2(encrypted: Blob, metadata: EncryptedMediaMetadataV2): Promise<Blob> {
  if (metadata.version !== 2 || metadata.size < 0 || fromBase64(metadata.iv).length !== 12) {
    throw new Error('Invalid E2EE v2 media metadata.');
  }
  validateChatMedia({ size: metadata.size, type: metadata.mimeType });
  const key = await crypto.subtle.importKey('raw', fromBase64(metadata.contentKey), { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(metadata.iv) },
    key,
    await encrypted.arrayBuffer()
  );
  const digest = base64(new Uint8Array(await crypto.subtle.digest('SHA-256', plaintext)));
  if (digest !== metadata.sha256 || plaintext.byteLength !== metadata.size) throw new Error('E2EE v2 media integrity check failed.');
  return new Blob([plaintext], { type: metadata.mimeType });
}
