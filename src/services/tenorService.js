import { TRENDING_GIFS } from '../components/chat/emojiData';

const TENOR_API_KEY = 'AIzaSyCZt6SSh5VgVPzD9fhyzG1DprdPRhtoaR4';
const TENOR_CLIENT_KEY = 'tenor_web';
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

/**
 * Fetch featured/trending GIFs from Tenor
 */
export async function fetchTrendingTenorGifs(pos = null, limit = 20) {
  try {
    const url = new URL(`${BASE_URL}/featured`);
    url.searchParams.set('key', TENOR_API_KEY);
    url.searchParams.set('client_key', TENOR_CLIENT_KEY);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('media_filter', 'gif,tinygif,nanogif');
    url.searchParams.set('contentfilter', 'medium');
    if (pos) {
      url.searchParams.set('pos', pos);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Tenor API responded with status ${response.status}`);
    }

    const data = await response.json();
    const results = (data.results || []).map(normalizeTenorItem);

    return {
      results: results.length > 0 ? results : TRENDING_GIFS,
      nextPos: data.next || null
    };
  } catch (err) {
    console.warn('Tenor API offline/failed, using fallback curated GIFs:', err);
    return {
      results: TRENDING_GIFS,
      nextPos: null
    };
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
    const url = new URL(`${BASE_URL}/search`);
    url.searchParams.set('q', query.trim());
    url.searchParams.set('key', TENOR_API_KEY);
    url.searchParams.set('client_key', TENOR_CLIENT_KEY);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('media_filter', 'gif,tinygif,nanogif');
    url.searchParams.set('contentfilter', 'medium');
    if (pos) {
      url.searchParams.set('pos', pos);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Tenor Search API responded with status ${response.status}`);
    }

    const data = await response.json();
    const results = (data.results || []).map(normalizeTenorItem);

    return {
      results,
      nextPos: data.next || null
    };
  } catch (err) {
    console.warn('Tenor Search API error, searching local fallback GIFs:', err);
    const clean = query.trim().toLowerCase();
    const fallbackResults = TRENDING_GIFS.filter(
      (g) => g.title.toLowerCase().includes(clean) || (g.tags && g.tags.some((t) => t.includes(clean)))
    );
    return {
      results: fallbackResults,
      nextPos: null
    };
  }
}
