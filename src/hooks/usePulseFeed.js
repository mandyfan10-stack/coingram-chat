import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addPulseComment,
  fetchPulseBundle,
  loadMorePulseBundle,
  recordPulseView,
  togglePulseReaction
} from '../services/pulseService';
import {
  classifyWatch,
  demoteWatchedInFeed,
  rankPulseFeed
} from '../utils/pulseRank';
import { isYoutubeCatalogEnabled } from '../services/youtubeCatalog';
import {
  connectYoutubeForPulse,
  disconnectYoutubeAccount,
  isYoutubeOAuthConfigured,
  loadYoutubeAccount,
  refreshYoutubeTaste,
  youtubeTasteToTagList
} from '../services/youtubeAuth';

function applyNames(ranked, profileMap) {
  return ranked.map((it) => {
    const ids = it._engagedFriendIds || [];
    const names = ids
      .map((id) => profileMap[id]?.username || profileMap[id]?.display_name)
      .filter(Boolean);
    return {
      ...it,
      _engagedFriends: names,
      _engagedFriendIds: ids
    };
  });
}

function rankFromBundle(bundle, friendIdList, myId, sessionSeenIds, youtubeTaste) {
  if (!bundle) return [];
  return applyNames(
    rankPulseFeed(bundle.items, {
      friendIds: friendIdList,
      myId,
      reactionsByItem: bundle.reactionsByItem,
      viewsByItem: bundle.viewsByItem,
      myReactedIds: bundle.myReactedIds,
      myViewedIds: bundle.myViewedIds,
      myViewsByItem: bundle.myViewsByItem || {},
      sessionSeenIds,
      youtubeTaste: youtubeTaste || null
    }),
    bundle.profileMap || {}
  );
}

/**
 * Append newly discovered items after current feed without reshuffling seen.
 */
function appendRanked(currentItems, bundle, friendIdList, myId, sessionSeenIds, youtubeTaste) {
  const full = rankFromBundle(bundle, friendIdList, myId, sessionSeenIds, youtubeTaste);
  const have = new Set(currentItems.map((i) => i.id));
  const additions = full.filter((i) => !have.has(i.id));
  // Keep current order for already shown; append only truly new ones (prefer fresh)
  const freshAdd = additions.filter((i) => i._fresh);
  const recycledAdd = additions.filter((i) => !i._fresh);
  return [...currentItems, ...freshAdd, ...recycledAdd];
}

/**
 * @param {{
 *   enabled: boolean,
 *   myId?: string | null,
 *   friendIds?: string[],
 * }} opts
 */
export function usePulseFeed({ enabled, myId, friendIds = [] }) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [items, setItems] = useState([]);
  const [ytAccount, setYtAccount] = useState(null);
  const [ytBusy, setYtBusy] = useState(false);
  const loadedOnce = useRef(false);
  const viewTimers = useRef({});
  const sessionSeenRef = useRef(new Set());
  const feedLockedRef = useRef(false);
  const loadMoreInFlight = useRef(false);
  const youtubeTasteRef = useRef(null);

  const friendIdList = useMemo(
    () => [...new Set((friendIds || []).filter(Boolean).map(String))],
    [friendIds]
  );

  const youtubeEnabled = isYoutubeCatalogEnabled();
  const youtubeOAuthEnabled = isYoutubeOAuthConfigured();
  const hasMore = Boolean(
    youtubeEnabled && bundle?.youtubeState && !bundle.youtubeState.exhausted
  );

  const rebuildFeed = useCallback(
    (nextBundle, { lock = true, taste = youtubeTasteRef.current } = {}) => {
      const ranked = rankFromBundle(
        nextBundle,
        friendIdList,
        myId,
        sessionSeenRef.current,
        taste
      );
      setItems(ranked);
      if (lock) feedLockedRef.current = true;
    },
    [friendIdList, myId]
  );

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      // Load linked YouTube taste first (for expand queries + rank)
      let taste = youtubeTasteRef.current;
      if (myId) {
        try {
          const acc = await loadYoutubeAccount(myId);
          setYtAccount(acc);
          taste = acc?.taste || null;
          youtubeTasteRef.current = taste;
        } catch (e) {
          console.warn('loadYoutubeAccount', e);
        }
      }

      const tasteTags = youtubeTasteToTagList(taste);
      const next = await fetchPulseBundle({
        myId,
        friendIds: friendIdList,
        expandYoutube: true,
        tasteTags
      });
      setBundle(next);
      rebuildFeed(next, { lock: true, taste });
      loadedOnce.current = true;
    } catch (e) {
      console.error('Pulse feed load failed', e);
      setError(e?.message || 'Не удалось загрузить Pulse');
    } finally {
      setLoading(false);
    }
  }, [enabled, myId, friendIdList, rebuildFeed]);

  useEffect(() => {
    if (enabled && !loadedOnce.current) {
      reload();
    }
  }, [enabled, reload]);

  useEffect(() => {
    if (!bundle || !enabled) return;
    if (feedLockedRef.current && items.length > 0) return;
    rebuildFeed(bundle, { lock: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendIdList, myId, enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || !bundle || loadMoreInFlight.current) return;
    if (!youtubeEnabled) return;
    if (bundle.youtubeState?.exhausted) return;

    loadMoreInFlight.current = true;
    setLoadingMore(true);
    try {
      const tasteTags = youtubeTasteToTagList(youtubeTasteRef.current);
      const next = await loadMorePulseBundle(bundle, {
        myId,
        friendIds: friendIdList,
        tasteTags
      });
      setBundle(next);
      setItems((prev) =>
        appendRanked(
          prev,
          next,
          friendIdList,
          myId,
          sessionSeenRef.current,
          youtubeTasteRef.current
        )
      );
    } catch (e) {
      console.error('Pulse loadMore failed', e);
    } finally {
      setLoadingMore(false);
      loadMoreInFlight.current = false;
    }
  }, [enabled, bundle, youtubeEnabled, myId, friendIdList]);

  const connectYoutube = useCallback(async () => {
    if (!myId) throw new Error('Нужен вход в Coiny');
    setYtBusy(true);
    try {
      const saved = await connectYoutubeForPulse(myId);
      setYtAccount(saved);
      youtubeTasteRef.current = saved?.taste || null;
      feedLockedRef.current = false;
      await reload();
      return saved;
    } finally {
      setYtBusy(false);
    }
  }, [myId, reload]);

  const disconnectYoutube = useCallback(async () => {
    if (!myId) return;
    setYtBusy(true);
    try {
      await disconnectYoutubeAccount(myId);
      setYtAccount(null);
      youtubeTasteRef.current = null;
      feedLockedRef.current = false;
      await reload();
    } finally {
      setYtBusy(false);
    }
  }, [myId, reload]);

  const resyncYoutube = useCallback(async () => {
    if (!myId) return;
    setYtBusy(true);
    try {
      const saved = await refreshYoutubeTaste(myId);
      setYtAccount(saved);
      youtubeTasteRef.current = saved?.taste || null;
      feedLockedRef.current = false;
      await reload();
      return saved;
    } finally {
      setYtBusy(false);
    }
  }, [myId, reload]);

  const toggleLike = useCallback(
    async (itemId) => {
      const current = items.find((i) => i.id === itemId);
      if (!current || !myId) return;

      const wasLiked = !!current.likedByMe;
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                likedByMe: !wasLiked,
                reactCount: Math.max(0, (it.reactCount || 0) + (wasLiked ? -1 : 1))
              }
            : it
        )
      );

      try {
        await togglePulseReaction(itemId, myId, wasLiked);
        setBundle((b) => {
          if (!b) return b;
          const reactors = [...(b.reactionsByItem[itemId] || [])];
          if (wasLiked) {
            const idx = reactors.indexOf(myId);
            if (idx >= 0) reactors.splice(idx, 1);
          } else if (!reactors.includes(myId)) {
            reactors.push(myId);
          }
          const myReactedIds = wasLiked
            ? b.myReactedIds.filter((id) => id !== itemId)
            : [...b.myReactedIds, itemId];
          const itemsNext = b.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  likedByMe: !wasLiked,
                  reactCount: Math.max(0, (it.reactCount || 0) + (wasLiked ? -1 : 1))
                }
              : it
          );
          return {
            ...b,
            items: itemsNext,
            reactionsByItem: { ...b.reactionsByItem, [itemId]: reactors },
            myReactedIds
          };
        });
      } catch (e) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  likedByMe: wasLiked,
                  reactCount: Math.max(0, (it.reactCount || 0) + (wasLiked ? 1 : -1))
                }
              : it
          )
        );
        console.error(e);
      }
    },
    [items, myId]
  );

  const postComment = useCallback(
    async (itemId, tSec, body) => {
      if (!myId) throw new Error('Нужен вход');
      const created = await addPulseComment(itemId, myId, tSec, body);

      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          const comments = [...(it.comments || []), created].sort((a, b) => a.t - b.t);
          return {
            ...it,
            comments,
            commentCount: comments.length
          };
        })
      );

      setBundle((b) => {
        if (!b) return b;
        return {
          ...b,
          items: b.items.map((it) => {
            if (it.id !== itemId) return it;
            const comments = [...(it.comments || []), created].sort((a, b) => a.t - b.t);
            return { ...it, comments, commentCount: comments.length };
          })
        };
      });

      return created;
    },
    [myId]
  );

  const trackView = useCallback(
    (itemId, signal) => {
      if (!myId || !itemId) return;

      const payload =
        typeof signal === 'number'
          ? { watchMs: signal }
          : {
              watchMs: signal?.watchMs || 0,
              watchedSec: signal?.watchedSec,
              durationSec: signal?.durationSec
            };

      const key = itemId;
      const now = Date.now();
      const last = viewTimers.current[key] || 0;
      const force = (payload.watchMs || 0) >= 12000 || (payload.watchedSec || 0) > 2;
      if (now - last < 3500 && !force) return;
      viewTimers.current[key] = now;

      const cls = classifyWatch(payload);
      if (cls.skipped || cls.engaged || cls.completed || (payload.watchMs || 0) > 800) {
        if (!sessionSeenRef.current.has(itemId)) {
          sessionSeenRef.current.add(itemId);
          setItems((prev) => demoteWatchedInFeed(prev, itemId));
        }
      }

      recordPulseView(itemId, myId, payload).catch(() => {});

      setBundle((b) => {
        if (!b) return b;
        const prevMine = b.myViewsByItem?.[itemId] || {};
        const draft = {
          profileId: myId,
          watchMs: Math.max(prevMine.watchMs || 0, payload.watchMs || 0),
          watchedSec: Math.max(
            prevMine.watchedSec || 0,
            payload.watchedSec ?? (payload.watchMs || 0) / 1000
          ),
          durationSec: payload.durationSec ?? prevMine.durationSec
        };
        const classified = classifyWatch(draft);
        const merged = {
          ...draft,
          completed: prevMine.completed || classified.completed,
          skipped:
            classified.completed || (prevMine.watchMs || 0) >= 5000
              ? false
              : classified.skipped && !prevMine.completed
        };

        const list = [...(b.viewsByItem[itemId] || [])].filter(
          (v) => String(v.profileId) !== String(myId)
        );
        list.push(merged);

        const myViewedIds = b.myViewedIds.includes(itemId)
          ? b.myViewedIds
          : [...b.myViewedIds, itemId];

        return {
          ...b,
          myViewedIds,
          myViewsByItem: { ...(b.myViewsByItem || {}), [itemId]: merged },
          viewsByItem: { ...b.viewsByItem, [itemId]: list }
        };
      });
    },
    [myId]
  );

  const hardReload = useCallback(async () => {
    feedLockedRef.current = false;
    await reload();
  }, [reload]);

  return {
    items,
    loading,
    loadingMore,
    error,
    reload: hardReload,
    loadMore,
    hasMore,
    youtubeEnabled,
    youtubeOAuthEnabled,
    ytAccount,
    ytBusy,
    connectYoutube,
    disconnectYoutube,
    resyncYoutube,
    toggleLike,
    postComment,
    trackView,
    profileMap: bundle?.profileMap || {}
  };
}
