/**
 * Dynamic YouTube catalog for Pulse (Data API v3).
 *
 * Reality: there is no "entire YouTube" dump. We stream an effectively
 * unbounded feed via popular charts + search pages (nextPageToken).
 *
 * Requires VITE_YOUTUBE_API_KEY (restrict by HTTP referrer in Google Cloud).
 */

const YT_API = 'https://www.googleapis.com/youtube/v3';

/** Video categories used to fan out "mostPopular" (not exhaustive, high coverage). */
export const YT_CATEGORY_IDS = [
  '0', // all
  '1', // film
  '10', // music
  '15', // pets
  '17', // sports
  '19', // travel
  '20', // gaming
  '22', // people
  '23', // comedy
  '24', // entertainment
  '25', // news
  '26', // howto
  '27', // education
  '28' // science
];

const DEFAULT_TASTE_QUERIES = [
  'music',
  'comedy',
  'gaming',
  'nature 4k',
  'science',
  'travel vlog',
  'animation short',
  'podcast clips',
  'sports highlights',
  'tech review'
];

export function getYoutubeApiKey() {
  return (
    import.meta.env.VITE_YOUTUBE_API_KEY ||
    import.meta.env.VITE_GOOGLE_API_KEY ||
    ''
  ).trim();
}

export function isYoutubeCatalogEnabled() {
  return Boolean(getYoutubeApiKey());
}

/** Parse ISO-8601 duration PT#H#M#S → seconds */
export function parseYtDuration(iso) {
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (
    (Number(m[1]) || 0) * 3600 +
    (Number(m[2]) || 0) * 60 +
    (Number(m[3]) || 0)
  );
}

function tagsFromSnippet(snippet = {}, extra = []) {
  const tags = new Set(
    (extra || [])
      .concat(snippet.tags || [])
      .concat(snippet.categoryId ? [`cat-${snippet.categoryId}`] : [])
      .map((t) => String(t).toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, '').slice(0, 32))
      .filter((t) => t.length >= 2)
  );
  // Channel-ish keyword from title
  const title = String(snippet.title || '').toLowerCase();
  for (const word of ['music', 'game', 'comedy', 'news', 'travel', 'sport', 'tech', 'live', 'remix', 'cover', 'asmr']) {
    if (title.includes(word)) tags.add(word);
  }
  return [...tags].slice(0, 12);
}

async function ytGet(path, params = {}) {
  const key = getYoutubeApiKey();
  if (!key) throw new Error('VITE_YOUTUBE_API_KEY не задан');

  const url = new URL(`${YT_API}/${path}`);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText || 'YouTube API error';
    const err = new Error(msg);
    err.status = res.status;
    err.details = data?.error;
    throw err;
  }
  return data;
}

/**
 * Fetch video details and keep only public + embeddable.
 * @param {string[]} ids
 */
export async function fetchYtVideoDetails(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return [];

  const out = [];
  // API allows max 50 ids per call
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const data = await ytGet('videos', {
      part: 'snippet,contentDetails,status',
      id: chunk.join(',')
    });
    for (const v of data.items || []) {
      if (v.status?.privacyStatus && v.status.privacyStatus !== 'public') continue;
      if (v.status?.embeddable === false) continue;
      if (v.status?.uploadStatus && v.status.uploadStatus !== 'processed') continue;

      out.push({
        youtubeId: v.id,
        title: v.snippet?.title || v.id,
        tags: tagsFromSnippet(v.snippet),
        durationSec: parseYtDuration(v.contentDetails?.duration),
        channelTitle: v.snippet?.channelTitle || '',
        categoryId: v.snippet?.categoryId || null
      });
    }
  }
  return out;
}

/**
 * Most popular chart page.
 */
export async function fetchYtMostPopular({
  regionCode = 'US',
  videoCategoryId = '0',
  pageToken = '',
  maxResults = 25
} = {}) {
  const params = {
    part: 'snippet',
    chart: 'mostPopular',
    regionCode,
    maxResults: String(Math.min(50, maxResults))
  };
  if (videoCategoryId && videoCategoryId !== '0') {
    params.videoCategoryId = videoCategoryId;
  }
  if (pageToken) params.pageToken = pageToken;

  const data = await ytGet('videos', params);
  const ids = (data.items || []).map((it) => it.id).filter(Boolean);
  const details = await fetchYtVideoDetails(ids);
  return {
    videos: details,
    nextPageToken: data.nextPageToken || null
  };
}

/**
 * Search page (taste / explore).
 */
export async function fetchYtSearch({
  q,
  pageToken = '',
  maxResults = 25,
  regionCode = 'US',
  relevanceLanguage = 'ru'
} = {}) {
  const query = String(q || '').trim();
  if (!query) return { videos: [], nextPageToken: null };

  const params = {
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(Math.min(50, maxResults)),
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    regionCode,
    relevanceLanguage
  };
  if (pageToken) params.pageToken = pageToken;

  const data = await ytGet('search', params);
  const ids = (data.items || [])
    .map((it) => it.id?.videoId)
    .filter(Boolean);
  const details = await fetchYtVideoDetails(ids);
  return {
    videos: details,
    nextPageToken: data.nextPageToken || null
  };
}

/**
 * Build a diversified batch for Pulse:
 * - one popular page (rotating category)
 * - one search page from taste queries
 *
 * @param {{
 *   tasteQueries?: string[],
 *   excludeYoutubeIds?: Set<string>|string[],
 *   popularPageToken?: string|null,
 *   searchPageToken?: string|null,
 *   categoryIndex?: number,
 *   queryIndex?: number,
 *   regionCode?: string,
 * }} state
 */
export async function fetchYtPulseBatch(state = {}) {
  if (!isYoutubeCatalogEnabled()) {
    return {
      videos: [],
      state: { ...state, exhausted: true },
      error: 'no_api_key'
    };
  }

  const exclude = new Set(
    [...(state.excludeYoutubeIds || [])].map(String)
  );
  const tasteQueries =
    state.tasteQueries?.length > 0 ? state.tasteQueries : DEFAULT_TASTE_QUERIES;

  let categoryIndex = Number(state.categoryIndex) || 0;
  let queryIndex = Number(state.queryIndex) || 0;
  let popularPageToken = state.popularPageToken || '';
  let searchPageToken = state.searchPageToken || '';

  const categoryId = YT_CATEGORY_IDS[categoryIndex % YT_CATEGORY_IDS.length];
  const query = tasteQueries[queryIndex % tasteQueries.length];

  const results = [];
  let popularNext = popularPageToken;
  let searchNext = searchPageToken;

  try {
    const popular = await fetchYtMostPopular({
      videoCategoryId: categoryId === '0' ? undefined : categoryId,
      pageToken: popularPageToken || undefined,
      regionCode: state.regionCode || 'US',
      maxResults: 20
    });
    results.push(...popular.videos);
    popularNext = popular.nextPageToken;
    if (!popularNext) {
      // rotate category when a chart page ends
      categoryIndex = (categoryIndex + 1) % YT_CATEGORY_IDS.length;
      popularNext = '';
    }
  } catch (e) {
    console.warn('YT popular fetch failed', e);
  }

  try {
    const searched = await fetchYtSearch({
      q: query,
      pageToken: searchPageToken || undefined,
      regionCode: state.regionCode || 'US',
      maxResults: 20
    });
    results.push(...searched.videos);
    searchNext = searched.nextPageToken;
    if (!searchNext) {
      queryIndex = (queryIndex + 1) % tasteQueries.length;
      searchNext = '';
    }
  } catch (e) {
    console.warn('YT search fetch failed', e);
  }

  const videos = [];
  const seen = new Set(exclude);
  for (const v of results) {
    if (!v?.youtubeId || seen.has(v.youtubeId)) continue;
    seen.add(v.youtubeId);
    videos.push(v);
  }

  return {
    videos,
    state: {
      ...state,
      tasteQueries,
      categoryIndex,
      queryIndex,
      popularPageToken: popularNext || null,
      searchPageToken: searchNext || null,
      excludeYoutubeIds: [...seen],
      exhausted: videos.length === 0 && !popularNext && !searchNext
    }
  };
}

/**
 * Derive search queries from user tag affinity / recent likes.
 * @param {string[]} tags
 */
export function tasteQueriesFromTags(tags = []) {
  const cleaned = [...new Set(
    (tags || [])
      .map((t) => String(t).replace(/^cat-\d+$/, '').trim())
      .filter((t) => t && t.length >= 2 && !t.startsWith('cat-'))
  )];
  if (cleaned.length === 0) return DEFAULT_TASTE_QUERIES.slice();
  // Prefer strongest tags first, then defaults for exploration
  return [...cleaned.slice(0, 8), ...DEFAULT_TASTE_QUERIES.filter((q) => !cleaned.includes(q))].slice(0, 14);
}
