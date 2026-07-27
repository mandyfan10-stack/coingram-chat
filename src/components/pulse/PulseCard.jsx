import React, { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, Heart, MessageCircle } from 'lucide-react';
import { loadYoutubeApi } from '../../utils/youtubeApi';
import PulseTimeline from './PulseTimeline';
import PulseCommentInput from './PulseCommentInput';

function buildEmbedSrc(youtubeId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '0',
    controls: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
    fs: '0',
    enablejsapi: '1',
    // Critical for YT embed identity / Error 153
    ...(origin ? { origin } : {})
  });
  // nocookie host is more reliable for embeds in apps
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?${params.toString()}`;
}

export default function PulseCard({
  item,
  active,
  onToggleLike,
  onComment,
  onViewProgress
}) {
  const reactId = useId().replace(/:/g, '');
  const iframeId = `pulse-yt-${item.id}-${reactId}`;
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(item.durationSec || 0);
  const [activeComment, setActiveComment] = useState(null);
  const [showInput, setShowInput] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const pollRef = useRef(null);
  const activeSince = useRef(null);
  const lastReported = useRef(0);
  const maxWatchedSec = useRef(0);
  const maxWatchMs = useRef(0);

  const friendNames = item._engagedFriends || [];
  const watchUrl = `https://www.youtube.com/watch?v=${item.youtubeId}`;

  const reportProgress = (force = false) => {
    if (!onViewProgress || !activeSince.current) return;
    const wallMs = Date.now() - activeSince.current;
    maxWatchMs.current = Math.max(maxWatchMs.current, wallMs);
    const payload = {
      watchMs: maxWatchMs.current,
      watchedSec: maxWatchedSec.current,
      durationSec: dur || item.durationSec || 0
    };
    if (!force && wallMs - lastReported.current < 3500) return;
    lastReported.current = wallMs;
    onViewProgress(item.id, payload);
  };

  useEffect(() => {
    if (!item.comments?.length) {
      setActiveComment(null);
      return;
    }
    let best = null;
    let bestDist = 2.5;
    for (const c of item.comments) {
      const d = Math.abs(c.t - t);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    setActiveComment(best);
  }, [t, item.comments]);

  useEffect(() => {
    let cancelled = false;

    const destroyPlayer = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };

    if (!active) {
      reportProgress(true);
      activeSince.current = null;
      destroyPlayer();
      setT(0);
      setPlayerError(false);
      return undefined;
    }

    activeSince.current = Date.now();
    lastReported.current = 0;
    maxWatchedSec.current = 0;
    maxWatchMs.current = 0;
    setPlayerError(false);

    // Attach IFrame API to pre-rendered iframe (with referrerpolicy already set in JSX)
    const attach = async () => {
      const YT = await loadYoutubeApi();
      if (cancelled || !YT || !iframeRef.current) return;

      destroyPlayer();

      // Ensure iframe still has the right policy (YT sometimes rewrites node)
      try {
        iframeRef.current.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      } catch {
        /* ignore */
      }

      playerRef.current = new YT.Player(iframeId, {
        events: {
          onReady: (e) => {
            try {
              const d = e.target.getDuration?.() || item.durationSec || 0;
              if (d) setDur(d);
              e.target.unMute?.();
              e.target.playVideo?.();
            } catch {
              /* ignore */
            }
          },
          onError: () => {
            // 2 invalid id, 5 HTML5, 100 not found, 101/150 embed disabled
            setPlayerError(true);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState?.ENDED) {
              try {
                setT(e.target.getDuration?.() || dur);
              } catch {
                /* ignore */
              }
            }
          }
        }
      });

      pollRef.current = setInterval(() => {
        try {
          const p = playerRef.current;
          if (!p?.getCurrentTime) return;
          const cur = p.getCurrentTime() || 0;
          setT(cur);
          maxWatchedSec.current = Math.max(maxWatchedSec.current, cur);
          const d = p.getDuration?.() || 0;
          if (d) setDur(d);
          reportProgress(false);
        } catch {
          /* ignore */
        }
      }, 250);
    };

    // Small delay so iframe is in DOM with referrerpolicy before API wraps it
    const timer = setTimeout(() => {
      attach().catch(() => setPlayerError(true));
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      reportProgress(true);
      destroyPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, item.youtubeId, item.id, iframeId]);

  const seekTo = (ratio) => {
    const d = dur || 1;
    const next = Math.max(0, Math.min(d, ratio * d));
    setT(next);
    try {
      playerRef.current?.seekTo?.(next, true);
      playerRef.current?.playVideo?.();
    } catch {
      /* ignore */
    }
  };

  const handleComment = async (body) => {
    await onComment?.(item.id, t, body);
    setShowInput(false);
  };

  return (
    <section className={`pulse-card ${active ? 'is-active' : ''}`}>
      <div className="pulse-video-wrap">
        {active && !playerError && (
          <iframe
            ref={iframeRef}
            id={iframeId}
            className="pulse-yt-iframe"
            title={item.title}
            src={buildEmbedSrc(item.youtubeId)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}

        {(!active || playerError) && (
          <div className="pulse-video-placeholder">
            <img
              src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
            />
            {playerError && (
              <div className="pulse-video-error">
                <p>Ролик недоступен для встройки</p>
                <a href={watchUrl} target="_blank" rel="noreferrer" className="pulse-yt-open">
                  <ExternalLink size={14} />
                  Открыть на YouTube
                </a>
              </div>
            )}
          </div>
        )}
        <div className="pulse-video-gradient" />
      </div>

      <div className="pulse-card-ui">
        {friendNames.length > 0 && (
          <div className="pulse-friend-pill">
            с друзьями · {friendNames.slice(0, 3).map((n) => `@${n}`).join(' · ')}
          </div>
        )}

        <div className="pulse-caption">
          <h3>{item.title}</h3>
          <p>{(item.tags || []).map((tag) => `#${tag}`).join(' ')}</p>
        </div>

        {activeComment && (
          <div className="pulse-live-comment" key={activeComment.id || `${activeComment.t}`}>
            <div className="pulse-live-avatar" aria-hidden>
              {(activeComment.user?.[0] || '?').toUpperCase()}
            </div>
            <div className="pulse-live-body">
              <strong>@{activeComment.user}</strong>
              <span>{activeComment.text}</span>
            </div>
          </div>
        )}

        {showInput && active && (
          <PulseCommentInput tSec={t} onSubmit={handleComment} />
        )}

        <div className="pulse-side-actions">
          <button
            type="button"
            className={`pulse-side-btn ${item.likedByMe ? 'on' : ''}`}
            onClick={() => onToggleLike?.(item.id)}
            aria-label="Нравится"
          >
            <Heart size={22} fill={item.likedByMe ? 'currentColor' : 'none'} />
            <span>{item.reactCount || 0}</span>
          </button>
          <button
            type="button"
            className="pulse-side-btn"
            onClick={() => setShowInput((v) => !v)}
            aria-label="Комментарий"
          >
            <MessageCircle size={22} />
            <span>{item.commentCount || item.comments?.length || 0}</span>
          </button>
        </div>

        <PulseTimeline
          t={t}
          dur={dur}
          comments={item.comments || []}
          activeComment={activeComment}
          onSeek={seekTo}
        />
      </div>
    </section>
  );
}
