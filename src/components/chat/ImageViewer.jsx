import React, { useEffect, useState } from 'react';
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

export default function ImageViewer({ imageUrl, isVideo: isVideoProp, onClose }) {
  const [renderAsVideo, setRenderAsVideo] = useState(() => {
    if (typeof isVideoProp === 'boolean') return isVideoProp;
    return isVideoUrl(imageUrl);
  });

  useEffect(() => {
    if (typeof isVideoProp === 'boolean') {
      setRenderAsVideo(isVideoProp);
    } else {
      setRenderAsVideo(isVideoUrl(imageUrl));
    }
  }, [imageUrl, isVideoProp]);

  // If it's a blob: URL and we aren't sure, inspect the blob type via fetch
  useEffect(() => {
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('blob:')) return;
    if (typeof isVideoProp === 'boolean') return;

    let active = true;
    fetch(imageUrl)
      .then((res) => res.blob())
      .then((blob) => {
        if (active && blob && blob.type && blob.type.startsWith('video/')) {
          setRenderAsVideo(true);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [imageUrl, isVideoProp]);

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

  const isVideo = renderAsVideo;

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
          onError={() => {
            // Auto fallback to video if image decoding fails on decrypted blob
            setRenderAsVideo(true);
          }}
        />
      )}
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
}
