import { useEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { useE2EE } from '../context/E2EEContext';
import { supabase } from '../supabaseClient';
import { decryptFile } from '../utils/e2eeHelper';
import { getAttachmentMimeType, getPrivateMediaReference } from '../utils/storageMedia';
import { createManagedObjectUrl, revokeManagedObjectUrl } from '../utils/objectUrlRegistry';

export default function useResolvedMedia(mediaUrl, chatId, fallbackMimeType, reloadKey = 0) {
  const [media, setMedia] = useState({ source: null, url: null, loading: false, error: null });
  const objectUrlKey = useRef(`resolved-media:${crypto.randomUUID()}`);
  const { sharedKeysCache } = useE2EE();
  const { chats } = useChat();
  const chatType = chats.find(chat => chat.id === chatId)?.type;
  const sharedKey = chatType === 'personal' ? sharedKeysCache[chatId] : null;

  useEffect(() => {
    const currentObjectUrlKey = objectUrlKey.current;
    if (!mediaUrl) {
      setMedia({ source: mediaUrl, url: null, loading: false, error: null });
      return;
    }

    const storageReference = getPrivateMediaReference(mediaUrl);
    if (!storageReference || mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:')) {
      setMedia({ source: mediaUrl, url: mediaUrl, loading: false, error: null });
      return;
    }

    let active = true;
    let objectUrl = null;
    setMedia({ source: mediaUrl, url: null, loading: true, error: null });

    const load = async () => {
      try {
        const { data: downloadedBlob, error } = await supabase.storage
          .from(storageReference.bucket)
          .download(storageReference.path);
        if (error) throw error;

        let finalBlob = downloadedBlob;
        if (storageReference.bucket === 'chat-attachments' && downloadedBlob.type.split(';')[0] === 'application/octet-stream') {
          if (!sharedKey) throw new Error('Encryption key is unavailable for this attachment.');
          finalBlob = await decryptFile(
            downloadedBlob,
            sharedKey,
            getAttachmentMimeType(mediaUrl, fallbackMimeType)
          );
        }

        objectUrl = createManagedObjectUrl(currentObjectUrlKey, finalBlob);
        if (active) {
          setMedia({ source: mediaUrl, url: objectUrl, loading: false, error: null });
        } else {
          revokeManagedObjectUrl(currentObjectUrlKey);
          objectUrl = null;
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Media is unavailable:', error);
        if (active) setMedia({ source: mediaUrl, url: null, loading: false, error: 'Медиа недоступно' });
      }
    };

    load();
    return () => {
      active = false;
      if (objectUrl) revokeManagedObjectUrl(currentObjectUrlKey);
    };
  }, [mediaUrl, chatId, sharedKey, fallbackMimeType, reloadKey]);

  if (media.source !== mediaUrl) return { url: null, loading: Boolean(mediaUrl), error: null };
  return media;
}
