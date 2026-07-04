import React, { useEffect, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

export default function StoryViewer() {
  const {
    stories,
    activeStoryId,
    setActiveStoryId,
    renderAvatar,
    viewStory
  } = useChat();

  const [isPaused, setIsPaused] = useState(false);

  const activeStory = stories.find(s => s.id === activeStoryId);
  const userStories = activeStory ? stories.filter(s => s.userId === activeStory.userId) : [];
  const activeIndexInUserStories = userStories.findIndex(s => s.id === activeStoryId);

  const handleClose = () => {
    setActiveStoryId(null);
  };

  const handleNext = () => {
    if (activeIndexInUserStories < userStories.length - 1) {
      setIsPaused(false);
      setActiveStoryId(userStories[activeIndexInUserStories + 1].id);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (activeIndexInUserStories > 0) {
      setIsPaused(false);
      setActiveStoryId(userStories[activeIndexInUserStories - 1].id);
    }
  };

  // Automatically mark the current story as viewed when activeStoryId changes
  useEffect(() => {
    if (activeStoryId) {
      viewStory(activeStoryId);
    }
  }, [activeStoryId, viewStory]);

  // Pause when clicking and holding the mouse / tapping and holding on touch screen
  const handleMouseDown = () => {
    setIsPaused(true);
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
          {userStories.map((s, idx) => {
            let statusClass = '';
            if (idx < activeIndexInUserStories) statusClass = 'filled';
            else if (idx === activeIndexInUserStories) statusClass = `active ${isPaused ? 'paused' : ''}`;

            return (
              <div key={s.id} className="story-progress-track">
                <div 
                  className={`story-progress-fill ${statusClass}`} 
                  onAnimationEnd={handleNext}
                />
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
