const objectUrls = new Map();

export function createManagedObjectUrl(key, blob) {
  revokeManagedObjectUrl(key);
  const url = URL.createObjectURL(blob);
  objectUrls.set(String(key), url);
  return url;
}

export function revokeManagedObjectUrl(key) {
  const normalizedKey = String(key);
  const current = objectUrls.get(normalizedKey);
  if (current) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(current);
      } catch {
        /* ignore */
      }
    }, 3000);
  }
  objectUrls.delete(normalizedKey);
}

export function revokeAllManagedObjectUrls() {
  for (const url of objectUrls.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  objectUrls.clear();
}

