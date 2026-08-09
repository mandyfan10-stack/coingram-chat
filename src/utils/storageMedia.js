import { supabaseProjectUrl } from '../supabaseClient.js';
import { getStorageObjectPath, getStorageReference } from './urlSecurity.js';

const PRIVATE_MEDIA_BUCKETS = ['chat-attachments', 'avatars', 'stories', 'wallpapers', 'group-avatars'];

export function getPrivateAttachmentPath(url) {
  return getStorageObjectPath(url, 'chat-attachments', supabaseProjectUrl);
}

export function getPrivateMediaReference(url) {
  return getStorageReference(url, PRIVATE_MEDIA_BUCKETS, supabaseProjectUrl);
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
