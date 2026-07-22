import React, { useEffect, useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import useResolvedMedia from '../hooks/useResolvedMedia';

export default function StoryViewer() {
  const {
    stories,
    activeStoryId,
    setActiveStoryId,
    renderAvatar,
    viewStory
  } = useChat();

  const [isPaused, setIsPaused] = useState(false);
  const [lastActiveStoryId, setLastActiveStoryId] = useState(null);
  const [mediaRetryKey, setMediaRetryKey] = useState(0);
  const [imageRenderError, setImageRenderError] = useState(false);

  useEffect(() => {
    if (activeStoryId) {
      setLastActiveStoryId(activeStoryId);
    }
  }, [activeStoryId]);

  const displayStoryId = activeStoryId || lastActiveStoryId;
  const displayStory = stories.find(s => s.id === displayStoryId);
  const userStories = displayStory ? stories.filter(s => s.userId === displayStory.userId) : [];
  const activeIndexInUserStories = userStories.findIndex(s => s.id === displayStoryId);
  const {
    url: storyMediaUrl,
    loading: storyMediaLoading,
    error: storyMediaError
  } = useResolvedMedia(displayStory?.media, null, 'image/jpeg', mediaRetryKey);

  useEffect(() => {
    setMediaRetryKey(0);
    setImageRenderError(false);
  }, [displayStoryId]);

  const retryMedia = () => {
    setImageRenderError(false);
    setMediaRetryKey(key => key + 1);
  };

  const DURATION = 5000; // 5 seconds per story
  const timeoutRef = useRef(null);
  const handleNextRef = useRef(null);
  const startTimeRef = useRef(null);
  const remainingTimeRef = useRef(DURATION);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    remainingTimeRef.current = DURATION;
    startTimeRef.current = null;
  };

  const handleClose = () => {
    resetTimer();
    setActiveStoryId(null);
  };

  const handleNext = () => {
    if (activeIndexInUserStories < userStories.length - 1) {
      resetTimer();
      setIsPaused(false);
      setActiveStoryId(userStories[activeIndexInUserStories + 1].id);
    } else {
      handleClose();
    }
  };

  handleNextRef.current = handleNext;

  const handlePrev = () => {
    if (activeIndexInUserStories > 0) {
      resetTimer();
      setIsPaused(false);
      setActiveStoryId(userStories[activeIndexInUserStories - 1].id);
    }
  };

  // Timer Effect for automated story playback
  useEffect(() => {
    if (!activeStoryId || storyMediaLoading || storyMediaError || imageRenderError || !storyMediaUrl) return;

    if (isPaused) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
      }
      return;
    }

    startTimeRef.current = Date.now();
    timeoutRef.current = setTimeout(() => {
      handleNextRef.current?.();
    }, remainingTimeRef.current);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [activeStoryId, isPaused, storyMediaLoading, storyMediaError, imageRenderError, storyMediaUrl]);

  // Automatically mark the current story as viewed when activeStoryId changes
  useEffect(() => {
    if (activeStoryId) {
      viewStory(activeStoryId);
    }
  }, [activeStoryId, viewStory]);

  // Pause when clicking and holding the mouse / tapping and holding on touch screen
  const handleMouseDown = (e) => {
    setIsPaused(true);
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);
    touchStartXRef.current = clientX || 0;
    touchStartYRef.current = clientY || 0;
    touchStartTimeRef.current = Date.now();
  };

  const handleMouseUp = (e) => {
    setIsPaused(false);
    if (touchStartXRef.current === 0) return;
    
    const clientX = e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX);
    const clientY = e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY);
    
    if (clientX !== undefined && clientY !== undefined) {
      const dx = clientX - touchStartXRef.current;
      const dy = clientY - touchStartYRef.current;
      
      touchStartXRef.current = 0; // reset
      
      if (Math.abs(dx) > 50 && Math.abs(dy) < 80) {
        // Swipe detected!
        if (dx > 0) {
          handlePrev();
        } else {
          handleNextRef.current?.();
        }
      }
    }
  };

  if (!displayStory) return null;

  return (
    <div 
      className={`story-viewer-overlay ${activeStoryId ? 'open' : ''}`} 
      onMouseUp={handleMouseUp} 
      onTouchEnd={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchCancel={handleMouseUp}
    >
      {/* Background glass blur */}
      <div
        className="story-viewer-blur-bg"
        style={{ backgroundImage: storyMediaUrl ? 'url(' + storyMediaUrl + ')' : 'none' }}
      />

      {/* Story Window */}
      <div
        className="story-container"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* Top Progress Bars */}
        <div className="story-progress-container">
          {userStories.map((s, idx) => {
            let statusClass = '';
            if (idx < activeIndexInUserStories) statusClass = 'filled';
            else if (idx === activeIndexInUserStories) statusClass = `active ${isPaused ? 'paused' : ''}`;

            return (
              <div key={s.id} className="story-progress-track">
                <div className={`story-progress-fill ${statusClass}`} />
              </div>
            );
          })}
        </div>

        {/* Story Header */}
        <div className="story-header">
          <div className="story-user-info">
            <span className="story-user-avatar" style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderAvatar(displayStory.userAvatar, '🪙')}
            </span>
            <div className="story-user-meta">
              <span className="story-user-name">{displayStory.userName}</span>
              <span className="story-user-time">{displayStory.timestamp}</span>
            </div>
          </div>
          <div className="story-header-actions">
            <button className="story-icon-btn" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button className="story-icon-btn" onClick={handleClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Next/Prev Navigation overlay triggers */}
        <div className="story-nav-triggers">
          <button className="story-nav-btn prev" onClick={handlePrev} disabled={activeIndexInUserStories === 0}>
            <ChevronLeft size={28} />
          </button>
          <div className="story-nav-touch-half" onClick={handlePrev} />
          <div className="story-nav-touch-half" onClick={handleNext} />
          <button className="story-nav-btn next" onClick={handleNext}>
            <ChevronRight size={28} />
          </button>
        </div>

        {/* Story Image Content */}
        <div className="story-media-wrapper">
          {storyMediaLoading ? (
            <div className="story-media-status">
              <div className="spinner story-media-spinner" />
              <span>Загрузка истории...</span>
            </div>
          ) : storyMediaError || imageRenderError || !storyMediaUrl ? (
            <div className="story-media-status story-media-error">
              <span>История недоступна</span>
              <button type="button" onClick={retryMedia}>Повторить</button>
            </div>
          ) : (
            <img
              key={displayStoryId}
              src={storyMediaUrl}
              alt={displayStory.caption}
              className="story-img"
              draggable="false"
              onDragStart={(e) => e.preventDefault()}
              onError={() => setImageRenderError(true)}
            />
          )}
        </div>

        {/* Story Caption */}
        <div className="story-footer">
          <p className="story-caption">{displayStory.caption}</p>
        </div>
      </div>
    </div>
  );
}
