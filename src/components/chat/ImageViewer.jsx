import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.startsWith('data:video/') ||
    lower.includes('.mp4') ||
    lower.includes('.webm') ||
    lower.includes('.mov') ||
    lower.includes('.ogv') ||
    lower.includes('.mkv') ||
    lower.includes('video')
  );
}

export default function ImageViewer({ imageUrl, onClose }) {
  useEffect(() => {
    if (!imageUrl) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  const isVideo = isVideoUrl(imageUrl);

  const content = (
    <div
      className="chat-image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'Просмотр видео' : 'Просмотр изображения'}
      onClick={onClose}
    >
      <button
        type="button"
        className="chat-image-viewer-close"
        onClick={onClose}
        aria-label="Закрыть просмотр"
      >
        <X size={26} />
      </button>
      {isVideo ? (
        <video
          src={imageUrl}
          controls
          autoPlay
          playsInline
          className="chat-image-viewer-video"
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <img
          src={imageUrl}
          alt="Просмотр изображения"
          onClick={(event) => event.stopPropagation()}
        />
      )}
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
}
