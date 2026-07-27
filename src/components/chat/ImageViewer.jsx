import React from 'react';
import { X } from 'lucide-react';

export default function ImageViewer({ imageUrl, onClose }) {
  if (!imageUrl) return null;

  return (
    <div
      className="chat-image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
      onClick={onClose}
    >
      <button type="button" className="chat-image-viewer-close" onClick={onClose} aria-label="Закрыть изображение">
        <X size={26} />
      </button>
      <img src={imageUrl} alt="Просмотр изображения" onClick={(event) => event.stopPropagation()} />
    </div>
  );
}
