import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useE2EE } from './E2EEContext';
import { supabase } from '../supabaseClient';
import { dataService } from '../services/dataLayer';
import { importPublicKey, deriveSymmetricKey, encryptMessage, decryptMessage, encryptFile, decryptFile } from '../utils/e2eeHelper';
import { getOfflineAttachment, deleteOfflineAttachment, saveOfflineAttachment } from '../utils/indexedDbHelper';
import { Users, Megaphone, Bookmark, User, Bot, CloudSun, Brain, Zap } from 'lucide-react';

const ChatContext = createContext();

let globalAudioCtx = null;
const playSound = (type = 'incoming') => {
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume();
    }
    const osc = globalAudioCtx.createOscillator();
    const gain = globalAudioCtx.createGain();
    
    if (type === 'incoming') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, globalAudioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(783.99, globalAudioCtx.currentTime + 0.07); // G5
      gain.gain.setValueAtTime(0, globalAudioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, globalAudioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, globalAudioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(globalAudioCtx.destination);
      osc.start();
      osc.stop(globalAudioCtx.currentTime + 0.25);
    } else { // outgoing
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, globalAudioCtx.currentTime); // E5
      gain.gain.setValueAtTime(0, globalAudioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, globalAudioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, globalAudioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(globalAudioCtx.destination);
      osc.start();
      osc.stop(globalAudioCtx.currentTime + 0.15);
    }
  } catch (e) {
    console.warn("AudioContext play failed", e);
  }
};

const initialStories = [];

const defaultMockPacks = [
  {
    id: 'pack-animals',
    name: 'AnimalsMock',
    title: 'Cute Animals 🦊',
    is_animated: false,
    is_video: false,
    stickers: [
      { id: 'st-cat', emoji: '🐱', filePath: 'https://img.icons8.com/color/180/cat.png' },
      { id: 'st-dog', emoji: '🐶', filePath: 'https://img.icons8.com/color/180/dog.png' },
      { id: 'st-rabbit', emoji: '🐰', filePath: 'https://img.icons8.com/color/180/rabbit.png' },
      { id: 'st-fox', emoji: '🦊', filePath: 'https://img.icons8.com/color/180/fox.png' },
      { id: 'st-panda', emoji: '🐼', filePath: 'https://img.icons8.com/color/180/panda.png' },
      { id: 'st-lion', emoji: '🦁', filePath: 'https://img.icons8.com/color/180/lion.png' },
      { id: 'st-koala', emoji: '🐨', filePath: 'https://img.icons8.com/color/180/koala-bear.png' }
    ]
  },
  {
    id: 'pack-animated',
    name: 'AnimatedMock',
    title: 'Animations ✨',
    is_animated: true,
    is_video: false,
    stickers: [
      { id: 'st-anim1', emoji: '🎉', filePath: 'https://assets5.lottiefiles.com/packages/lf20_u4yrau.json' },
      { id: 'st-anim2', emoji: '❤️', filePath: 'https://assets9.lottiefiles.com/packages/lf20_yg16kv9p.json' },
      { id: 'st-anim3', emoji: '🚀', filePath: 'https://assets1.lottiefiles.com/packages/lf20_yjrdpceb.json' }
    ]
  },
  {
    id: 'pack-video',
    name: 'VideoMock',
    title: 'Video Loops 🎬',
    is_animated: false,
    is_video: true,
    stickers: [
      { id: 'st-vid1', emoji: '🐱', filePath: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHY5b3h5a3VjMWoxeXU3dWthdjV2bnhmdzJjZTh1MGFhMG51N2x0ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/33OrjzUFwkwEg/giphy.webm' },
      { id: 'st-vid2', emoji: '🍔', filePath: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnp4NWN6YW44bnR0YmExMnBpeThmOWthNXh6d3p2azVxdG1qbjI3ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7bu3XilJ5BOiSGic/giphy.webm' }
    ]
  }
];

export const formatLastSeen = (lastSeenStr, isOnline) => {
  if (isOnline) return 'в сети';
  if (!lastSeenStr) return 'был(а) недавно';
  try {
    const date = new Date(lastSeenStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'был(а) в сети только что';
    if (diffMins < 60) {
      const lastDigit = diffMins % 10;
      const lastTwoDigits = diffMins % 100;
      let minWord = 'минут';
      if (lastDigit === 1 && lastTwoDigits !== 11) {
        minWord = 'минуту';
      } else if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
        minWord = 'минуты';
      }
      return `был(а) в сети ${diffMins} ${minWord} назад`;
    }

    const formatTime = (d) => {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    };

    const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
    if (isToday) return `был(а) в сети сегодня в ${formatTime(date)}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
                        date.getMonth() === yesterday.getMonth() &&
                        date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return `был(а) в сети вчера в ${formatTime(date)}`;

    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) {
      const days = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
      const dayOfWeek = days[date.getDay()];
      const prep = dayOfWeek === 'вторник' ? 'во' : 'в';
      return `был(а) в сети ${prep} ${dayOfWeek} в ${formatTime(date)}`;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `был(а) в сети ${day}.${month}.${year} в ${formatTime(date)}`;
  } catch (e) {
    return 'был(а) недавно';
  }
};

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { e2eePrivateKey, sharedKeysCache, setSharedKeysCache } = useE2EE();

  const [chats, setChats] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [installedStickers, setInstalledStickers] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const activeChat = chats.find(c => c.id === activeChatId);
  const [stories, setStories] = useState(initialStories);
  const [activeStoryId, setActiveStoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('coingram-dark-mode') !== 'false';
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tg-offline-queue') || '[]');
    } catch {
      return [];
    }
  });

  const [typingStatuses, setTypingStatuses] = useState({});
  const typingChannelRef = useRef(null);
  const typingTimeoutsRef = useRef({});
  
  const [theme, setTheme] = useState('telegram-blue');
  const [wallpaper, setWallpaper] = useState('classic');

  // Refs for realtime channels to prevent rebuild loops on key updates
  const sharedKeysCacheRef = useRef(sharedKeysCache);
  const e2eePrivateKeyRef = useRef(e2eePrivateKey);
  const activeChatIdRef = useRef(activeChatId);

  useEffect(() => { sharedKeysCacheRef.current = sharedKeysCache; }, [sharedKeysCache]);
  useEffect(() => { e2eePrivateKeyRef.current = e2eePrivateKey; }, [e2eePrivateKey]);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save offlineQueue changes to localStorage
  useEffect(() => {
    localStorage.setItem('tg-offline-queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  // Sync theme + dark mode classes
  useEffect(() => {
    if (isDarkMode || theme === 'rainbow-pearl') {
      document.documentElement.classList.remove('theme-light');
    } else {
      document.documentElement.classList.add('theme-light');
    }
    localStorage.setItem('coingram-dark-mode', isDarkMode ? 'true' : 'false');

    let classes = document.documentElement.className.split(' ').filter(c => c === 'theme-light');
    if (theme === 'rainbow-pearl') classes = [];
    classes.push(`theme-${theme}`);
    document.documentElement.className = classes.join(' ').trim();
  }, [theme, isDarkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-wallpaper', wallpaper);
  }, [wallpaper]);

  const markMessageAsFailed = useCallback((chatId, optimisticId) => {
    setChats(prevChats => prevChats.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: c.messages.map(m => m.id === optimisticId ? { ...m, isFailed: true, isPending: false } : m)
        };
      }
      return c;
    }));
    setOfflineQueue(prev => prev.map(q => q.optimisticId === optimisticId ? { ...q, isFailed: true, isPending: false } : q));
  }, []);

  // Sync offline queue messages when returning online
  const syncOfflineMessages = useCallback(async () => {
    if (!dataService.isLive() || offlineQueue.length === 0) return;
    const queueToProcess = offlineQueue.filter(q => !q.isFailed);
    if (queueToProcess.length === 0) return;
    
    for (const item of queueToProcess) {
      try {
        let finalMediaUrl = item.media;

        if (item.hasOfflineMedia) {
          const blob = await getOfflineAttachment(item.optimisticId);
          if (!blob) throw new Error("Файл вложения не найден в локальном хранилище.");

          const fileExt = item.mediaType === 'audio' ? 'webm' : (item.mediaType === 'video' ? 'webm' : 'png');
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `${item.senderId}/${fileName}`;

          // Encrypt file blob before upload if in E2EE chat
          const chat = chats.find(c => c.id === item.chatId);
          let blobToUpload = blob;
          let sharedKey = sharedKeysCacheRef.current[item.chatId];
          
          if (chat && chat.type === 'personal') {
            if (sharedKey) {
              blobToUpload = await encryptFile(blob, sharedKey);
            }
          }

          const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, blobToUpload, {
              contentType: blobToUpload.type || (item.mediaType === 'audio' ? 'audio/webm' : (item.mediaType === 'video' ? 'video/webm' : 'image/png'))
            });

          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
          finalMediaUrl = publicUrl;
          await deleteOfflineAttachment(item.optimisticId);
        }

        const chat = chats.find(c => c.id === item.chatId);
        let textToSend = item.text;
        let mediaToSend = finalMediaUrl;

        if (chat && chat.type === 'personal') {
          const otherMember = chat.members?.find(m => m.id !== currentUser.id);
          let sharedKey = sharedKeysCacheRef.current[chat.id];
          if (!sharedKey && e2eePrivateKeyRef.current && otherMember?.publicKey) {
            try {
              const otherPublicKeyObj = await importPublicKey(otherMember.publicKey);
              sharedKey = await deriveSymmetricKey(e2eePrivateKeyRef.current, otherPublicKeyObj);
              setSharedKeysCache(prev => ({ ...prev, [chat.id]: sharedKey }));
            } catch (err) {
              console.error("Failed to derive key in sync:", err);
            }
          }
          if (sharedKey) {
            if (item.text) {
              const encryptedText = await encryptMessage(item.text, sharedKey);
              textToSend = `e2ee:aes-gcm:${encryptedText.ciphertext}:${encryptedText.iv}`;
            }
            if (finalMediaUrl) {
              const encryptedMedia = await encryptMessage(finalMediaUrl, sharedKey);
              mediaToSend = `e2ee:aes-gcm:${encryptedMedia.ciphertext}:${encryptedMedia.iv}`;
            }
          }
        }

        // Send message using generated client-side message ID (already generated)
        const data = await dataService.sendMessage(item.chatId, item.senderId, textToSend, item.replyToId, mediaToSend, item.optimisticId);

        if (data) {
          setChats(prevChats => prevChats.map(c => {
            if (c.id === item.chatId) {
              return {
                ...c,
                messages: c.messages.map(m => {
                  if (m.id === item.optimisticId) {
                    return {
                      ...m,
                      id: data.id,
                      media: finalMediaUrl,
                      isPending: false,
                      isOptimistic: false
                    };
                  }
                  return m;
                })
              };
            }
            return c;
          }));

          setOfflineQueue(prev => prev.filter(q => q.queueId !== item.queueId));
        }
      } catch (err) {
        console.error("Failed to sync offline message:", err);
        const isNetworkError = !navigator.onLine || err.message?.includes('FetchError') || err.message?.includes('failed to fetch');
        if (isNetworkError) {
          setIsOnline(false);
          break;
        } else {
          markMessageAsFailed(item.chatId, item.optimisticId);
        }
      }
    }
  }, [offlineQueue, chats, currentUser, markMessageAsFailed, setSharedKeysCache]);

  const retrySendMessage = useCallback(async (optimisticId) => {
    const item = offlineQueue.find(q => q.optimisticId === optimisticId);
    if (!item) return;

    setChats(prevChats => prevChats.map(c => {
      if (c.id === item.chatId) {
        return {
          ...c,
          messages: c.messages.map(m => m.id === optimisticId ? { ...m, isFailed: false, isPending: true } : m)
        };
      }
      return c;
    }));

    setOfflineQueue(prev => prev.map(q => q.optimisticId === optimisticId ? { ...q, isFailed: false, isPending: true } : q));

    if (navigator.onLine) {
      setIsOnline(true);
      setTimeout(() => { syncOfflineMessages(); }, 50);
    }
  }, [offlineQueue, syncOfflineMessages]);

  const deleteFailedMessage = useCallback(async (optimisticId) => {
    const item = offlineQueue.find(q => q.optimisticId === optimisticId);
    if (!item) return;

    setChats(prevChats => prevChats.map(c => {
      if (c.id === item.chatId) {
        return { ...c, messages: c.messages.filter(m => m.id !== optimisticId) };
      }
      return c;
    }));

    setOfflineQueue(prev => prev.filter(q => q.optimisticId !== optimisticId));
    try {
      await deleteOfflineAttachment(optimisticId);
    } catch (e) {
      console.error(e);
    }
  }, [offlineQueue]);

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      syncOfflineMessages();
    }
  }, [isOnline, offlineQueue.length, syncOfflineMessages]);

  const [settingsTab, setSettingsTab] = useState('profile');
  const [newChatModalTab, setNewChatModalTab] = useState('personal');

  const fetchChats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await dataService.fetchChats(currentUser.id);
      
      // Decrypt the preview messages
      const formattedChats = await Promise.all(data.map(async (chat) => {
        const otherMember = chat.type === 'personal'
          ? chat.members.find(m => m.id !== currentUser.id)
          : null;

        let sharedKey = null;
        if (chat.type === 'personal' && otherMember && e2eePrivateKeyRef.current) {
          sharedKey = sharedKeysCacheRef.current[chat.id];
          if (!sharedKey && otherMember.publicKey) {
            try {
              const otherPublicKeyObj = await importPublicKey(otherMember.publicKey);
              sharedKey = await deriveSymmetricKey(e2eePrivateKeyRef.current, otherPublicKeyObj);
              setSharedKeysCache(prev => ({ ...prev, [chat.id]: sharedKey }));
            } catch (err) {
              console.error("Failed to derive key preview:", err);
            }
          }
        }

        const messages = await Promise.all(chat.messages.map(async (m) => {
          let decryptedText = m.text;
          let decryptedMedia = m.media;
          let isDecrypted = true;

          if (chat.type === 'personal') {
            if (m.text && m.text.startsWith('e2ee:aes-gcm:')) {
              if (sharedKey) {
                try {
                  const parts = m.text.replace('e2ee:aes-gcm:', '').split(':');
                  decryptedText = await decryptMessage(parts[0], parts[1], sharedKey);
                } catch (e) {
                  decryptedText = 'Зашифрованное сообщение';
                  isDecrypted = false;
                }
              } else {
                decryptedText = 'Зашифрованное сообщение';
                isDecrypted = false;
              }
            }
            if (m.media && m.media.startsWith('e2ee:aes-gcm:')) {
              if (sharedKey && isDecrypted) {
                try {
                  const parts = m.media.replace('e2ee:aes-gcm:', '').split(':');
                  decryptedMedia = await decryptMessage(parts[0], parts[1], sharedKey);
                } catch (e) {
                  decryptedMedia = null;
                }
              } else {
                decryptedMedia = null;
              }
            }
          }

          return { ...m, text: decryptedText, media: decryptedMedia, isLocked: !isDecrypted };
        }));

        return { ...chat, messages };
      }));

      // Overlay optimistic queued messages
      let localQueue = [];
      try {
        localQueue = JSON.parse(localStorage.getItem('tg-offline-queue') || '[]');
      } catch {}

      for (const q of localQueue) {
        if (q.hasOfflineMedia && q.optimisticId) {
          try {
            const blob = await getOfflineAttachment(q.optimisticId);
            if (blob) q.media = URL.createObjectURL(blob);
          } catch (e) {
            console.error(e);
          }
        }
      }

      const updatedChats = formattedChats.map(c => {
        const pendingMsgs = localQueue
          .filter(q => q.chatId === c.id)
          .map(q => ({
            id: q.optimisticId,
            senderId: currentUser.id,
            senderName: currentUser.name || 'Вы',
            text: q.text,
            media: q.media,
            replyTo: q.replyToId,
            read: false,
            timestamp: new Date(),
            isPending: !q.isFailed,
            isFailed: !!q.isFailed,
            isOptimistic: true
          }));

        return pendingMsgs.length > 0 ? { ...c, messages: [...c.messages, ...pendingMsgs] } : c;
      });

      setChats(updatedChats);
    } catch (e) {
      console.error("Failed to load chats", e);
    }
  }, [currentUser, setSharedKeysCache]);

  const loadActiveChatMessages = useCallback(async (chatId) => {
    if (!chatId || !currentUser) return;
    try {
      const msgs = await dataService.loadChatMessages(chatId, 30);
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return;

      let sharedKey = null;
      if (chat.type === 'personal') {
        sharedKey = sharedKeysCacheRef.current[chatId];
        if (!sharedKey && e2eePrivateKeyRef.current) {
          const otherMember = chat.members?.find(m => m.id !== currentUser.id);
          if (otherMember?.publicKey) {
            try {
              const otherPublicKeyObj = await importPublicKey(otherMember.publicKey);
              sharedKey = await deriveSymmetricKey(e2eePrivateKeyRef.current, otherPublicKeyObj);
              setSharedKeysCache(prev => ({ ...prev, [chatId]: sharedKey }));
            } catch (err) {
              console.error(err);
            }
          }
        }
      }

      const decryptedMsgs = await Promise.all(msgs.map(async (m) => {
        let decryptedText = m.text;
        let decryptedMedia = m.media;
        let isDecrypted = true;

        if (chat.type === 'personal') {
          if (m.text && m.text.startsWith('e2ee:aes-gcm:')) {
            if (sharedKey) {
              try {
                const parts = m.text.replace('e2ee:aes-gcm:', '').split(':');
                decryptedText = await decryptMessage(parts[0], parts[1], sharedKey);
              } catch (e) {
                decryptedText = 'Зашифрованное сообщение';
                isDecrypted = false;
              }
            } else {
              decryptedText = 'Зашифрованное сообщение';
              isDecrypted = false;
            }
          }
          if (m.media && m.media.startsWith('e2ee:aes-gcm:')) {
            if (sharedKey && isDecrypted) {
              try {
                const parts = m.media.replace('e2ee:aes-gcm:', '').split(':');
                decryptedMedia = await decryptMessage(parts[0], parts[1], sharedKey);
              } catch (e) {
                decryptedMedia = null;
              }
            } else {
              decryptedMedia = null;
            }
          }
        }

        return { ...m, text: decryptedText, media: decryptedMedia, isLocked: !isDecrypted };
      }));

      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: decryptedMsgs } : c));
    } catch (e) {
      console.error(e);
    }
  }, [currentUser, chats, setSharedKeysCache]);

  // Load chat messages when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      loadActiveChatMessages(activeChatId);
    }
  }, [activeChatId]);

  const fetchStickers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const packs = await dataService.fetchStickers(currentUser.id);
      if (packs) {
        setInstalledStickers(packs.filter(Boolean));
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const importStickerPack = useCallback(async (packName) => {
    if (!currentUser) return { error: "Вы не авторизованы!" };
    try {
      if (dataService.isLive()) {
        const data = await dataService.importStickerPack(currentUser.id, packName);
        await fetchStickers();
        return { success: true, title: data.title };
      } else {
        const normalized = packName.toLowerCase().trim();
        let matchedDefault = defaultMockPacks.find(p => p.name.toLowerCase() === normalized);
        if (!matchedDefault) {
          matchedDefault = {
            id: `pack-${Date.now()}`,
            name: packName,
            title: `${packName} Pack 🌟`,
            is_animated: false,
            is_video: false,
            stickers: [
              { id: `st-c1-${Date.now()}`, emoji: '⭐', filePath: 'https://img.icons8.com/color/180/star--v1.png' },
              { id: `st-c2-${Date.now()}`, emoji: '✨', filePath: 'https://img.icons8.com/color/180/sparkling-light-.png' },
              { id: `st-c3-${Date.now()}`, emoji: '🔥', filePath: 'https://img.icons8.com/color/180/fire.png' }
            ]
          };
        }
        setInstalledStickers(prev => {
          if (prev.some(p => p.name.toLowerCase() === normalized)) return prev;
          const updated = [...prev, matchedDefault];
          localStorage.setItem('tg-stickers-mock', JSON.stringify(updated));
          return updated;
        });
        return { success: true, title: matchedDefault.title };
      }
    } catch (e) {
      return { error: e.message };
    }
  }, [currentUser, fetchStickers]);

  useEffect(() => {
    if (currentUser) {
      if (dataService.isLive()) {
        fetchStickers();
      } else {
        const saved = localStorage.getItem('tg-stickers-mock');
        if (saved) {
          try {
            setInstalledStickers(JSON.parse(saved));
          } catch (e) {
            setInstalledStickers(defaultMockPacks);
          }
        } else {
          setInstalledStickers(defaultMockPacks);
          localStorage.setItem('tg-stickers-mock', JSON.stringify(defaultMockPacks));
        }
      }
    } else {
      setInstalledStickers([]);
    }
  }, [currentUser, fetchStickers]);

  const fetchStories = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await dataService.fetchStories();
      const viewedKey = `tg-viewed-stories-${currentUser.id}`;
      let viewedSaved = [];
      try {
        const stored = localStorage.getItem(viewedKey);
        if (stored) viewedSaved = JSON.parse(stored);
      } catch {}

      const formatted = (data || []).map(s => ({
        id: s.id,
        userId: s.user_id,
        userName: s.profiles?.display_name || s.profiles?.username || 'Пользователь',
        userAvatar: s.profiles?.avatar || '🪙',
        media: s.media,
        caption: s.caption,
        viewed: viewedSaved.includes(s.id),
        timestamp: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setStories(formatted);
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const publishStory = useCallback(async (media, caption) => {
    if (!currentUser) return null;
    try {
      const data = await dataService.publishStory(currentUser.id, media, caption);
      await fetchStories();
      return data;
    } catch (e) {
      console.error(e);
      alert(e.message);
      return null;
    }
  }, [currentUser, fetchStories]);

  const markMessagesAsRead = useCallback(async (chatId) => {
    if (!currentUser || !chatId) return;
    try {
      await dataService.markMessagesAsRead(chatId, currentUser.id);
      
      // Update local state purely
      setChats(prevChats => prevChats.map(c => {
        if (c.id === chatId) {
          const updatedMessages = c.messages.map(m => {
            if (m.senderId !== currentUser.id && !m.read) {
              return { ...m, read: true };
            }
            return m;
          });
          return { ...c, messages: updatedMessages };
        }
        return c;
      }));
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const getChatStatus = useCallback((chat) => {
    if (!chat) return '';
    if (chat.type === 'personal') {
      const other = chat.members?.find(m => m.id !== currentUser?.id);
      if (!other) return '';
      const isOnline = onlineUsers.has(other.id);
      return formatLastSeen(other.lastSeen, isOnline);
    }
    if (chat.type === 'group') {
      const total = chat.members?.length || 0;
      const onlineCount = chat.members?.filter(m => m.id !== currentUser?.id && onlineUsers.has(m.id)).length || 0;
      const finalOnline = onlineCount + (currentUser ? 1 : 0);
      const getPluralMembers = (n) => {
        const lastDigit = n % 10;
        const lastTwoDigits = n % 100;
        if (lastDigit === 1 && lastTwoDigits !== 11) return 'участник';
        if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'участника';
        return 'участников';
      };
      return `${total} ${getPluralMembers(total)}, ${finalOnline} в сети`;
    }
    if (chat.type === 'channel') {
      const total = chat.members?.length || 0;
      const getPluralSubscribers = (n) => {
        const lastDigit = n % 10;
        const lastTwoDigits = n % 100;
        if (lastDigit === 1 && lastTwoDigits !== 11) return 'подписчик';
        if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'подписчика';
        return 'подписчиков';
      };
      return `${total} ${getPluralSubscribers(total)}`;
    }
    return '';
  }, [currentUser, onlineUsers]);

  // Periodically update current user presence status
  useEffect(() => {
    if (!dataService.isLive() || !currentUser) return;
    const updateLastSeen = async () => {
      try {
        await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
      } catch (e) {
        console.warn("Failed to update last_seen:", e);
      }
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000);

    const handleUnload = () => {
      const tokenKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
      let token = '';
      if (tokenKey) {
        try { token = JSON.parse(localStorage.getItem(tokenKey))?.access_token || ''; } catch {}
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;
      const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${currentUser.id}`;
      navigator.sendBeacon(url, JSON.stringify({ last_seen: new Date().toISOString() }));
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      updateLastSeen();
    };
  }, [currentUser]);

  // Real-time listener effect
  useEffect(() => {
    if (dataService.isLive()) {
      if (currentUser) {
        fetchChats();
        fetchStories();

        const msgChannel = supabase
          .channel('db-messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
            const newMsg = payload.new;
            
            // Side effects out of state updates (avoids strict mode double alerts)
            const isMe = newMsg.sender_id === currentUser.id;
            if (!isMe) {
              playSound('incoming');
              if (newMsg.chat_id === activeChatIdRef.current) {
                markMessagesAsRead(newMsg.chat_id);
              }
            }

            let decryptedText = newMsg.text;
            let decryptedMedia = newMsg.media;
            let isDecrypted = true;

            if (newMsg.text?.startsWith('e2ee:aes-gcm:') || newMsg.media?.startsWith('e2ee:aes-gcm:')) {
              let sharedKey = sharedKeysCacheRef.current[newMsg.chat_id];
              if (!sharedKey && e2eePrivateKeyRef.current) {
                try {
                  const { data: membersRaw } = await supabase
                    .from('chat_members')
                    .select('profile_id, profiles(public_key, has_e2ee)')
                    .eq('chat_id', newMsg.chat_id);
                  
                  const otherMember = membersRaw?.find(m => m.profile_id !== currentUser.id);
                  if (otherMember?.profiles?.public_key) {
                    const otherPublicKeyObj = await importPublicKey(otherMember.profiles.public_key);
                    sharedKey = await deriveSymmetricKey(e2eePrivateKeyRef.current, otherPublicKeyObj);
                    setSharedKeysCache(prev => ({ ...prev, [newMsg.chat_id]: sharedKey }));
                  }
                } catch (err) {
                  console.error(err);
                }
              }

              if (sharedKey) {
                if (newMsg.text?.startsWith('e2ee:aes-gcm:')) {
                  try {
                    const parts = newMsg.text.replace('e2ee:aes-gcm:', '').split(':');
                    decryptedText = await decryptMessage(parts[0], parts[1], sharedKey);
                  } catch (e) {
                    decryptedText = 'Зашифрованное сообщение';
                    isDecrypted = false;
                  }
                }
                if (newMsg.media?.startsWith('e2ee:aes-gcm:') && isDecrypted) {
                  try {
                    const parts = newMsg.media.replace('e2ee:aes-gcm:', '').split(':');
                    decryptedMedia = await decryptMessage(parts[0], parts[1], sharedKey);
                  } catch (e) {
                    decryptedMedia = null;
                  }
                }
              } else {
                decryptedText = 'Зашифрованное сообщение';
                isDecrypted = false;
                decryptedMedia = null;
              }
            }

            setChats(prevChats => {
              const chat = prevChats.find(c => c.id === newMsg.chat_id);
              if (!chat) return prevChats;
              if (chat.messages.some(m => m.id === newMsg.id)) return prevChats;

              const senderName = chat.members.find(m => m.id === newMsg.sender_id)?.name || 'Пользователь';

              const formattedMsg = {
                id: newMsg.id,
                senderId: newMsg.sender_id,
                senderName,
                text: decryptedText,
                media: decryptedMedia,
                replyTo: newMsg.reply_to,
                read: newMsg.read,
                reactions: newMsg.reactions || [],
                timestamp: new Date(newMsg.created_at),
                isLocked: !isDecrypted
              };

              // Replace optimistic message exact ID check
              let replacedOptimistic = false;
              const nextMessages = chat.messages.map(m => {
                if (isMe && m.isOptimistic && m.id === newMsg.id) {
                  replacedOptimistic = true;
                  return formattedMsg;
                }
                return m;
              });

              return prevChats.map(c => {
                if (c.id === newMsg.chat_id) {
                  return {
                    ...c,
                    messages: replacedOptimistic ? nextMessages : [...c.messages, formattedMsg]
                  };
                }
                return c;
              });
            });
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
            const deletedMsgId = payload.old.id;
            setChats(prevChats => prevChats.map(c => ({
              ...c,
              messages: c.messages.filter(m => m.id !== deletedMsgId)
            })));
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
            const updatedMsg = payload.new;
            setChats(prevChats => prevChats.map(c => {
              if (c.id === updatedMsg.chat_id) {
                return {
                  ...c,
                  messages: c.messages.map(m => m.id === updatedMsg.id ? {
                    ...m,
                    read: updatedMsg.read,
                    reactions: updatedMsg.reactions || []
                  } : m)
                };
              }
              return c;
            }));
          })
          .subscribe();

        const memberChannel = supabase
          .channel('db-members')
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_members', 
            filter: `profile_id=eq.${currentUser.id}` 
          }, () => {
            fetchChats();
          })
          .subscribe();

        const presenceChannel = supabase.channel('online-users');
        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const onlineIds = Object.keys(state);
            
            setOnlineUsers(prevOnline => {
              const nextOnline = new Set(onlineIds);
              const wentOffline = [...prevOnline].filter(id => !nextOnline.has(id));
              
              if (wentOffline.length > 0) {
                setChats(prevChats => prevChats.map(chat => {
                  if (chat.type === 'personal') {
                    const other = chat.members?.find(m => m.id !== currentUser.id);
                    if (other && wentOffline.includes(other.id)) {
                      const updatedMembers = chat.members.map(m => 
                        m.id === other.id ? { ...m, lastSeen: new Date().toISOString() } : m
                      );
                      return {
                        ...chat,
                        members: updatedMembers,
                        lastSeen: new Date().toISOString()
                      };
                    }
                  }
                  return chat;
                }));
              }
              return nextOnline;
            });
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({
                id: currentUser.id,
                online_at: new Date().toISOString()
              });
            }
          });

        const typingChannel = supabase.channel('typing-status');
        typingChannelRef.current = typingChannel;
        typingChannel
          .on('broadcast', { event: 'typing' }, (payload) => {
            const { userId, chatId, isTyping, userName } = payload.payload;
            if (typingTimeoutsRef.current[userId]) {
              clearTimeout(typingTimeoutsRef.current[userId]);
              delete typingTimeoutsRef.current[userId];
            }
            if (isTyping) {
              setTypingStatuses(prev => {
                const chatStatuses = { ...prev[chatId], [userId]: userName };
                return { ...prev, [chatId]: chatStatuses };
              });
              typingTimeoutsRef.current[userId] = setTimeout(() => {
                setTypingStatuses(prev => {
                  const chatStatuses = { ...prev[chatId] };
                  delete chatStatuses[userId];
                  return { ...prev, [chatId]: chatStatuses };
                });
                delete typingTimeoutsRef.current[userId];
              }, 6000);
            } else {
              setTypingStatuses(prev => {
                const chatStatuses = { ...prev[chatId] };
                delete chatStatuses[userId];
                return { ...prev, [chatId]: chatStatuses };
              });
            }
          })
          .subscribe();

        const storiesChannel = supabase
          .channel('db-stories')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
            fetchStories();
          })
          .subscribe();

        return () => {
          msgChannel.unsubscribe();
          memberChannel.unsubscribe();
          presenceChannel.unsubscribe();
          typingChannel.unsubscribe();
          storiesChannel.unsubscribe();
          typingChannelRef.current = null;
        };
      }
    } else {
      // Mock mode
      if (currentUser) {
        const saved = localStorage.getItem('tg-chats-mock');
        if (saved) {
          try {
            const parsed = JSON.parse(saved).map(chat => ({
              ...chat,
              messages: chat.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
            }));
            setChats(parsed);
          } catch (e) {
            setChats([]);
          }
        }
      }
    }
  }, [currentUser, fetchChats, markMessagesAsRead]);

  // Save Mock Chats state to localStorage
  useEffect(() => {
    if (!dataService.isLive() && currentUser && chats.length > 0) {
      localStorage.setItem('tg-chats-mock', JSON.stringify(chats));
    }
  }, [chats, currentUser]);

  const createChat = useCallback(async (target, type = 'personal', initialMembers = []) => {
    if (!currentUser) return null;
    try {
      const newChat = await dataService.createChat(currentUser.id, target, type, initialMembers);
      if (newChat) {
        if (!dataService.isLive()) {
          setChats(prev => [newChat, ...prev]);
        } else {
          await fetchChats();
        }
        setActiveChatId(newChat.id);
        return newChat;
      }
      return null;
    } catch (e) {
      alert(e.message);
      return null;
    }
  }, [currentUser, fetchChats]);

  const deleteChat = useCallback(async (chatId) => {
    if (!currentUser || !chatId) return false;
    const chatToDelete = chats.find(c => c.id === chatId);
    if (!chatToDelete) return false;
    try {
      await dataService.deleteChat(currentUser.id, chatId, chatToDelete.type, chatToDelete.createdBy);
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
      return true;
    } catch (e) {
      console.error(e);
      alert("Не удалось удалить чат: " + e.message);
      return false;
    }
  }, [currentUser, chats, activeChatId]);

  const clearChatMessages = useCallback(async (chatId) => {
    try {
      await dataService.clearChatMessages(chatId);
      setChats(prevChats => prevChats.map(c => c.id === chatId ? { ...c, messages: [] } : c));
      return true;
    } catch (e) {
      console.error(e);
      alert("Не удалось очистить историю: " + e.message);
      return false;
    }
  }, []);

  const sendMessage = useCallback(async (text, replyToId = null, media = null, offlineMediaBlob = null, offlineMediaType = null) => {
    if (!text.trim() && !media && !offlineMediaBlob) return;
    if (!currentUser || !activeChatId) return;

    // Generate exact UUID on client for perfect optimistic matching
    const messageId = crypto.randomUUID();

    const optimisticMsg = {
      id: messageId,
      senderId: currentUser.id,
      senderName: currentUser.name || 'Вы',
      text: text,
      media: media,
      replyTo: replyToId,
      read: false,
      timestamp: new Date(),
      isOptimistic: true,
      isPending: !navigator.onLine
    };

    let hasOfflineMedia = false;
    let tempMediaUrl = media;

    if (offlineMediaBlob) {
      try {
        await saveOfflineAttachment(messageId, offlineMediaBlob);
        tempMediaUrl = URL.createObjectURL(offlineMediaBlob);
        optimisticMsg.media = tempMediaUrl;
        hasOfflineMedia = true;
        optimisticMsg.isPending = true;
      } catch (e) {
        console.error("Offline media cache failed:", e);
      }
    }

    setChats(prevChats => prevChats.map(c => {
      if (c.id === activeChatId) {
        return { ...c, messages: [...c.messages, optimisticMsg] };
      }
      return c;
    }));

    playSound('outgoing');

    if (!navigator.onLine || hasOfflineMedia) {
      const offlineItem = {
        queueId: `queue-${Date.now()}`,
        chatId: activeChatId,
        senderId: currentUser.id,
        text: text,
        replyToId: replyToId,
        media: tempMediaUrl,
        optimisticId: messageId,
        hasOfflineMedia,
        mediaType: offlineMediaType,
        isPending: true,
        isFailed: false
      };
      setOfflineQueue(prev => [...prev, offlineItem]);
      return;
    }

    // Send asynchronously in background
    (async () => {
      try {
        let textToSend = text;
        let mediaToSend = media;

        if (activeChat?.type === 'personal') {
          const otherMember = activeChat.members?.find(m => m.id !== currentUser.id);
          let sharedKey = sharedKeysCacheRef.current[activeChatId];
          if (!sharedKey && e2eePrivateKeyRef.current && otherMember?.publicKey) {
            try {
              const otherPublicKeyObj = await importPublicKey(otherMember.publicKey);
              sharedKey = await deriveSymmetricKey(e2eePrivateKeyRef.current, otherPublicKeyObj);
              setSharedKeysCache(prev => ({ ...prev, [activeChatId]: sharedKey }));
            } catch (err) {
              console.error(err);
            }
          }
          if (sharedKey) {
            if (text) {
              const encryptedText = await encryptMessage(text, sharedKey);
              textToSend = `e2ee:aes-gcm:${encryptedText.ciphertext}:${encryptedText.iv}`;
            }
            if (media) {
              const encryptedMedia = await encryptMessage(media, sharedKey);
              mediaToSend = `e2ee:aes-gcm:${encryptedMedia.ciphertext}:${encryptedMedia.iv}`;
            }
          }
        }

        await dataService.sendMessage(activeChatId, currentUser.id, textToSend, replyToId, mediaToSend, messageId);
      } catch (error) {
        console.error("Send failed:", error);
        const isNetwork = !navigator.onLine || error.message?.includes('FetchError') || error.message?.includes('failed to fetch');
        if (isNetwork) {
          setChats(prevChats => prevChats.map(c => {
            if (c.id === activeChatId) {
              return {
                ...c,
                messages: c.messages.map(m => m.id === messageId ? { ...m, isPending: true } : m)
              };
            }
            return c;
          }));

          const offlineItem = {
            queueId: `queue-${Date.now()}`,
            chatId: activeChatId,
            senderId: currentUser.id,
            text: text,
            replyToId: replyToId,
            media: media,
            optimisticId: messageId,
            hasOfflineMedia: false,
            isPending: true,
            isFailed: false
          };
          setOfflineQueue(prev => [...prev, offlineItem]);
        } else {
          setChats(prevChats => prevChats.map(c => {
            if (c.id === activeChatId) {
              return { ...c, messages: c.messages.filter(m => m.id !== messageId) };
            }
            return c;
          }));
          alert("Не удалось отправить сообщение: " + error.message);
        }
      }
    })();
  }, [activeChatId, currentUser, activeChat, setSharedKeysCache]);

  const deleteMessage = useCallback(async (chatId, messageId) => {
    try {
      await dataService.deleteMessage(messageId);
      setChats(prevChats => prevChats.map(c => {
        if (c.id === chatId) {
          return { ...c, messages: c.messages.filter(m => m.id !== messageId) };
        }
        return c;
      }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleReaction = useCallback(async (chatId, messageId, emoji) => {
    let newReactions = [];
    setChats(prevChats => {
      return prevChats.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: c.messages.map(m => {
              if (m.id === messageId) {
                const reactions = m.reactions ? JSON.parse(JSON.stringify(m.reactions)) : [];
                const exist = reactions.find(r => r.emoji === emoji);
                const userKey = currentUser ? currentUser.id : 'current';
                if (exist) {
                  if (exist.users.includes(userKey)) {
                    exist.users = exist.users.filter(u => u !== userKey);
                    exist.count -= 1;
                  } else {
                    exist.users.push(userKey);
                    exist.count += 1;
                  }
                } else {
                  reactions.push({ emoji, count: 1, users: [userKey] });
                }
                newReactions = reactions.filter(r => r.count > 0);
                return { ...m, reactions: newReactions };
              }
              return m;
            })
          };
        }
        return c;
      });
    });

    try {
      await dataService.toggleReaction(messageId, newReactions);
    } catch (err) {
      console.error(err);
    }
  }, [currentUser]);

  const sendTypingStatus = useCallback((chatId, isTyping) => {
    if (!currentUser) return;
    if (dataService.isLive() && typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: currentUser.id,
          chatId,
          isTyping,
          userName: currentUser.name || currentUser.username
        }
      });
    }
  }, [currentUser]);

  const updateChatAvatar = useCallback(async (chatId, base64Avatar) => {
    if (!currentUser || !chatId) return;
    try {
      await dataService.updateChatAvatar(chatId, base64Avatar);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, avatar: base64Avatar } : c));
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }, [currentUser]);

  const updateChatSettings = useCallback(async (chatId, newSettings) => {
    if (!currentUser || !chatId) return false;
    try {
      await dataService.updateChatSettings(chatId, newSettings);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, settings: newSettings } : c));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [currentUser]);

  const toggleMemberRole = useCallback(async (chatId, profileId, currentRole) => {
    if (!currentUser || !chatId || !profileId) return false;
    const targetRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await dataService.toggleMemberRole(chatId, profileId, targetRole);
      setChats(prev => prev.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            members: c.members.map(m => m.id === profileId ? { ...m, role: targetRole } : m)
          };
        }
        return c;
      }));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [currentUser]);

  const addMemberToChat = useCallback(async (chatId, username) => {
    if (!currentUser || !chatId || !username.trim()) return { error: 'Неверные данные' };
    try {
      const newMember = await dataService.addMemberToChat(chatId, username);
      setChats(prev => prev.map(c => {
        if (c.id === chatId) {
          if (c.members.some(m => m.id === newMember.id)) return c;
          return { ...c, members: [...c.members, newMember] };
        }
        return c;
      }));
      return { success: true, profile: newMember };
    } catch (e) {
      return { error: e.message };
    }
  }, [currentUser]);

  // Load chat messages on active chat switch
  const activeChatMessagesLength = activeChat?.messages?.length || 0;
  useEffect(() => {
    if (activeChatId) {
      markMessagesAsRead(activeChatId);
    }
  }, [activeChatId, activeChatMessagesLength, markMessagesAsRead]);

  // Premium avatar helper
  const renderAvatar = useCallback((avatar, fallback = '👤') => {
    const isUrl = avatar && (avatar.startsWith('http') || avatar.startsWith('data:image'));
    if (isUrl) {
      return (
        <img 
          src={avatar} 
          alt="avatar" 
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} 
        />
      );
    }

    const val = avatar || fallback;
    let bg = '';
    let icon = null;

    if (val === '👥' || val === 'group' || val === 'Group') {
      bg = 'linear-gradient(135deg, #3498db, #2980b9)';
      icon = <Users className="premium-avatar-icon" />;
    } else if (val === '📢' || val === 'channel' || val === 'Channel') {
      bg = 'linear-gradient(135deg, #b534fa, #e056fd)';
      icon = <Megaphone className="premium-avatar-icon" />;
    } else if (val === '🔖' || val === 'saved' || val === 'Saved Messages') {
      bg = 'linear-gradient(135deg, #34d399, #059669)';
      icon = <Bookmark className="premium-avatar-icon" fill="currentColor" />;
    } else if (val === '👤' || val === 'user') {
      bg = 'linear-gradient(135deg, #74b9ff, #0984e3)';
      icon = <User className="premium-avatar-icon" />;
    } else if (val === '🪙') {
      bg = 'linear-gradient(135deg, #f6d365, #fda085)';
      icon = <User className="premium-avatar-icon" />;
    } else if (val === '🤖' || val === 'bot') {
      bg = 'linear-gradient(135deg, #ff7675, #d63031)';
      icon = <Bot className="premium-avatar-icon" />;
    } else if (val === '🌤️' || val === 'weather') {
      bg = 'linear-gradient(135deg, #fdeb82, #f39c12)';
      icon = <CloudSun className="premium-avatar-icon" />;
    } else if (val === '🧠' || val === 'quiz') {
      bg = 'linear-gradient(135deg, #ff9ff3, #f368e0)';
      icon = <Brain className="premium-avatar-icon" />;
    } else if (val === '🕵️') {
      bg = 'linear-gradient(135deg, #57606f, #2f3542)';
      icon = <User className="premium-avatar-icon" />;
    } else if (val === '⚡') {
      bg = 'linear-gradient(135deg, #ffeaa7, #fdcb6e)';
      icon = <Zap className="premium-avatar-icon" />;
    }

    if (icon) {
      return (
        <div className="premium-avatar-container" style={{ background: bg }}>
          {icon}
        </div>
      );
    }

    return (
      <div className="premium-avatar-container letter-avatar" style={{ background: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' }}>
        <span className="avatar-text">{val}</span>
      </div>
    );
  }, []);

  return (
    <ChatContext.Provider value={{
      getChatStatus,
      onlineUsers,
      currentUser,
      chats,
      activeChatId,
      setActiveChatId,
      activeChat,
      sendMessage,
      deleteMessage,
      toggleReaction,
      stories,
      activeStoryId,
      setActiveStoryId,
      viewStory: (storyId) => {
        if (currentUser) {
          const viewedKey = `tg-viewed-stories-${currentUser.id}`;
          try {
            const stored = localStorage.getItem(viewedKey);
            let viewedSaved = stored ? JSON.parse(stored) : [];
            if (!viewedSaved.includes(storyId)) {
              viewedSaved.push(storyId);
              localStorage.setItem(viewedKey, JSON.stringify(viewedSaved));
            }
          } catch {}
        }
        setStories(prev => prev.map(s => s.id === storyId ? { ...s, viewed: true } : s));
        setActiveStoryId(storyId);
      },
      publishStory,
      searchQuery,
      setSearchQuery,
      activeFolder,
      setActiveFolder,
      isSettingsOpen,
      setIsSettingsOpen,
      isInfoOpen,
      setIsInfoOpen,
      isNewChatOpen,
      setIsNewChatOpen,
      isCreateStoryOpen,
      setIsCreateStoryOpen,
      isDrawerOpen,
      setIsDrawerOpen,
      isDarkMode,
      setIsDarkMode,
      settingsTab,
      setSettingsTab,
      newChatModalTab,
      setNewChatModalTab,
      renderAvatar,
      theme,
      setTheme,
      wallpaper,
      setWallpaper,
      updateChatAvatar,
      updateChatSettings,
      typingStatuses,
      sendTypingStatus,
      markMessagesAsRead,
      deleteChat,
      clearChatMessages,
      installedStickers,
      importStickerPack,
      addMemberToChat,
      toggleMemberRole,
      isOnline,
      retrySendMessage,
      deleteFailedMessage,
      loadActiveChatMessages
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
