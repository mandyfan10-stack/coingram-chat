import { TRENDING_GIFS } from '../components/chat/emojiData';

const TENOR_API_KEY = String(import.meta.env?.VITE_TENOR_API_KEY || '').trim();
const TENOR_CLIENT_KEY = 'coiny_web';
const BASE_URL = 'https://tenor.googleapis.com/v2';

export const TENOR_CATEGORIES = [
  { id: 'trending', label: '🔥 Тренды', query: '' },
  { id: 'reactions', label: '😂 Реакции', query: 'reactions' },
  { id: 'memes', label: '🐸 Мемы', query: 'memes' },
  { id: 'cats', label: '🐱 Котики', query: 'cats' },
  { id: 'anime', label: '✨ Аниме', query: 'anime' },
  { id: 'love', label: '❤️ Любовь', query: 'love' },
  { id: 'dance', label: '💃 Танцы', query: 'dance' },
  { id: 'sad', label: '🥺 Грусть', query: 'sad' }
];

function normalizeTenorItem(item) {
  const formats = item.media_formats || {};
  const gifUrl = formats.gif?.url || formats.mediumgif?.url || formats.tinygif?.url || item.url;
  const previewUrl = formats.tinygif?.url || formats.nanogif?.url || gifUrl;
  const dims = formats.tinygif?.dims || formats.gif?.dims || [180, 120];

  return {
    id: item.id || `gif-${Math.random()}`,
    title: item.content_description || item.title || 'GIF',
    url: gifUrl,
    preview: previewUrl,
    width: dims[0],
    height: dims[1]
  };
}

function fallbackGifs(query = '') {
  const clean = String(query || '').trim().toLowerCase();
  const results = clean
    ? TRENDING_GIFS.filter(
      (gif) => gif.title.toLowerCase().includes(clean) || (gif.tags && gif.tags.some((tag) => tag.includes(clean)))
    )
    : TRENDING_GIFS;
  return { results, nextPos: null };
}

async function fetchTenor(path, params) {
  if (!TENOR_API_KEY) return null;

  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set('key', TENOR_API_KEY);
  url.searchParams.set('client_key', TENOR_CLIENT_KEY);
  url.searchParams.set('media_filter', 'gif,tinygif,nanogif');
  url.searchParams.set('contentfilter', 'medium');
  for (const [name, value] of Object.entries(params)) {
    if (value != null && value !== '') url.searchParams.set(name, String(value));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Tenor API responded with status ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch featured/trending GIFs from Tenor
 */
export async function fetchTrendingTenorGifs(pos = null, limit = 20) {
  try {
    const data = await fetchTenor('featured', { limit, pos });
    if (!data) return fallbackGifs();
    const results = (data.results || []).map(normalizeTenorItem);
    return {
      results: results.length > 0 ? results : TRENDING_GIFS,
      nextPos: data.next || null
    };
  } catch (err) {
    console.warn('Tenor API offline/failed, using fallback curated GIFs:', err);
    return fallbackGifs();
  }
}

/**
 * Search GIFs using Tenor API
 */
export async function searchTenorGifs(query, pos = null, limit = 20) {
  if (!query || !query.trim()) {
    return fetchTrendingTenorGifs(pos, limit);
  }

  try {
    const data = await fetchTenor('search', { q: query.trim(), limit, pos });
    if (!data) return fallbackGifs(query);
    return {
      results: (data.results || []).map(normalizeTenorItem),
      nextPos: data.next || null
    };
  } catch (err) {
    console.warn('Tenor Search API error, searching local fallback GIFs:', err);
    return fallbackGifs(query);
  }
}
