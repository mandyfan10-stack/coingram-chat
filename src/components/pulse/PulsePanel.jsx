import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Link2Off, Loader2, PlaySquare, RefreshCw, X } from 'lucide-react';
import { usePulseFeed } from '../../hooks/usePulseFeed';
import PulseCard from './PulseCard';
import './PulsePanel.css';

const PANEL_WIDTH = 320;
const OPEN_THRESHOLD = 96;

export default function PulsePanel() {
  const { isPulseOpen, setIsPulseOpen, setIsInfoOpen, chats } = useChat();
  const { currentUser } = useAuth();
  const [dragWidth, setDragWidth] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const feedRef = useRef(null);
  const dragRef = useRef(null);
  const dragWidthRef = useRef(null);

  const friendIds = useMemo(() => {
    const me = currentUser?.id;
    const ids = [];
    for (const c of chats || []) {
      if (c.type !== 'personal') continue;
      const other = (c.members || []).find((m) => m.id && m.id !== me);
      if (other?.id) ids.push(other.id);
    }
    return ids;
  }, [chats, currentUser?.id]);

  const {
    items,
    loading,
    loadingMore,
    error,
    reload,
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
    trackView
  } = usePulseFeed({
    enabled: isPulseOpen || isDragging,
    myId: currentUser?.id,
    friendIds
  });

  const onConnectYt = async () => {
    try {
      await connectYoutube();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Не удалось подключить YouTube');
    }
  };

  const width = dragWidth !== null ? dragWidth : isPulseOpen ? PANEL_WIDTH : 0;
  const isOpenVisual = width > 8;
  const showPanel = isOpenVisual || isDragging;

  const closePulse = useCallback(() => {
    setIsPulseOpen(false);
    setDragWidth(null);
    dragWidthRef.current = null;
    setIsDragging(false);
  }, [setIsPulseOpen]);

  const openPulse = useCallback(() => {
    setIsInfoOpen(false);
    setIsPulseOpen(true);
    setDragWidth(null);
    dragWidthRef.current = null;
    setIsDragging(false);
  }, [setIsInfoOpen, setIsPulseOpen]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el || !isPulseOpen) return undefined;

    const onScroll = () => {
      const h = el.clientHeight || 1;
      const idx = Math.round(el.scrollTop / h);
      const maxIdx = Math.max(items.length - 1, 0);
      setActiveIndex(Math.max(0, Math.min(maxIdx, idx)));

      // Near end of current feed → pull next YouTube pages
      if (hasMore && !loadingMore && items.length > 0 && idx >= items.length - 3) {
        loadMore();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [isPulseOpen, items.length, hasMore, loadingMore, loadMore]);

  const beginDrag = useCallback(
    (clientX, fromOpen) => {
      const open = Boolean(fromOpen || isPulseOpen);
      dragRef.current = {
        startX: clientX,
        startWidth: open ? PANEL_WIDTH : 0
      };
      dragWidthRef.current = open ? PANEL_WIDTH : 0;
      setIsDragging(true);
      setDragWidth(open ? PANEL_WIDTH : 0);
    },
    [isPulseOpen]
  );

  const moveDrag = useCallback((clientX) => {
    if (!dragRef.current) return;
    const { startX, startWidth } = dragRef.current;
    const next = Math.min(PANEL_WIDTH, Math.max(0, startWidth + (clientX - startX)));
    dragWidthRef.current = next;
    setDragWidth(next);
  }, []);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    const w = dragWidthRef.current ?? 0;
    dragRef.current = null;
    setIsDragging(false);
    if (w >= OPEN_THRESHOLD) openPulse();
    else closePulse();
  }, [openPulse, closePulse]);

  useEffect(() => {
    if (!isDragging) return undefined;
    const onMove = (e) => {
      if (!dragRef.current) return;
      const x = e.touches?.[0]?.clientX ?? e.clientX;
      if (x == null) return;
      moveDrag(x);
      if (e.cancelable && e.touches) e.preventDefault();
    };
    const onUp = () => endDrag();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging, moveDrag, endDrag]);

  const handleEdgePointerDown = (e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    if (x == null) return;
    e.preventDefault();
    beginDrag(x, false);
  };

  const handlePanelEdgePointerDown = (e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    if (x == null) return;
    e.preventDefault();
    beginDrag(x, true);
  };

  const panelStyle = {
    width: `${width}px`,
    transition: isDragging ? 'none' : undefined
  };

  return (
    <div
      className={`pulse-shell ${isOpenVisual ? 'is-open' : ''} ${isDragging ? 'is-dragging' : ''} ${showPanel ? 'has-panel' : 'is-collapsed'}`}
    >
      {showPanel && (
        <aside
          className={`pulse-panel open ${isDragging ? 'dragging' : ''}`}
          style={panelStyle}
          aria-hidden={!isOpenVisual}
        >
          <div className="pulse-panel-inner">
            <header className="pulse-header">
              <div className="pulse-header-text">
                <h2>Pulse</h2>
                <p>
                  {ytAccount?.channel_title
                    ? `YT · ${ytAccount.channel_title}`
                    : youtubeEnabled
                      ? 'YouTube · подключи канал для вкуса'
                      : 'локальный каталог'}
                </p>
              </div>
              <div className="pulse-header-actions">
                {ytAccount ? (
                  <>
                    <button
                      type="button"
                      className="pulse-yt-btn is-on"
                      onClick={() => resyncYoutube().catch((e) => alert(e.message))}
                      disabled={ytBusy || !youtubeOAuthEnabled}
                      title="Синхронизировать вкус YouTube"
                      aria-label="Синхронизировать YouTube"
                    >
                      {ytBusy ? <Loader2 className="pulse-spin" size={16} /> : <PlaySquare size={16} />}
                    </button>
                    <button
                      type="button"
                      className="pulse-icon-btn"
                      onClick={() => disconnectYoutube().catch((e) => alert(e.message))}
                      disabled={ytBusy}
                      title="Отключить YouTube"
                      aria-label="Отключить YouTube"
                    >
                      <Link2Off size={15} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="pulse-yt-btn"
                    onClick={() => {
                      if (!youtubeOAuthEnabled) {
                        alert(
                          'Чтобы подключить YouTube, добавь в .env:\n\nVITE_GOOGLE_OAUTH_CLIENT_ID=....apps.googleusercontent.com\n\nи перезапусти npm run dev'
                        );
                        return;
                      }
                      onConnectYt();
                    }}
                    disabled={ytBusy || !currentUser}
                    title="Подключить YouTube"
                    aria-label="Подключить YouTube"
                  >
                    {ytBusy ? <Loader2 className="pulse-spin" size={16} /> : <PlaySquare size={16} />}
                    <span>YouTube</span>
                  </button>
                )}
                <button
                  type="button"
                  className="pulse-icon-btn"
                  onClick={() => reload()}
                  title="Обновить"
                  aria-label="Обновить"
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  className="pulse-close-btn"
                  onClick={closePulse}
                  aria-label="Закрыть"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {!ytAccount && !loading && (
              <div className="pulse-yt-banner">
                <PlaySquare size={16} />
                <span>
                  {youtubeOAuthEnabled
                    ? 'Подключи YouTube — рекомендации по подпискам и лайкам'
                    : 'Нужен VITE_GOOGLE_OAUTH_CLIENT_ID в .env'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!youtubeOAuthEnabled) {
                      alert(
                        'Добавь в .env:\nVITE_GOOGLE_OAUTH_CLIENT_ID=....apps.googleusercontent.com\n\nПерезапусти dev-сервер.'
                      );
                      return;
                    }
                    onConnectYt();
                  }}
                  disabled={ytBusy || !currentUser}
                >
                  {youtubeOAuthEnabled ? 'Войти' : 'Как?'}
                </button>
              </div>
            )}

            {loading && items.length === 0 && (
              <div className="pulse-state">
                <Loader2 className="pulse-spin" size={22} />
                <span>Загрузка…</span>
              </div>
            )}

            {error && items.length === 0 && (
              <div className="pulse-state">
                <p>{error}</p>
                <button type="button" className="pulse-retry" onClick={() => reload()}>
                  Повторить
                </button>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="pulse-state">
                <p>Пока пусто</p>
              </div>
            )}

            {items.length > 0 && (
              <div className="pulse-tiktok-feed" ref={feedRef}>
                {items.map((item, index) => (
                  <PulseCard
                    key={item.id}
                    item={item}
                    active={isPulseOpen && index === activeIndex}
                    onToggleLike={toggleLike}
                    onComment={postComment}
                    onViewProgress={trackView}
                  />
                ))}
                {loadingMore && (
                  <div className="pulse-load-more">
                    <Loader2 className="pulse-spin" size={18} />
                    <span>Ещё с YouTube…</span>
                  </div>
                )}
                {!youtubeEnabled && (
                  <div className="pulse-load-more pulse-api-hint">
                    Добавь <code>VITE_YOUTUBE_API_KEY</code> в <code>.env</code> для
                    бесконечного каталога YouTube
                  </div>
                )}
              </div>
            )}

            <div
              className="pulse-drag-strip pulse-drag-strip-right"
              onPointerDown={handlePanelEdgePointerDown}
              title="Потяните влево, чтобы закрыть"
            />
          </div>
        </aside>
      )}

      {!showPanel && (
        <button
          type="button"
          className="pulse-edge-tab"
          aria-label="Вытянуть Pulse"
          onPointerDown={handleEdgePointerDown}
        >
          <span className="pulse-edge-tab-grip" />
          <span className="pulse-edge-tab-label">Pulse</span>
        </button>
      )}
    </div>
  );
}
