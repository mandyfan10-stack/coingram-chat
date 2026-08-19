import { supabase } from '../supabaseClient.js';

const IMAGE_MIME_TYPES = new Set(['image/avif', 'image/jpeg', 'image/png', 'image/webp']);
const LIMITS = {
  avatar: 5 * 1024 * 1024,
  story: 10 * 1024 * 1024,
  wallpaper: 10 * 1024 * 1024,
  banner: 10 * 1024 * 1024,
  'group-avatar': 5 * 1024 * 1024,
};

export async function uploadSanitizedPublicImage(file, kind, { chatId } = {}) {
  if (!(file instanceof Blob) || !IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error('Поддерживаются только JPEG, PNG, WebP и AVIF изображения.');
  }
  if (!LIMITS[kind] || file.size < 1 || file.size > LIMITS[kind]) {
    throw new Error('Размер изображения превышает допустимый лимит.');
  }
  if (!supabase) throw new Error('Supabase не настроен.');

  const body = new FormData();
  body.append('file', file);
  body.append('kind', kind);
  if (chatId) body.append('chatId', chatId);

  const { data, error } = await supabase.functions.invoke('sanitize-public-image', { body });
  if (error) {
    let detail = error.message || 'Edge Function returned a non-2xx status code';
    try {
      const response = error.context;
      if (response && typeof response.json === 'function') {
        const payload = await response.json();
        if (payload?.error) detail = String(payload.error);
      }
    } catch {
      /* keep the gateway message */
    }
    throw new Error(detail);
  }
  if (!data?.reference || !data?.path) throw new Error('Сервер вернул некорректный путь изображения.');
  return data;
}
