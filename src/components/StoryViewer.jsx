import React, { useEffect, useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

export default function StoryViewer() {
  const {
    stories,
    activeStoryId,
    setActiveStoryId,
    renderAvatar
  } = useChat();

  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const elapsedBeforePauseRef = useRef(0);

  const activeIndex = stories.findIndex(s => s.id === activeStoryId);
  const activeStory = stories[activeIndex];

  const DURATION = 5000; // 5 seconds per story

  const handleClose = () => {
    setActiveStoryId(null);
  };

  const handleNext = () => {
    if (activeIndex < stories.length - 1) {
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
      setActiveStoryId(stories[activeIndex + 1].id);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
      setActiveStoryId(stories[activeIndex - 1].id);
    }
  };

  // Timer logic for automated story progress
  useEffect(() => {
    if (!activeStoryId) return;

    if (isPaused) {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
      return;
    }

    startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const percent = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(percent);

      if (percent >= 100) {
        handleNext();
      } else {
        timerRef.current = requestAnimationFrame(updateProgress);
      }
    };

    timerRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [activeStoryId, isPaused]);

  // Pause when clicking and holding the mouse / tapping and holding on touch screen
  const handleMouseDown = () => {
    setIsPaused(true);
    elapsedBeforePauseRef.current = Date.now() - startTimeRef.current;
  };

  const handleMouseUp = () => {
    setIsPaused(false);
  };

  if (!activeStory) return null;

  return (
    <div className="story-viewer-overlay" onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp}>
      {/* Background glass blur */}
      <div className="story-viewer-blur-bg" style={{ backgroundImage: `url(${activeStory.media})` }} />

      {/* Story Window */}
      <div
        className="story-container"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* Top Progress Bars */}
        <div className="story-progress-container">
          {stories.map((s, idx) => {
            let fillWidth = '0%';
            if (idx < activeIndex) fillWidth = '100%';
            if (idx === activeIndex) fillWidth = `${progress}%`;

            return (
              <div key={s.id} className="story-progress-track">
                <div className="story-progress-fill" style={{ width: fillWidth }} />
              </div>
            );
          })}
        </div>

        {/* Story Header */}
        <div className="story-header">
          <div className="story-user-info">
            <span className="story-user-avatar" style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderAvatar(activeStory.userAvatar, '🪙')}
            </span>
            <div className="story-user-meta">
              <span className="story-user-name">{activeStory.userName}</span>
              <span className="story-user-time">{activeStory.timestamp}</span>
            </div>
          </div>
          <div className="story-header-actions" onMouseDown={(e) => e.stopPropagation()}>
            <button className="story-icon-btn" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button className="story-icon-btn" onClick={handleClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Next/Prev Navigation overlay triggers */}
        <div className="story-nav-triggers" onMouseDown={(e) => e.stopPropagation()}>
          <button className="story-nav-btn prev" onClick={handlePrev} disabled={activeIndex === 0}>
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
          <img src={activeStory.media} alt={activeStory.caption} className="story-img" />
        </div>

        {/* Story Caption */}
        <div className="story-footer">
          <p className="story-caption">{activeStory.caption}</p>
        </div>
      </div>
    </div>
  );
}
