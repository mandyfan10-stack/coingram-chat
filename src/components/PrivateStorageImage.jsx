import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getPrivateMediaReference } from '../utils/storageMedia';
import { createManagedObjectUrl, revokeManagedObjectUrl } from '../utils/objectUrlRegistry';

async function loadPrivateImage(url, objectUrlKey) {
  const storageReference = getPrivateMediaReference(url);
  const { data, error } = await supabase.storage
    .from(storageReference.bucket)
    .download(storageReference.path);

  if (error) throw error;
  return createManagedObjectUrl(objectUrlKey, data);
}

export default function PrivateStorageImage({ src, alt, fallback = '👤', ...props }) {
  const [image, setImage] = useState({ source: null, url: null, error: false });
  const objectUrlKey = useRef(`private-image:${crypto.randomUUID()}`);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    const currentObjectUrlKey = objectUrlKey.current;

    if (!src) {
      setImage({ source: src, url: null, error: true });
      return;
    }

    if (!getPrivateMediaReference(src)) {
      setImage({ source: src, url: src, error: false });
      return;
    }

    setImage({ source: src, url: null, error: false });

    loadPrivateImage(src, currentObjectUrlKey)
      .then(url => {
        objectUrl = url;
        if (active) setImage({ source: src, url, error: false });
        else revokeManagedObjectUrl(currentObjectUrlKey);
      })
      .catch(error => {
        if (import.meta.env.DEV) console.warn('Avatar is unavailable:', error);
        if (active) setImage({ source: src, url: null, error: true });
      });

    return () => {
      active = false;
      if (objectUrl) revokeManagedObjectUrl(currentObjectUrlKey);
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
