import React from 'react';

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PulseTimeline({
  t,
  dur,
  comments = [],
  activeComment,
  onSeek
}) {
  const progress = dur > 0 ? t / dur : 0;

  const onClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek?.(ratio);
  };

  return (
    <div className="pulse-timeline-block">
      <button type="button" className="pulse-timeline" onClick={onClick} aria-label="Таймлайн">
        <span className="pulse-timeline-track" />
        <span className="pulse-timeline-fill" style={{ width: `${progress * 100}%` }} />
        {comments.map((c) => {
          const left = dur > 0 ? (c.t / dur) * 100 : 0;
          const isOn = activeComment && activeComment.id === c.id;
          return (
            <span
              key={c.id || `${c.user}-${c.t}-${c.text}`}
              className={`pulse-cmt-pin ${isOn ? 'on' : ''}`}
              style={{ left: `${Math.min(98, Math.max(1, left))}%` }}
              title={`@${c.user}: ${c.text}`}
            />
          );
        })}
        <span className="pulse-timeline-knob" style={{ left: `${progress * 100}%` }} />
      </button>
      <div className="pulse-timeline-meta">
        <span>{formatTime(t)}</span>
        <span>{formatTime(dur)}</span>
      </div>
    </div>
  );
}
