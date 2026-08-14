import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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

  const content = (
    <div
      className="chat-image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
      onClick={onClose}
    >
      <button
        type="button"
        className="chat-image-viewer-close"
        onClick={onClose}
        aria-label="Закрыть изображение"
      >
        <X size={26} />
      </button>
      <img
        src={imageUrl}
        alt="Просмотр изображения"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
}
