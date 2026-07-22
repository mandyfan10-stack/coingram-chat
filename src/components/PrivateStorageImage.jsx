import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const privateImageCache = new Map();

function getPrivateAttachmentPath(url) {
  if (typeof url !== 'string') return null;

  const marker = 'chat-attachments/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  return decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0]);
}

async function loadPrivateImage(url) {
  if (privateImageCache.has(url)) return privateImageCache.get(url);

  const request = (async () => {
    const filePath = getPrivateAttachmentPath(url);
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .download(filePath);

    if (error) throw error;
    return URL.createObjectURL(data);
  })();

  privateImageCache.set(url, request);

  try {
    return await request;
  } catch (error) {
    privateImageCache.delete(url);
    throw error;
  }
}

export default function PrivateStorageImage({ src, alt, fallback = '👤', ...props }) {
  const [image, setImage] = useState({ source: null, url: null, error: false });

  useEffect(() => {
    let active = true;

    if (!src) {
      setImage({ source: src, url: null, error: true });
      return;
    }

    if (!getPrivateAttachmentPath(src)) {
      setImage({ source: src, url: src, error: false });
      return;
    }

    setImage({ source: src, url: null, error: false });

    loadPrivateImage(src)
      .then(url => {
        if (active) setImage({ source: src, url, error: false });
      })
      .catch(error => {
        if (import.meta.env.DEV) console.warn('Avatar is unavailable:', error);
        if (active) setImage({ source: src, url: null, error: true });
      });

    return () => {
      active = false;
    };
  }, [src]);

  if (image.source !== src || (!image.url && !image.error)) return null;
  if (image.error) return <span className="avatar-text">{fallback}</span>;

  return (
    <img
      src={image.url}
      alt={alt}
      {...props}
      onError={() => setImage({ source: src, url: null, error: true })}
    />
  );
}