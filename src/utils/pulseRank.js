/**
 * Pure Pulse ranking — friends + in-Pulse taste + anti-repeat.
 * Unseen content first; already watched / session-seen go to the back.
 */

const FRIEND_LIKE = 100;
const FRIEND_VIEW = 40;
const FRIEND_COMPLETE = 55;
const FRIEND_TAG = 12;
const MY_TAG = 10;
const MY_COMPLETE_TAG = 16;
const SKIP_TAG_PENALTY = 14;
const HAS_COMMENTS = 5;
const SEEN_PENALTY = 40;
const COMPLETED_PENALTY = 70;
const SKIP_ITEM_PENALTY = 90;
const ANY_WATCH_PENALTY = 25;
const SESSION_SEEN_PENALTY = 200;
const YOUTUBE_TAG = 14;
const VIEW_MS_THRESHOLD = 3000;

export const SKIP_MS = 2500;
export const COMPLETE_RATIO = 0.65;
export const ENGAGE_MS = 5000;

/**
 * @typedef {{ id: string, youtubeId?: string, tags?: string[], reactCount?: number, commentCount?: number, durationSec?: number }} PulseRankItem
 * @typedef {{
 *   profileId: string,
 *   watchMs?: number,
 *   watchedSec?: number,
 *   durationSec?: number,
 *   completed?: boolean,
 *   skipped?: boolean,
 * }} PulseViewSignal
 * @typedef {{
 *   friendIds: string[],
 *   myId?: string | null,
 *   reactionsByItem?: Record<string, string[]>,
 *   viewsByItem?: Record<string, PulseViewSignal[]>,
 *   myReactedIds?: Set<string> | string[],
 *   myViewedIds?: Set<string> | string[],
 *   myViewsByItem?: Record<string, PulseViewSignal>,
 *   sessionSeenIds?: Set<string> | string[],
 *   youtubeTaste?: { tags?: Record<string, number>, channels?: Array<{ id?: string, title?: string }> },
 * }} PulseRankContext
 */

function toSet(value) {
  if (!value) return new Set();
  return value instanceof Set ? value : new Set([...value].map(String));
}

function primaryTag(item) {
  return (item.tags && item.tags[0]) || '_';
}

function videoKey(item) {
  return String(item.youtubeId || item.id || '');
}

/**
 * Drop duplicate youtube ids (keep first occurrence).
 * @param {PulseRankItem[]} items
 */
export function dedupePulseItems(items) {
  const seen = new Set();
  const out = [];
  for (const it of items || []) {
    const key = videoKey(it);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/**
 * @param {{ watchMs?: number, watchedSec?: number, durationSec?: number, completed?: boolean, skipped?: boolean }} raw
 */
export function classifyWatch(raw = {}) {
  if (raw.skipped === true) {
    return {
      skipped: true,
      completed: false,
      engaged: false,
      ratio: 0,
      watchMs: Math.max(0, raw.watchMs || 0)
    };
  }
  if (raw.completed === true) {
    return {
      skipped: false,
      completed: true,
      engaged: true,
      ratio: 1,
      watchMs: Math.max(0, raw.watchMs || 0)
    };
  }

  const watchMs = Math.max(0, Number(raw.watchMs) || 0);
  const watchedSec = Math.max(0, Number(raw.watchedSec) || watchMs / 1000);
  const durationSec = Math.max(0, Number(raw.durationSec) || 0);
  const ratio =
    durationSec > 0
      ? Math.min(1, watchedSec / durationSec)
      : watchMs >= 45000
        ? 1
        : watchMs / 45000;

  const skipped =
    watchMs > 0 &&
    watchMs < SKIP_MS &&
    watchedSec < 3 &&
    ratio < 0.08;

  const completed =
    !skipped && (ratio >= COMPLETE_RATIO || (durationSec === 0 && watchMs >= 45000));

  const engaged =
    !skipped && (completed || watchMs >= ENGAGE_MS || ratio >= 0.15);

  return { skipped, completed, engaged, ratio, watchMs };
}

/**
 * @param {PulseRankItem} item
 * @param {PulseRankContext} ctx
 */
export function getMyWatchClass(item, ctx) {
  const myView =
    ctx.myViewsByItem?.[item.id] ||
    (toSet(ctx.myViewedIds).has(item.id) ? { watchMs: ENGAGE_MS } : null);
  if (!myView) return null;
  return classifyWatch({
    ...myView,
    durationSec: myView.durationSec || item.durationSec
  });
}

/**
 * Fresh = never meaningfully watched / skipped / completed by me.
 * @param {PulseRankItem} item
 * @param {PulseRankContext} ctx
 */
export function isFreshForUser(item, ctx) {
  const sessionSeen = toSet(ctx.sessionSeenIds);
  if (sessionSeen.has(String(item.id))) return false;
  const cls = getMyWatchClass(item, ctx);
  if (!cls) return true;
  // any recorded watch (including short skip) is not "fresh"
  return !(cls.skipped || cls.engaged || cls.completed || cls.watchMs > 0);
}

/**
 * @param {PulseRankItem} item
 * @param {PulseRankContext} ctx
 * @param {{ friendTagScores: Map<string, number>, myTagScores: Map<string, number>, skipTagScores: Map<string, number> }} affinity
 */
export function scorePulseItem(item, ctx, affinity) {
  const { friendTagScores, myTagScores, skipTagScores } = affinity;
  const friendIds = new Set((ctx.friendIds || []).map(String));
  const reactors = (ctx.reactionsByItem?.[item.id] || []).map(String);
  const viewers = ctx.viewsByItem?.[item.id] || [];
  const sessionSeen = toSet(ctx.sessionSeenIds);

  const engagedFriends = [];
  let score = 0;

  for (const pid of reactors) {
    if (friendIds.has(pid)) {
      score += FRIEND_LIKE;
      if (!engagedFriends.includes(pid)) engagedFriends.push(pid);
    }
  }

  for (const v of viewers) {
    const pid = String(v.profileId);
    if (!friendIds.has(pid)) continue;
    const cls = classifyWatch(v);
    if (cls.completed) {
      score += FRIEND_COMPLETE;
      if (!engagedFriends.includes(pid)) engagedFriends.push(pid);
    } else if (cls.engaged || cls.watchMs >= VIEW_MS_THRESHOLD) {
      score += FRIEND_VIEW;
      if (!engagedFriends.includes(pid)) engagedFriends.push(pid);
    }
  }

  const ytTags = affinity.youtubeTagScores || new Map();

  for (const tag of item.tags || []) {
    score += (friendTagScores.get(tag) || 0) * FRIEND_TAG;
    score += (myTagScores.get(tag) || 0) * MY_TAG;
    score += (ytTags.get(tag) || 0) * YOUTUBE_TAG;
    score -= (skipTagScores.get(tag) || 0) * SKIP_TAG_PENALTY;
  }

  // Channel title match (subscription-based)
  const channelBoosts = affinity.youtubeChannelHints || [];
  if (channelBoosts.length && item.title) {
    const hay = String(item.title).toLowerCase();
    for (const hint of channelBoosts) {
      if (hint && hay.includes(hint)) {
        score += 18;
        break;
      }
    }
  }

  if ((item.commentCount || 0) > 0) score += HAS_COMMENTS;

  const reacts = item.reactCount || 0;
  score += Math.min(15, Math.log10(reacts + 1) * 10);

  const myReacted = toSet(ctx.myReactedIds);
  const cls = getMyWatchClass(item, ctx);

  if (cls) {
    if (cls.watchMs > 0) score -= ANY_WATCH_PENALTY;
    if (cls.skipped) {
      score -= SKIP_ITEM_PENALTY;
    } else if (cls.completed && !myReacted.has(item.id)) {
      score -= COMPLETED_PENALTY;
    } else if (cls.engaged && !myReacted.has(item.id)) {
      score -= SEEN_PENALTY;
    }
  }

  if (sessionSeen.has(String(item.id))) {
    score -= SESSION_SEEN_PENALTY;
  }

  let tasteHits = 0;
  for (const tag of item.tags || []) {
    tasteHits += myTagScores.get(tag) || 0;
  }
  // Only boost unwatched matches — avoid resurfacing the same watched clip
  if (tasteHits > 0 && isFreshForUser(item, ctx)) {
    score += Math.min(24, tasteHits * 3);
  }

  return {
    score,
    engagedFriendIds: engagedFriends,
    fresh: isFreshForUser(item, ctx)
  };
}

/**
 * @param {PulseRankItem[]} items
 * @param {PulseRankContext} ctx
 */
export function buildTagAffinity(items, ctx) {
  const friendIds = new Set((ctx.friendIds || []).map(String));
  const friendTagScores = new Map();
  const myTagScores = new Map();
  const skipTagScores = new Map();
  const myId = ctx.myId ? String(ctx.myId) : null;
  const myReacted = toSet(ctx.myReactedIds);

  const bump = (map, tag, w = 1) => {
    map.set(tag, (map.get(tag) || 0) + w);
  };

  for (const item of items) {
    const tags = item.tags || [];
    const reactors = (ctx.reactionsByItem?.[item.id] || []).map(String);
    const viewers = ctx.viewsByItem?.[item.id] || [];

    if (reactors.some((id) => friendIds.has(id))) {
      for (const tag of tags) bump(friendTagScores, tag, 1.2);
    }

    for (const v of viewers) {
      const pid = String(v.profileId);
      if (!friendIds.has(pid)) continue;
      const cls = classifyWatch({ ...v, durationSec: v.durationSec || item.durationSec });
      if (cls.completed) {
        for (const tag of tags) bump(friendTagScores, tag, 1.5);
      } else if (cls.engaged) {
        for (const tag of tags) bump(friendTagScores, tag, 0.8);
      }
    }

    if (myReacted.has(item.id) || (myId && reactors.includes(myId))) {
      for (const tag of tags) bump(myTagScores, tag, 2.5);
    }

    const mine =
      ctx.myViewsByItem?.[item.id] ||
      (myId && viewers.find((v) => String(v.profileId) === myId));

    if (mine) {
      const cls = classifyWatch({
        ...mine,
        durationSec: mine.durationSec || item.durationSec
      });
      if (cls.skipped) {
        for (const tag of tags) bump(skipTagScores, tag, 1);
      } else if (cls.completed) {
        for (const tag of tags) bump(myTagScores, tag, 2.2);
      } else if (cls.engaged) {
        const w = 0.6 + Math.min(1.4, (cls.ratio || 0) * 1.5);
        for (const tag of tags) bump(myTagScores, tag, w);
      }
    }
  }

  // External YouTube OAuth taste (subscriptions + likes)
  const youtubeTagScores = new Map();
  const youtubeChannelHints = [];
  const yt = ctx.youtubeTaste;
  if (yt?.tags && typeof yt.tags === 'object') {
    for (const [tag, w] of Object.entries(yt.tags)) {
      const clean = String(tag).toLowerCase();
      if (!clean || clean.startsWith('cat-')) continue;
      youtubeTagScores.set(clean, Number(w) || 1);
    }
  }
  if (Array.isArray(yt?.channels)) {
    for (const ch of yt.channels.slice(0, 30)) {
      const title = String(ch?.title || '').toLowerCase().trim();
      if (title.length >= 3) youtubeChannelHints.push(title.slice(0, 40));
    }
  }

  void MY_COMPLETE_TAG;
  return { friendTagScores, myTagScores, skipTagScores, youtubeTagScores, youtubeChannelHints };
}

/**
 * @param {Array<PulseRankItem & { _score: number }>} ordered
 */
export function applyDiversity(ordered) {
  if (ordered.length < 3) return ordered.slice();

  const pool = ordered.slice();
  const out = [];

  while (pool.length) {
    let pickIdx = 0;
    if (out.length >= 2) {
      const t1 = primaryTag(out[out.length - 1]);
      const t0 = primaryTag(out[out.length - 2]);
      if (t0 === t1) {
        const alt = pool.findIndex((it) => primaryTag(it) !== t1);
        if (alt > 0) pickIdx = alt;
      }
    }
    out.push(pool.splice(pickIdx, 1)[0]);
  }

  return out;
}

/**
 * @param {PulseRankItem[]} items
 * @param {PulseRankContext} ctx
 */
export function buildMyViewsByItem(items, ctx) {
  if (ctx.myViewsByItem && Object.keys(ctx.myViewsByItem).length) {
    return ctx.myViewsByItem;
  }
  const myId = ctx.myId ? String(ctx.myId) : null;
  const map = {};
  if (!myId) return map;
  for (const item of items) {
    const viewers = ctx.viewsByItem?.[item.id] || [];
    const mine = viewers.find((v) => String(v.profileId) === myId);
    if (mine) {
      map[item.id] = {
        ...mine,
        durationSec: mine.durationSec || item.durationSec
      };
    }
  }
  return map;
}

function sortByScore(list) {
  return list.slice().sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Rank feed: dedupe → score → fresh first → recycled last → diversity per bucket.
 * @param {PulseRankItem[]} items
 * @param {PulseRankContext} ctx
 */
export function rankPulseFeed(items, ctx = { friendIds: [] }) {
  const list = dedupePulseItems(Array.isArray(items) ? items : []);
  const myViewsByItem = buildMyViewsByItem(list, ctx);
  const fullCtx = { ...ctx, myViewsByItem };
  const affinity = buildTagAffinity(list, fullCtx);

  const scored = list.map((item) => {
    const { score, engagedFriendIds, fresh } = scorePulseItem(item, fullCtx, affinity);
    return {
      ...item,
      _score: score,
      _engagedFriendIds: engagedFriendIds,
      _fresh: fresh
    };
  });

  const fresh = sortByScore(scored.filter((i) => i._fresh));
  const recycled = sortByScore(scored.filter((i) => !i._fresh));

  // Soft exploration: if almost everything is recycled, still show recycled
  // but never interleave recycled above remaining fresh.
  return [...applyDiversity(fresh), ...applyDiversity(recycled)];
}

/**
 * Stable session update: move one watched item to the recycled tail without
 * reshuffling the rest of the queue (prevents "same video again" mid-scroll).
 * @param {Array} currentFeed
 * @param {string} itemId
 */
export function demoteWatchedInFeed(currentFeed, itemId) {
  const list = Array.isArray(currentFeed) ? currentFeed.slice() : [];
  const idx = list.findIndex((i) => String(i.id) === String(itemId));
  if (idx < 0) return list;
  const [item] = list.splice(idx, 1);
  list.push({ ...item, _fresh: false, _score: (item._score || 0) - SESSION_SEEN_PENALTY });
  return list;
}

export const PULSE_RANK_WEIGHTS = {
  FRIEND_LIKE,
  FRIEND_VIEW,
  FRIEND_COMPLETE,
  FRIEND_TAG,
  MY_TAG,
  MY_COMPLETE_TAG,
  SKIP_TAG_PENALTY,
  HAS_COMMENTS,
  SEEN_PENALTY,
  COMPLETED_PENALTY,
  SKIP_ITEM_PENALTY,
  ANY_WATCH_PENALTY,
  SESSION_SEEN_PENALTY,
  YOUTUBE_TAG,
  VIEW_MS_THRESHOLD,
  SKIP_MS,
  COMPLETE_RATIO,
  ENGAGE_MS
};
