import React from 'react';
import './ChatSkeleton.css';

/**
 * Telegram-style Shimmer Skeleton rendered while cold/uncached chat history is loading.
 */
export default function ChatSkeleton() {
  const skeletonBubbles = [
    { id: 1, type: 'incoming', width: '58%', lines: 2, avatar: true },
    { id: 2, type: 'incoming', width: '42%', lines: 1, avatar: true },
    { id: 3, type: 'outgoing', width: '65%', lines: 2 },
    { id: 4, type: 'incoming', width: '75%', lines: 3, avatar: true },
    { id: 5, type: 'outgoing', width: '48%', lines: 1 },
    { id: 6, type: 'outgoing', width: '38%', lines: 1 }
  ];

  return (
    <div className="chat-skeleton-container" aria-label="Загрузка сообщений..." role="status">
      <div className="chat-skeleton-list">
        {skeletonBubbles.map((item) => (
          <div key={item.id} className={`chat-skeleton-row ${item.type}`}>
            {item.avatar && <div className="skeleton-avatar shimmer" />}
            <div
              className={`skeleton-bubble ${item.type} shimmer`}
              style={{ width: item.width }}
            >
              <div className="skeleton-content">
                {Array.from({ length: item.lines }).map((_, lineIdx) => (
                  <div
                    key={lineIdx}
                    className="skeleton-line shimmer-line"
                    style={{
                      width: lineIdx === item.lines - 1 && item.lines > 1 ? '60%' : '100%'
                    }}
                  />
                ))}
              </div>
              <div className="skeleton-meta">
                <span className="skeleton-time" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
