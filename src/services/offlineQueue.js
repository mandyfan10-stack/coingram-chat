import {
  OFFLINE_QUEUE_STORAGE_KEY,
  loadOfflineQueue,
  saveOfflineQueue,
  isNetworkError,
  createOfflineQueueItem
} from './offlineQueueCore.js';

export {
  OFFLINE_QUEUE_STORAGE_KEY,
  loadOfflineQueue,
  saveOfflineQueue,
  isNetworkError,
  createOfflineQueueItem
};

/**
 * Upload offline media (if any), optionally E2EE-encrypt, and send the message.
 *
 * Optional injects on `deps` (for unit tests):
 * `sendMessage`, `getAttachment`, `deleteAttachment`, `storage`,
 * `importPublicKey`, `deriveSymmetricKey`, `encryptMessage`, `encryptFileForE2EE`, `requireE2EEKey`,
 * `extensionForMedia`
 *
 * @param {object} item - offline queue entry
 * @param {object} deps
 * @returns {Promise<{ data: object, finalMediaUrl: string|null }>}
 */
export async function processOfflineQueueItem(item, deps) {
  const {
    chat,
    currentUser,
    e2eePrivateKey,
    sharedKey: initialSharedKey,
    onSharedKey
  } = deps;

  let finalMediaUrl = item.media ?? null;
  const requiresE2EE = chat?.type === 'personal' && chat.name !== 'Избранное';
  const otherMember = requiresE2EE
    ? chat.members?.find((m) => m.id !== currentUser.id)
    : null;
  let sharedKey = requiresE2EE ? initialSharedKey : null;

  const e2ee = requiresE2EE
    ? {
        importPublicKey: deps.importPublicKey
          ?? (await import('../utils/e2eeHelper.js')).importPublicKey,
        deriveSymmetricKey: deps.deriveSymmetricKey
          ?? (await import('../utils/e2eeHelper.js')).deriveSymmetricKey,
        encryptMessage: deps.encryptMessage
          ?? (await import('../utils/e2eeHelper.js')).encryptMessage,
        encryptFileForE2EE: deps.encryptFileForE2EE
          ?? (await import('../utils/e2eeHelper.js')).encryptFileForE2EE,
        requireE2EEKey: deps.requireE2EEKey
          ?? (await import('../utils/e2eeHelper.js')).requireE2EEKey
      }
    : null;

  if (requiresE2EE && !sharedKey) {
    if (!e2eePrivateKey || !otherMember?.publicKey) {
      e2ee.requireE2EEKey(null);
    }
    const otherPublicKeyObj = await e2ee.importPublicKey(otherMember.publicKey);
    sharedKey = await e2ee.deriveSymmetricKey(e2eePrivateKey, otherPublicKeyObj);
    onSharedKey?.(sharedKey);
  }

  if (item.hasOfflineMedia) {
    const getAttachment = deps.getAttachment
      ?? (await import('../utils/indexedDbHelper.js')).getOfflineAttachment;

    const blob = await getAttachment(item.optimisticId);
    if (!blob) throw new Error('Файл вложения не найден в локальном хранилище.');

    const deleteAttachment = deps.deleteAttachment
      ?? (await import('../utils/indexedDbHelper.js')).deleteOfflineAttachment;
    const extensionForMedia = deps.extensionForMedia
      ?? (await import('../utils/mediaValidation.ts')).extensionForMedia;
    const storage = deps.storage
      ?? (await import('../supabaseClient.js')).supabase.storage;

    const fileExt = extensionForMedia(blob.type, item.mediaType);
    const fileName = `msg_${item.optimisticId}.${fileExt}`;
    const filePath = `${item.chatId}/${item.senderId}/${fileName}`;
    const blobToUpload = requiresE2EE
      ? await e2ee.encryptFileForE2EE(blob, sharedKey)
      : blob;

    const { error: uploadError } = await storage
      .from('chat-attachments')
      .upload(filePath, blobToUpload, {
        contentType: requiresE2EE ? 'application/octet-stream' : blob.type
      });

    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = storage.from('chat-attachments').getPublicUrl(filePath);
    finalMediaUrl = publicUrl;
    await deleteAttachment(item.optimisticId);
  }

  let textToSend = item.text;
  let mediaToSend = finalMediaUrl;

  if (requiresE2EE) {
    e2ee.requireE2EEKey(sharedKey);
    if (item.text) {
      const encryptedText = await e2ee.encryptMessage(item.text, sharedKey);
      textToSend = `e2ee:aes-gcm:${encryptedText.ciphertext}:${encryptedText.iv}`;
    }
    if (finalMediaUrl) {
      const encryptedMedia = await e2ee.encryptMessage(finalMediaUrl, sharedKey);
      mediaToSend = `e2ee:aes-gcm:${encryptedMedia.ciphertext}:${encryptedMedia.iv}`;
    }
  }

  const sendMessage = deps.sendMessage
    ?? (await import('./dataLayer.js')).dataService.sendMessage.bind(
      (await import('./dataLayer.js')).dataService
    );

  const data = await sendMessage(
    item.chatId,
    item.senderId,
    textToSend,
    item.replyToId,
    mediaToSend,
    item.optimisticId
  );

  return { data, finalMediaUrl };
}
