/**
 * YouTube OAuth (Google Identity Services) for Pulse recommendations.
 *
 * User authorizes youtube.readonly → we read:
 * - their channel
 * - subscriptions
 * - liked videos
 * and build a taste profile for ranking / catalog expand.
 *
 * Env:
 *   VITE_GOOGLE_OAUTH_CLIENT_ID  (OAuth 2.0 Web client)
 *   VITE_YOUTUBE_API_KEY         (Data API key, optional for public calls;
 *                                OAuth token is used for mine=true endpoints)
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { getYoutubeApiKey, parseYtDuration, tasteQueriesFromTags } from './youtubeCatalog';

const YT_API = 'https://www.googleapis.com/youtube/v3';
const YT_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export function getGoogleOAuthClientId() {
  return (
    import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
}

export function isYoutubeOAuthConfigured() {
  return Boolean(getGoogleOAuthClientId());
}

let gsiPromise = null;

export function loadGoogleIdentity() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('GSI load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.dataset.googleGsi = '1';
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('GSI load failed'));
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/**
 * Open Google consent and return access token payload.
 * @returns {Promise<{ access_token: string, expires_in?: number }>}
 */
export async function requestYoutubeAccessToken({ forceConsent = false } = {}) {
  const clientId = getGoogleOAuthClientId();
  if (!clientId) {
    throw new Error('Задай VITE_GOOGLE_OAUTH_CLIENT_ID в .env');
  }

  const google = await loadGoogleIdentity();

  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: YT_SCOPE,
        callback: (resp) => {
          if (resp?.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          if (!resp?.access_token) {
            reject(new Error('Нет access_token от Google'));
            return;
          }
          resolve(resp);
        },
        error_callback: (err) => {
          reject(new Error(err?.message || 'OAuth отменён'));
        }
      });
      client.requestAccessToken({
        prompt: forceConsent ? 'consent' : ''
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function ytAuthed(path, accessToken, params = {}) {
  const url = new URL(`${YT_API}/${path}`);
  // API key optional alongside OAuth
  const key = getYoutubeApiKey();
  if (key) url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `YouTube ${res.status}`);
  }
  return data;
}

function bump(map, key, w = 1) {
  if (!key) return;
  const k = String(key).toLowerCase().slice(0, 40);
  map[k] = (map[k] || 0) + w;
}

/**
 * Build taste profile from channel + subscriptions + likes.
 * @param {string} accessToken
 */
export async function buildYoutubeTaste(accessToken) {
  const tags = {};
  const channels = [];
  const likedVideoIds = [];
  const queries = [];

  // Own channel
  let channelId = null;
  let channelTitle = null;
  try {
    const me = await ytAuthed('channels', accessToken, {
      part: 'snippet',
      mine: 'true'
    });
    const ch = me.items?.[0];
    if (ch) {
      channelId = ch.id;
      channelTitle = ch.snippet?.title || null;
      if (channelTitle) queries.push(channelTitle);
    }
  } catch (e) {
    console.warn('channels.mine failed', e);
  }

  // Subscriptions
  try {
    let pageToken = '';
    for (let page = 0; page < 3; page += 1) {
      const sub = await ytAuthed('subscriptions', accessToken, {
        part: 'snippet',
        mine: 'true',
        maxResults: '50',
        pageToken: pageToken || undefined
      });
      for (const item of sub.items || []) {
        const title = item.snippet?.title;
        const cid = item.snippet?.resourceId?.channelId;
        if (cid) {
          channels.push({ id: cid, title: title || cid });
          if (title) {
            queries.push(title);
            // crude keywords from channel name
            for (const w of String(title).toLowerCase().split(/\s+/)) {
              if (w.length >= 3 && w.length <= 24) bump(tags, w, 1.2);
            }
          }
        }
      }
      pageToken = sub.nextPageToken || '';
      if (!pageToken) break;
    }
  } catch (e) {
    console.warn('subscriptions failed', e);
  }

  // Liked videos
  try {
    let pageToken = '';
    for (let page = 0; page < 2; page += 1) {
      const liked = await ytAuthed('videos', accessToken, {
        part: 'snippet,contentDetails',
        myRating: 'like',
        maxResults: '50',
        pageToken: pageToken || undefined
      });
      for (const v of liked.items || []) {
        likedVideoIds.push(v.id);
        const sn = v.snippet || {};
        for (const t of sn.tags || []) bump(tags, t, 2);
        const title = String(sn.title || '').toLowerCase();
        for (const word of [
          'music', 'game', 'gaming', 'comedy', 'vlog', 'news', 'sport',
          'tech', 'asmr', 'live', 'cover', 'remix', 'trailer', 'review',
          'tutorial', 'rap', 'rock', 'pop', 'anime', 'minecraft'
        ]) {
          if (title.includes(word)) bump(tags, word, 2.5);
        }
        if (sn.categoryId) bump(tags, `cat-${sn.categoryId}`, 1);
        if (sn.channelTitle) queries.push(sn.channelTitle);
      }
      pageToken = liked.nextPageToken || '';
      if (!pageToken) break;
    }
  } catch (e) {
    console.warn('liked videos failed', e);
  }

  // Top tags → search queries
  const topTags = Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter((t) => !t.startsWith('cat-'))
    .slice(0, 12);

  const uniqueQueries = [
    ...new Set(
      [...topTags, ...queries]
        .map((q) => String(q).trim())
        .filter((q) => q.length >= 2)
    )
  ].slice(0, 16);

  return {
    channelId,
    channelTitle,
    taste: {
      tags,
      channels,
      queries: uniqueQueries.length ? uniqueQueries : tasteQueriesFromTags(topTags),
      likedVideoIds: likedVideoIds.slice(0, 100),
      syncedAt: new Date().toISOString()
    }
  };
}

/**
 * Persist OAuth link + taste for current user.
 */
export async function saveYoutubeAccount(profileId, { accessToken, expiresIn, channelId, channelTitle, taste }) {
  if (!isSupabaseConfigured || !supabase || !profileId) {
    // local fallback
    const payload = {
      profile_id: profileId,
      channel_id: channelId,
      channel_title: channelTitle,
      access_token: accessToken,
      expires_at: expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
      taste: taste || {},
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('pulse-youtube-account', JSON.stringify(payload));
    return payload;
  }

  const row = {
    profile_id: profileId,
    channel_id: channelId || null,
    channel_title: channelTitle || null,
    access_token: accessToken || null,
    expires_at: expiresIn
      ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
      : null,
    taste: taste || {},
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('pulse_youtube_accounts')
    .upsert(row, { onConflict: 'profile_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function loadYoutubeAccount(profileId) {
  if (!profileId) return null;

  if (!isSupabaseConfigured || !supabase) {
    try {
      const raw = localStorage.getItem('pulse-youtube-account');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase
    .from('pulse_youtube_accounts')
    .select('profile_id, channel_id, channel_title, access_token, expires_at, taste, connected_at, updated_at')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function disconnectYoutubeAccount(profileId) {
  if (!profileId) return;

  if (!isSupabaseConfigured || !supabase) {
    localStorage.removeItem('pulse-youtube-account');
    return;
  }

  const { error } = await supabase
    .from('pulse_youtube_accounts')
    .delete()
    .eq('profile_id', profileId);
  if (error) throw error;
}

/**
 * Full connect flow: OAuth → taste → save.
 */
export async function connectYoutubeForPulse(profileId) {
  const tokenResp = await requestYoutubeAccessToken({ forceConsent: true });
  const built = await buildYoutubeTaste(tokenResp.access_token);
  const saved = await saveYoutubeAccount(profileId, {
    accessToken: tokenResp.access_token,
    expiresIn: tokenResp.expires_in,
    channelId: built.channelId,
    channelTitle: built.channelTitle,
    taste: built.taste
  });
  return saved;
}

/**
 * Re-sync taste if token still valid; otherwise re-auth.
 */
export async function refreshYoutubeTaste(profileId) {
  const acc = await loadYoutubeAccount(profileId);
  if (!acc) throw new Error('YouTube не подключён');

  let accessToken = acc.access_token;
  const exp = acc.expires_at ? new Date(acc.expires_at).getTime() : 0;
  if (!accessToken || (exp && exp < Date.now() + 60_000)) {
    const tokenResp = await requestYoutubeAccessToken({ forceConsent: false });
    accessToken = tokenResp.access_token;
    const built = await buildYoutubeTaste(accessToken);
    return saveYoutubeAccount(profileId, {
      accessToken,
      expiresIn: tokenResp.expires_in,
      channelId: built.channelId,
      channelTitle: built.channelTitle,
      taste: built.taste
    });
  }

  const built = await buildYoutubeTaste(accessToken);
  return saveYoutubeAccount(profileId, {
    accessToken,
    expiresIn: Math.max(60, Math.floor((exp - Date.now()) / 1000)),
    channelId: built.channelId,
    channelTitle: built.channelTitle,
    taste: built.taste
  });
}

/** Map stored taste → tag list for ranking / search */
export function youtubeTasteToTagList(taste) {
  if (!taste?.tags || typeof taste.tags !== 'object') return [];
  return Object.entries(taste.tags)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter((t) => !String(t).startsWith('cat-'))
    .slice(0, 20);
}

export function youtubeTasteToQueries(taste) {
  if (Array.isArray(taste?.queries) && taste.queries.length) {
    return taste.queries.slice(0, 16);
  }
  return tasteQueriesFromTags(youtubeTasteToTagList(taste));
}
