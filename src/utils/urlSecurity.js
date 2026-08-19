const STORAGE_SCHEME = 'storage:';

export function normalizeExternalHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeStoragePath(value) {
  if (typeof value !== 'string' || !value) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  if (decoded.includes('\\') || decoded.includes('\0') || decoded.includes('%')) return null;
  const segments = decoded.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return segments.join('/');
}

export function createStorageReference(bucket, objectPath) {
  const safeBucket = /^[a-z0-9-]+$/.test(String(bucket || '')) ? bucket : null;
  const safePath = normalizeStoragePath(objectPath);
  return safeBucket && safePath ? `storage://${safeBucket}/${safePath}` : null;
}

export function getStorageObjectPath(value, bucket, allowedProjectUrl = '') {
  if (typeof value !== 'string' || !/^[a-z0-9-]+$/.test(String(bucket || ''))) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol === STORAGE_SCHEME) {
      if (parsed.host !== bucket || parsed.search || parsed.hash) return null;
      return normalizeStoragePath(parsed.pathname.replace(/^\/+/, ''));
    }

    if (parsed.protocol !== 'https:') return null;
    const configuredOrigin = allowedProjectUrl ? new URL(allowedProjectUrl).origin : null;
    const trustedOrigin = Boolean(
      (configuredOrigin && parsed.origin === configuredOrigin) ||
      (configuredOrigin && parsed.hostname.endsWith('.supabase.co'))
    );
    if (!trustedOrigin) return null;

    const marker = '/storage/v1/object/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const objectRoute = parsed.pathname.slice(markerIndex + marker.length).split('/');
    if (!['public', 'sign', 'authenticated'].includes(objectRoute[0])) return null;
    if (objectRoute[1] !== bucket) return null;
    return normalizeStoragePath(objectRoute.slice(2).join('/'));
  } catch {
    return null;
  }
}

export function getStorageReference(value, allowedBuckets, allowedProjectUrl = '') {
  const buckets = Array.isArray(allowedBuckets) ? allowedBuckets : [];
  for (const bucket of buckets) {
    const path = getStorageObjectPath(value, bucket, allowedProjectUrl);
    if (path) return { bucket, path };
  }
  return null;
}
