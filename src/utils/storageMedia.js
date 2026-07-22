export function getPrivateAttachmentPath(url) {
  if (typeof url !== 'string') return null;

  const marker = 'chat-attachments/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  return decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0]);
}

export function getAttachmentMimeType(mediaUrl, fallbackMimeType) {
  const extension = mediaUrl?.split('?')[0].split('.').pop()?.toLowerCase();
  const mimeTypes = {
    avif: 'image/avif', gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg',
    mp3: 'audio/mpeg', mp4: fallbackMimeType?.startsWith('audio/') ? 'audio/mp4' : 'video/mp4',
    ogg: fallbackMimeType?.startsWith('video/') ? 'video/ogg' : 'audio/ogg',
    png: 'image/png', wav: 'audio/wav', webm: fallbackMimeType || 'video/webm', webp: 'image/webp'
  };
  return mimeTypes[extension] || fallbackMimeType || 'application/octet-stream';
}
