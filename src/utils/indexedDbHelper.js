const DB_NAME = 'CoinGramOfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'offline-attachments';
const KEY_STORE_NAME = 'e2ee-keys';

let dbPromise = null;

export function initOfflineDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
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
      dbPromise = null;
      reject(event.target.error);
    };
  });

  return dbPromise;
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

export function savePrivateKey(userId, key) {
  return initOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(KEY_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(KEY_STORE_NAME);
      const request = store.put(key, userId);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  });
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
