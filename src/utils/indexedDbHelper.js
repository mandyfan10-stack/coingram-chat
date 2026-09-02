import {
  decryptOfflineAttachment,
  decryptOfflineQueuePayload,
  encryptOfflineAttachment,
  encryptOfflineQueuePayload,
  generateOfflineQueueKey
} from './offlineQueueCrypto.js';

const DB_NAME = 'CoinyOfflineDB';
const DB_VERSION = 7;
const ATTACHMENT_STORE_NAME = 'offline-attachments';
const E2EE_KEY_STORE_NAME = 'e2ee-keys';
const OFFLINE_QUEUE_STORE_NAME = 'offline-queue';
const LOCAL_KEY_STORE_NAME = 'local-crypto-keys';
const MLS_STATE_STORE_NAME = 'mls-state';
const CRYPTO_OUTBOX_STORE_NAME = 'crypto-outbox';
const CRYPTO_INBOX_STORE_NAME = 'crypto-inbox';
const MESSAGES_CACHE_STORE_NAME = 'messages-cache';
const OFFLINE_QUEUE_KEY_ID = 'offline-queue-aes-gcm-v1';
const LEGACY_QUEUE_STORAGE_KEY = 'tg-offline-queue';

let dbPromise = null;
const localKeyPromises = new Map();

function ensureStores(db) {
  for (const storeName of [
    ATTACHMENT_STORE_NAME,
    E2EE_KEY_STORE_NAME,
    OFFLINE_QUEUE_STORE_NAME,
    LOCAL_KEY_STORE_NAME,
    MLS_STATE_STORE_NAME,
    CRYPTO_OUTBOX_STORE_NAME,
    CRYPTO_INBOX_STORE_NAME,
    MESSAGES_CACHE_STORE_NAME
  ]) {
    if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
  }
}

function openDatabase(version) {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }
  return new Promise((resolve, reject) => {
    const request = typeof version === 'number'
      ? indexedDB.open(DB_NAME, version)
      : indexedDB.open(DB_NAME);

    request.onupgradeneeded = (event) => ensureStores(event.target.result);
    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        localKeyPromises.clear();
      };
      db.onclose = () => {
        dbPromise = null;
        localKeyPromises.clear();
      };
      resolve(db);
    };
    request.onerror = (event) => reject(event.target.error || new Error('IndexedDB open failed'));
    request.onblocked = () => {
      console.warn('IndexedDB upgrade is blocked; close other Coiny tabs and retry.');
    };
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error || new Error('IndexedDB request failed'));
  });
}

async function getStoreValue(storeName, key) {
  const db = await initOfflineDB();
  return requestResult(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
}

async function putStoreValue(storeName, key, value) {
  const db = await initOfflineDB();
  const transaction = db.transaction(storeName, 'readwrite');
  const result = await requestResult(transaction.objectStore(storeName).put(value, key));
  await transactionComplete(transaction);
  return result;
}

async function deleteStoreValue(storeName, key) {
  const db = await initOfflineDB();
  const transaction = db.transaction(storeName, 'readwrite');
  const result = await requestResult(transaction.objectStore(storeName).delete(key));
  await transactionComplete(transaction);
  return result;
}

async function getLocalCryptoKey() {
  if (!localKeyPromises.has(OFFLINE_QUEUE_KEY_ID)) {
    localKeyPromises.set(OFFLINE_QUEUE_KEY_ID, (async () => {
      const existing = await getStoreValue(LOCAL_KEY_STORE_NAME, OFFLINE_QUEUE_KEY_ID);
      if (typeof CryptoKey !== 'undefined' && existing instanceof CryptoKey) return existing;
      const generated = await generateOfflineQueueKey();
      await putStoreValue(LOCAL_KEY_STORE_NAME, OFFLINE_QUEUE_KEY_ID, generated);
      return generated;
    })().catch((error) => {
      localKeyPromises.delete(OFFLINE_QUEUE_KEY_ID);
      throw error;
    }));
  }
  return localKeyPromises.get(OFFLINE_QUEUE_KEY_ID);
}

function userContext(userId) {
  return String(userId || 'anonymous');
}

export function initOfflineDB() {
  if (dbPromise) return dbPromise;
  dbPromise = openDatabase(DB_VERSION).catch((error) => {
    if (error?.name === 'VersionError') return openDatabase(undefined);
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

export function getOfflineDbSchemaVersion() {
  return DB_VERSION;
}

export async function saveEncryptedOfflineQueue(userId, queue) {
  const context = `queue:${userContext(userId)}`;
  const key = await getLocalCryptoKey();
  const record = await encryptOfflineQueuePayload(Array.isArray(queue) ? queue : [], key, context);
  await putStoreValue(OFFLINE_QUEUE_STORE_NAME, context, record);
}

export async function loadEncryptedOfflineQueue(userId) {
  const context = `queue:${userContext(userId)}`;
  const record = await getStoreValue(OFFLINE_QUEUE_STORE_NAME, context);
  if (record) {
    try {
      const queue = await decryptOfflineQueuePayload(record, await getLocalCryptoKey(), context);
      return Array.isArray(queue) ? queue : [];
    } catch (error) {
      console.error('Encrypted offline queue cannot be decrypted:', error);
      return [];
    }
  }

  // One-time migration from versions that persisted queue plaintext.
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_QUEUE_STORAGE_KEY) || '[]');
    localStorage.removeItem(LEGACY_QUEUE_STORAGE_KEY);
    if (Array.isArray(legacy) && legacy.length) {
      await saveEncryptedOfflineQueue(userId, legacy);
      return legacy;
    }
  } catch {
    localStorage.removeItem(LEGACY_QUEUE_STORAGE_KEY);
  }
  return [];
}

export async function saveOfflineAttachment(optimisticId, blob, userId = 'anonymous') {
  const context = `attachment:${userContext(userId)}:${optimisticId}`;
  const encryptedBlob = await encryptOfflineAttachment(blob, await getLocalCryptoKey(), context);
  await putStoreValue(ATTACHMENT_STORE_NAME, optimisticId, {
    version: 1,
    blob: encryptedBlob,
    mimeType: blob.type || 'application/octet-stream',
    size: blob.size,
    userId: userContext(userId)
  });
}

export async function getOfflineAttachment(optimisticId, userId = 'anonymous') {
  const record = await getStoreValue(ATTACHMENT_STORE_NAME, optimisticId);
  if (!record) return null;
  if (record instanceof Blob) return record; // Legacy plaintext record; rewritten on next enqueue.
  if (record.version !== 1 || !(record.blob instanceof Blob)) return null;
  if (record.userId !== userContext(userId)) return null;
  const context = `attachment:${record.userId}:${optimisticId}`;
  return decryptOfflineAttachment(
    record.blob,
    await getLocalCryptoKey(),
    record.mimeType,
    context
  );
}

export function deleteOfflineAttachment(optimisticId) {
  return deleteStoreValue(ATTACHMENT_STORE_NAME, optimisticId);
}

export function savePrivateKey(userId, key, publicKey = null) {
  return putStoreValue(E2EE_KEY_STORE_NAME, userId, {
    key,
    publicKey,
    storedAt: new Date().toISOString()
  });
}

export function isPrivateKeyRecordCurrent(record, publicKey) {
  return Boolean(record?.key && typeof record.publicKey === 'string' && record.publicKey === publicKey);
}

export function getPrivateKey(userId) {
  return getStoreValue(E2EE_KEY_STORE_NAME, userId);
}

export function deletePrivateKey(userId) {
  return deleteStoreValue(E2EE_KEY_STORE_NAME, userId);
}

export function saveCurrentE2EEDeviceId(userId, deviceId) {
  return putStoreValue(LOCAL_KEY_STORE_NAME, `e2ee-device:${userContext(userId)}`, String(deviceId));
}

export function getCurrentE2EEDeviceId(userId) {
  return getStoreValue(LOCAL_KEY_STORE_NAME, `e2ee-device:${userContext(userId)}`);
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

/** Atomically persist an MLS state transition and its encrypted upload record. */
export async function commitConversationCryptoTransition(userId, chatId, serializedState, outboxRecord) {
  const owner = userContext(userId);
  const stateContext = `mls-state:${owner}:${chatId}`;
  const outboxContext = `mls-outbox:${owner}:${outboxRecord.id}`;
  const key = await getLocalCryptoKey();
  const [encryptedState, encryptedOutbox] = await Promise.all([
    encryptOfflineQueuePayload(serializedState, key, stateContext),
    encryptOfflineQueuePayload(outboxRecord, key, outboxContext)
  ]);
  const db = await initOfflineDB();
  const transaction = db.transaction([MLS_STATE_STORE_NAME, CRYPTO_OUTBOX_STORE_NAME], 'readwrite');
  transaction.objectStore(MLS_STATE_STORE_NAME).put(encryptedState, stateContext);
  transaction.objectStore(CRYPTO_OUTBOX_STORE_NAME).put({
    context: outboxContext,
    payload: encryptedOutbox,
    createdAt: new Date().toISOString()
  }, outboxRecord.id);
  await transactionComplete(transaction);
}

/** Atomically persist a receive-state transition and its replay-protected inbox receipt. */
export async function commitConversationDecryptTransition(userId, chatId, serializedState, inboxRecord) {
  const owner = userContext(userId);
  const stateContext = `mls-state:${owner}:${chatId}`;
  const inboxContext = `mls-inbox:${owner}:${inboxRecord.id}`;
  const key = await getLocalCryptoKey();
  const [encryptedState, encryptedInbox] = await Promise.all([
    encryptOfflineQueuePayload(serializedState, key, stateContext),
    encryptOfflineQueuePayload(inboxRecord, key, inboxContext)
  ]);
  const db = await initOfflineDB();
  const transaction = db.transaction([MLS_STATE_STORE_NAME, CRYPTO_INBOX_STORE_NAME], 'readwrite');
  transaction.objectStore(MLS_STATE_STORE_NAME).put(encryptedState, stateContext);
  transaction.objectStore(CRYPTO_INBOX_STORE_NAME).put({
    context: inboxContext,
    payload: encryptedInbox,
    receivedAt: new Date().toISOString()
  }, inboxRecord.id);
  await transactionComplete(transaction);
}

export async function loadConversationCryptoState(userId, chatId) {
  const context = `mls-state:${userContext(userId)}:${chatId}`;
  const record = await getStoreValue(MLS_STATE_STORE_NAME, context);
  if (!record) return null;
  return decryptOfflineQueuePayload(record, await getLocalCryptoKey(), context);
}

export async function clearOfflineDatabase() {
  const db = await initOfflineDB().catch(() => null);
  db?.close();
  dbPromise = null;
  localKeyPromises.clear();
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error || new Error('IndexedDB delete failed'));
    request.onblocked = () => reject(new Error('IndexedDB delete is blocked by another Coiny tab.'));
  });
}

/**
 * Persists up to 100 recent messages for a chat to IndexedDB for instantaneous reopening.
 * @param {string} chatId
 * @param {Array<object>} messages
 * @param {string} [userId]
 */
export async function saveCachedMessages(chatId, messages, userId) {
  if (!chatId || !Array.isArray(messages) || messages.length === 0) return;
  if (typeof indexedDB === 'undefined') return;
  const context = `chat-messages:${userContext(userId)}:${chatId}`;
  try {
    const trimmed = messages.slice(-100).map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
    }));
    await putStoreValue(MESSAGES_CACHE_STORE_NAME, context, trimmed);
  } catch (err) {
    console.warn('Failed to cache messages in IndexedDB:', err);
  }
}

/**
 * Retrieves cached messages for a chat from IndexedDB.
 * @param {string} chatId
 * @param {string} [userId]
 * @returns {Promise<Array<object>|null>}
 */
export async function getCachedMessages(chatId, userId) {
  if (!chatId || typeof indexedDB === 'undefined') return null;
  const context = `chat-messages:${userContext(userId)}:${chatId}`;
  try {
    const raw = await getStoreValue(MESSAGES_CACHE_STORE_NAME, context);
    if (!Array.isArray(raw)) return null;
    return raw.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));
  } catch (err) {
    console.warn('Failed to read cached messages from IndexedDB:', err);
    return null;
  }
}

/**
 * Removes cached messages for a chat from IndexedDB.
 * @param {string} chatId
 * @param {string} [userId]
 */
export async function clearCachedMessages(chatId, userId) {
  if (!chatId || typeof indexedDB === 'undefined') return;
  const context = `chat-messages:${userContext(userId)}:${chatId}`;
  try {
    await deleteStoreValue(MESSAGES_CACHE_STORE_NAME, context);
  } catch (err) {
    console.warn('Failed to clear cached messages from IndexedDB:', err);
  }
}
