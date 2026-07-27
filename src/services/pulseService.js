import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { classifyWatch } from '../utils/pulseRank';
import {
  fetchYtPulseBatch,
  isYoutubeCatalogEnabled,
  tasteQueriesFromTags
} from './youtubeCatalog';

/** Fallback catalog when offline / mock (embed-friendly public videos). */
export const PULSE_FALLBACK_CATALOG = [
  { id: 'local-1', youtubeId: 'aqz-KE-bpKQ', title: 'Big Buck Bunny', tags: ['film', 'classic', 'fun'], durationSec: 596 },
  { id: 'local-2', youtubeId: 'eRsGyueVLvQ', title: 'Sintel', tags: ['film', 'classic'], durationSec: 888 },
  { id: 'local-3', youtubeId: 'wh3rqhy5Hxs', title: 'Tears of Steel', tags: ['film', 'scifi'], durationSec: 734 },
  { id: 'local-4', youtubeId: 'LXb3EKWsInQ', title: 'Costa Rica in 4K', tags: ['nature', 'travel'], durationSec: 312 },
  { id: 'local-5', youtubeId: 'jNQXAC9IVRw', title: 'Me at the zoo', tags: ['classic', 'short', 'funny'], durationSec: 19 },
  { id: 'local-6', youtubeId: 'M7lc1UVf-VE', title: 'YouTube Developers Live', tags: ['tech', 'demo'], durationSec: 0 },
  { id: 'local-7', youtubeId: 'ScMzIvxBSi4', title: 'Peaceful Piano', tags: ['music', 'calm'], durationSec: 180 },
  { id: 'local-8', youtubeId: 'DWcJFNfaw9c', title: 'Earth From Space', tags: ['nature', 'space'], durationSec: 240 },
  { id: 'local-9', youtubeId: 'hFZFjoX2cGg', title: 'Caminandes Llama Drama', tags: ['film', 'fun', 'short'], durationSec: 150 },
  { id: 'local-10', youtubeId: 'YE7VzlLtp-4', title: 'Big Buck Bunny (short)', tags: ['film', 'fun', 'short'], durationSec: 60 }
];

function mapItem(row) {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    tags: row.tags || [],
    durationSec: row.duration_sec,
    isActive: row.is_active !== false,
    source: row.source || 'curated',
    createdAt: row.created_at
  };
}

async function selectInChunks(table, select, column, ids) {
  const out = [];
  const list = ids || [];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    if (!chunk.length) continue;
    const { data, error } = await supabase.from(table).select(select).in(column, chunk);
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

/**
 * Cache discovered YouTube videos into pulse_items (ignore duplicates).
 * @param {Array<{ youtubeId: string, title: string, tags?: string[], durationSec?: number }>} videos
 */
export async function upsertDiscoveredYoutubeVideos(videos) {
  if (!isSupabaseConfigured || !supabase || !videos?.length) return [];

  const rows = videos
    .filter((v) => v?.youtubeId)
    .map((v) => ({
      youtube_id: v.youtubeId,
      title: String(v.title || v.youtubeId).slice(0, 200),
      tags: Array.isArray(v.tags) ? v.tags.slice(0, 16) : [],
      duration_sec: v.durationSec || null,
      is_active: true,
      source: 'youtube_api'
    }));

  // Insert ignoring conflicts (unique youtube_id)
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from('pulse_items').insert(chunk);
    // 23505 unique_violation — expected for already cached videos
    if (error && error.code !== '23505' && !String(error.message || '').includes('duplicate')) {
      // PostgREST may return single error for whole batch; fall back one-by-one
      for (const row of chunk) {
        const { error: oneErr } = await supabase.from('pulse_items').insert(row);
        if (
          oneErr &&
          oneErr.code !== '23505' &&
          !String(oneErr.message || '').includes('duplicate')
        ) {
          console.warn('pulse_items insert failed', oneErr);
        }
      }
    }
  }

  const yids = rows.map((r) => r.youtube_id);
  const existing = await selectInChunks(
    'pulse_items',
    'id, youtube_id, title, tags, duration_sec, is_active, source, created_at',
    'youtube_id',
    yids
  );
  return (existing || []).map(mapItem);
}

/**
 * Attach reactions/comments/views to a list of items.
 */
async function enrichItemsWithSocial(items, myId, friendIds = []) {
  const ids = items.map((i) => i.id).filter(Boolean);
  if (ids.length === 0) {
    return {
      items: [],
      reactionsByItem: {},
      viewsByItem: {},
      myReactedIds: [],
      myViewedIds: [],
      myViewsByItem: {},
      profileMap: {}
    };
  }

  const [reactRows, commentRows, viewRows] = await Promise.all([
    selectInChunks('pulse_reactions', 'item_id, profile_id, created_at', 'item_id', ids),
    selectInChunks(
      'pulse_comments',
      'id, item_id, profile_id, t_sec, body, created_at',
      'item_id',
      ids
    ),
    selectInChunks(
      'pulse_views',
      'item_id, profile_id, watch_ms, watched_sec, duration_sec, completed, skipped',
      'item_id',
      ids
    )
  ]);

  // comments ordered by t_sec client-side
  commentRows.sort((a, b) => Number(a.t_sec) - Number(b.t_sec));

  const profileIds = new Set();
  for (const r of reactRows) profileIds.add(r.profile_id);
  for (const c of commentRows) profileIds.add(c.profile_id);
  for (const v of viewRows) profileIds.add(v.profile_id);
  for (const f of friendIds) profileIds.add(f);

  let profileMap = {};
  if (profileIds.size > 0) {
    const profiles = await selectInChunks(
      'profiles',
      'id, username, display_name, avatar_color',
      'id',
      [...profileIds]
    );
    profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  const reactionsByItem = {};
  const myReactedIds = [];
  for (const r of reactRows) {
    if (!reactionsByItem[r.item_id]) reactionsByItem[r.item_id] = [];
    reactionsByItem[r.item_id].push(r.profile_id);
    if (myId && r.profile_id === myId) myReactedIds.push(r.item_id);
  }

  const viewsByItem = {};
  const myViewedIds = [];
  const myViewsByItem = {};
  for (const v of viewRows) {
    if (!viewsByItem[v.item_id]) viewsByItem[v.item_id] = [];
    const signal = {
      profileId: v.profile_id,
      watchMs: v.watch_ms || 0,
      watchedSec: v.watched_sec != null ? Number(v.watched_sec) : (v.watch_ms || 0) / 1000,
      durationSec: v.duration_sec != null ? Number(v.duration_sec) : undefined,
      completed: !!v.completed,
      skipped: !!v.skipped
    };
    viewsByItem[v.item_id].push(signal);
    if (myId && v.profile_id === myId) {
      myViewedIds.push(v.item_id);
      myViewsByItem[v.item_id] = signal;
    }
  }

  const commentsByItem = {};
  for (const c of commentRows) {
    if (!commentsByItem[c.item_id]) commentsByItem[c.item_id] = [];
    const prof = profileMap[c.profile_id];
    commentsByItem[c.item_id].push({
      id: c.id,
      t: c.t_sec,
      user: prof?.username || prof?.display_name || 'user',
      profileId: c.profile_id,
      text: c.body,
      createdAt: c.created_at
    });
  }

  const enriched = items.map((it) => {
    const reactors = reactionsByItem[it.id] || [];
    const comments = commentsByItem[it.id] || [];
    return {
      ...it,
      reactCount: reactors.length,
      commentCount: comments.length,
      comments,
      likedByMe: myId ? reactors.includes(myId) : false
    };
  });

  return {
    items: enriched,
    reactionsByItem,
    viewsByItem,
    myReactedIds,
    myViewedIds,
    myViewsByItem,
    profileMap
  };
}

/**
 * Pull next YouTube batch, cache in DB, return new pulse items.
 * @param {{
 *   youtubeState?: object,
 *   tasteTags?: string[],
 *   existingYoutubeIds?: string[],
 * }} opts
 */
export async function expandPulseFromYoutube(opts = {}) {
  if (!isYoutubeCatalogEnabled()) {
    return {
      items: [],
      youtubeState: { ...(opts.youtubeState || {}), exhausted: true },
      youtubeEnabled: false
    };
  }

  const tasteQueries = tasteQueriesFromTags(opts.tasteTags || []);
  const exclude = new Set([...(opts.existingYoutubeIds || [])].map(String));

  const { videos, state } = await fetchYtPulseBatch({
    ...(opts.youtubeState || {}),
    tasteQueries,
    excludeYoutubeIds: exclude
  });

  const cached = await upsertDiscoveredYoutubeVideos(videos);
  return {
    items: cached,
    youtubeState: state,
    youtubeEnabled: true
  };
}

/**
 * Load catalog + social graph slices for ranking.
 * @param {{
 *   myId?: string,
 *   friendIds?: string[],
 *   expandYoutube?: boolean,
 *   youtubeState?: object,
 *   tasteTags?: string[],
 * }} opts
 */
export async function fetchPulseBundle(opts = {}) {
  const myId = opts.myId || null;
  const friendIds = opts.friendIds || [];
  const expandYoutube = opts.expandYoutube !== false;

  if (!isSupabaseConfigured || !supabase) {
    return {
      items: PULSE_FALLBACK_CATALOG.map((it) => ({
        ...it,
        reactCount: 0,
        commentCount: 0,
        comments: [],
        likedByMe: false
      })),
      reactionsByItem: {},
      viewsByItem: {},
      myReactedIds: [],
      myViewedIds: [],
      myViewsByItem: {},
      profileMap: {},
      youtubeEnabled: isYoutubeCatalogEnabled(),
      youtubeState: { exhausted: true }
    };
  }

  let youtubeState = opts.youtubeState || null;

  // Seed expansion from YouTube on open / load more
  if (expandYoutube && isYoutubeCatalogEnabled()) {
    try {
      const { data: existingRows } = await supabase
        .from('pulse_items')
        .select('youtube_id')
        .eq('is_active', true)
        .limit(2000);

      const existingYoutubeIds = (existingRows || []).map((r) => r.youtube_id);
      const expanded = await expandPulseFromYoutube({
        youtubeState,
        tasteTags: opts.tasteTags || [],
        existingYoutubeIds
      });
      youtubeState = expanded.youtubeState;
    } catch (e) {
      console.warn('YouTube expand failed', e);
      youtubeState = {
        ...(youtubeState || {}),
        lastError: e?.message || 'youtube_error'
      };
    }
  }

  const { data: itemsRaw, error: itemsErr } = await supabase
    .from('pulse_items')
    .select('id, youtube_id, title, tags, duration_sec, is_active, source, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(500);

  if (itemsErr) throw itemsErr;

  const items = (itemsRaw || []).map(mapItem);
  const social = await enrichItemsWithSocial(items, myId, friendIds);

  return {
    ...social,
    youtubeEnabled: isYoutubeCatalogEnabled(),
    youtubeState: youtubeState || { exhausted: !isYoutubeCatalogEnabled() }
  };
}

/**
 * Load another YouTube page and merge into an existing bundle.
 */
export async function loadMorePulseBundle(bundle, opts = {}) {
  const myId = opts.myId || null;
  const friendIds = opts.friendIds || [];

  if (!bundle) return fetchPulseBundle({ ...opts, expandYoutube: true });

  const tasteTags = [...(opts.tasteTags || [])];
  // Collect strong personal tags from my completed/liked items
  if (tasteTags.length === 0 && bundle.items) {
    for (const it of bundle.items) {
      if (it.likedByMe || bundle.myViewsByItem?.[it.id]?.completed) {
        tasteTags.push(...(it.tags || []));
      }
    }
  }

  const existingYoutubeIds = (bundle.items || []).map((i) => i.youtubeId).filter(Boolean);
  const expanded = await expandPulseFromYoutube({
    youtubeState: bundle.youtubeState,
    tasteTags,
    existingYoutubeIds
  });

  const known = new Set((bundle.items || []).map((i) => i.id));
  const newItems = (expanded.items || []).filter((i) => !known.has(i.id));

  if (newItems.length === 0) {
    return {
      ...bundle,
      youtubeState: expanded.youtubeState,
      youtubeEnabled: expanded.youtubeEnabled
    };
  }

  const socialNew = await enrichItemsWithSocial(newItems, myId, friendIds);

  // Merge maps
  const reactionsByItem = { ...bundle.reactionsByItem, ...socialNew.reactionsByItem };
  const viewsByItem = { ...bundle.viewsByItem, ...socialNew.viewsByItem };
  const myViewsByItem = { ...bundle.myViewsByItem, ...socialNew.myViewsByItem };
  const profileMap = { ...bundle.profileMap, ...socialNew.profileMap };

  return {
    items: [...(bundle.items || []), ...socialNew.items],
    reactionsByItem,
    viewsByItem,
    myReactedIds: [...new Set([...(bundle.myReactedIds || []), ...socialNew.myReactedIds])],
    myViewedIds: [...new Set([...(bundle.myViewedIds || []), ...socialNew.myViewedIds])],
    myViewsByItem,
    profileMap,
    youtubeEnabled: expanded.youtubeEnabled,
    youtubeState: expanded.youtubeState
  };
}

export async function togglePulseReaction(itemId, profileId, currentlyLiked) {
  if (!isSupabaseConfigured || !supabase || !profileId) {
    return { liked: !currentlyLiked };
  }

  if (currentlyLiked) {
    const { error } = await supabase
      .from('pulse_reactions')
      .delete()
      .eq('item_id', itemId)
      .eq('profile_id', profileId);
    if (error) throw error;
    return { liked: false };
  }

  const { error } = await supabase.from('pulse_reactions').insert({
    item_id: itemId,
    profile_id: profileId
  });
  if (error) throw error;
  return { liked: true };
}

export async function addPulseComment(itemId, profileId, tSec, body) {
  const text = String(body || '').trim().slice(0, 280);
  if (!text) throw new Error('Пустой комментарий');
  if (!isSupabaseConfigured || !supabase || !profileId) {
    return {
      id: `local-${Date.now()}`,
      t: tSec,
      text,
      profileId,
      user: 'me',
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from('pulse_comments')
    .insert({
      item_id: itemId,
      profile_id: profileId,
      t_sec: Math.max(0, Number(tSec) || 0),
      body: text
    })
    .select('id, item_id, profile_id, t_sec, body, created_at')
    .single();

  if (error) throw error;

  const { data: prof } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', profileId)
    .maybeSingle();

  return {
    id: data.id,
    t: data.t_sec,
    text: data.body,
    profileId: data.profile_id,
    user: prof?.username || prof?.display_name || 'me',
    createdAt: data.created_at
  };
}

/**
 * Persist a watch signal (skip / engage / complete).
 * @param {string} itemId
 * @param {string} profileId
 * @param {{ watchMs?: number, watchedSec?: number, durationSec?: number, completed?: boolean, skipped?: boolean }} signal
 */
export async function recordPulseView(itemId, profileId, signal = {}) {
  if (!isSupabaseConfigured || !supabase || !profileId || !itemId) return null;

  // Back-compat: recordPulseView(id, user, 5000)
  const raw = typeof signal === 'number' ? { watchMs: signal } : signal || {};
  const cls = classifyWatch(raw);
  const ms = Math.max(0, Math.floor(raw.watchMs ?? cls.watchMs ?? 0));
  const watchedSec = Math.max(0, Number(raw.watchedSec) || ms / 1000);
  const durationSec =
    raw.durationSec != null && Number.isFinite(Number(raw.durationSec))
      ? Math.max(0, Math.floor(Number(raw.durationSec)))
      : null;

  const row = {
    watch_ms: ms,
    watched_sec: watchedSec,
    duration_sec: durationSec,
    completed: !!cls.completed,
    skipped: !!cls.skipped,
    updated_at: new Date().toISOString()
  };

  const { data: existing } = await supabase
    .from('pulse_views')
    .select('watch_ms, watched_sec, completed, skipped')
    .eq('item_id', itemId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existing) {
    const next = {
      watch_ms: Math.max(existing.watch_ms || 0, row.watch_ms),
      watched_sec: Math.max(Number(existing.watched_sec) || 0, row.watched_sec),
      duration_sec: durationSec,
      // Once completed, stay completed; skip only if never engaged deeply
      completed: existing.completed || row.completed,
      skipped: row.completed || (existing.watch_ms || 0) >= 5000
        ? false
        : row.skipped && !existing.completed,
      updated_at: row.updated_at
    };
    await supabase
      .from('pulse_views')
      .update(next)
      .eq('item_id', itemId)
      .eq('profile_id', profileId);
    return { ...next, profileId };
  }

  await supabase.from('pulse_views').insert({
    item_id: itemId,
    profile_id: profileId,
    ...row
  });
  return { ...row, profileId };
}
