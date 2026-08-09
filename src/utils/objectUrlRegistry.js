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
  if (current) URL.revokeObjectURL(current);
  objectUrls.delete(normalizedKey);
}

export function revokeAllManagedObjectUrls() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}
