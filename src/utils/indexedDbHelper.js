const DB_NAME = 'CoinyOfflineDB';
/**
 * Must never decrease. Some clients already have v3 (local/experimental builds).
 * Opening with a lower version throws VersionError and breaks E2EE restore + offline media.
 */
const DB_VERSION = 3;
const STORE_NAME = 'offline-attachments';
const KEY_STORE_NAME = 'e2ee-keys';

let dbPromise = null;

function ensureStores(db) {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME);
  }
  if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
    db.createObjectStore(KEY_STORE_NAME);
  }
}

/**
 * @param {number | undefined} version
 *   Pass a number to open/upgrade; omit to open the existing DB at its current version
 *   (recovery path when the client DB is newer than this build expected).
 */
function openDatabase(version) {
  return new Promise((resolve, reject) => {
    const request =
      typeof version === 'number' ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);

    request.onupgradeneeded = (event) => {
      ensureStores(event.target.result);
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      // Defensive: older DBs may lack a store without a version bump path.
      try {
        ensureStores(db);
      } catch {
        // createObjectStore only allowed in versionchange; ignore if already open.
      }
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error('IndexedDB open failed'));
    };

    request.onblocked = () => {
      console.warn('IndexedDB open blocked; close other Coiny tabs to upgrade the database.');
    };
  });
}

export function initOfflineDB() {
  if (dbPromise) return dbPromise;

  dbPromise = openDatabase(DB_VERSION).catch((error) => {
    // VersionError: requested version < existing (e.g. code at v2, browser already at v3).
    if (error && error.name === 'VersionError') {
      console.warn(
        `IndexedDB VersionError (requested ${DB_VERSION}); reopening at existing schema version.`,
        error
      );
      return openDatabase(undefined);
    }
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

/** Test/ops helper — current app schema version constant. */
export function getOfflineDbSchemaVersion() {
  return DB_VERSION;
}

export function saveOfflineAttachment(optimisticId, blob) {
  return initOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, optimisticId);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

export function getOfflineAttachment(optimisticId) {
  return initOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(optimisticId);

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

export function deleteOfflineAttachment(optimisticId) {
  return initOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(optimisticId);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

export function savePrivateKey(userId, key, publicKey = null) {
  return initOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(KEY_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(KEY_STORE_NAME);
      const request = store.put({
        key,
        publicKey,
        storedAt: new Date().toISOString()
      }, userId);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

export function isPrivateKeyRecordCurrent(record, publicKey) {
  return !!(
    record?.key &&
    typeof record.publicKey === 'string' &&
    record.publicKey === publicKey
  );
}

export function getPrivateKey(userId) {
  return initOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(KEY_STORE_NAME, 'readonly');
      const store = transaction.objectStore(KEY_STORE_NAME);
      const request = store.get(userId);

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

export function deletePrivateKey(userId) {
  return initOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(KEY_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(KEY_STORE_NAME);
      const request = store.delete(userId);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  });
}
