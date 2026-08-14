import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useChat } from '../context/ChatContext';
import './ChatArea.css';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  X,
  ArrowDown,
  Play,
  Pause,
  Lock,
  Trash2,
  WifiOff,
  CornerUpLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useE2EE } from '../context/E2EEContext';
import {
  importPublicKey,
  deriveSymmetricKey,
  encryptFileForE2EE,
  requireE2EEKey
} from '../utils/e2eeHelper';
import { CHAT_MEDIA_ACCEPT, validateChatMedia } from '../utils/mediaValidation';
import { requiresPersonalE2EE } from '../utils/savedMessages';
import ChatHeader from './chat/ChatHeader';
import MessageBubble from './chat/MessageBubble';
import ImageViewer from './chat/ImageViewer';
import MediaPickerPanel from './chat/MediaPickerPanel';
import { createStorageReference } from '../utils/urlSecurity';
import useResolvedMedia from '../hooks/useResolvedMedia';

export default function ChatArea() {
  const {
    activeChat,
    getChatStatus,
    sendMessage,
    deleteMessage,
    toggleReaction,
    isInfoOpen,
    setIsInfoOpen,
    setIsPulseOpen,
    typingStatuses,
    sendTypingStatus,
    wallpaper,
    renderAvatar,
    installedStickers,
    setActiveChatId,
    isOnline,
    retrySendMessage,
    deleteFailedMessage,
    loadOlderMessages,
    messagePagination,
    setIsSettingsOpen,
    setSettingsTab
  } = useChat();

  const { currentUser } = useAuth();
  const { sharedKeysCache, setSharedKeysCache, e2eePrivateKey } = useE2EE();

  const isOwner = activeChat && currentUser && (
    activeChat.createdBy === currentUser.id ||
    activeChat.createdBy === 'current'
  );

  const canPost = !activeChat?.requiresUpdate && (!activeChat ||
    activeChat.type === 'personal' ||
    isOwner ||
    (activeChat.type === 'group' && !activeChat.settings?.only_admins_can_post));

  const canSendMedia = !activeChat ||
    activeChat.type === 'personal' ||
    isOwner ||
    activeChat.settings?.allow_media !== false;

  const otherMember = activeChat?.type === 'personal'
    ? activeChat.members?.find(m => m.id !== currentUser?.id)
    : null;
  const requiresE2EE = requiresPersonalE2EE(activeChat);
  const recipientMissingE2EE = requiresE2EE && (!otherMember || !otherMember.hasE2ee);

  const resolveSharedKeyForUpload = async () => {
    if (!requiresE2EE) return null;

    let sharedKey = sharedKeysCache[activeChat.id];
    if (!sharedKey && e2eePrivateKey && otherMember?.publicKey) {
      try {
        const publicKey = await importPublicKey(otherMember.publicKey);
        sharedKey = await deriveSymmetricKey(e2eePrivateKey, publicKey);
        setSharedKeysCache(previous => ({ ...previous, [activeChat.id]: sharedKey }));
      } catch (cause) {
        throw new Error('Не удалось подготовить ключ шифрования. Файл не был загружен.', { cause });
      }
    }

    return requireE2EEKey(sharedKey);
  };

  const isCustomWallpaper = wallpaper && !['classic', 'sunset', 'space', 'mint', 'cyber'].includes(wallpaper);
  const { url: resolvedWallpaper } = useResolvedMedia(
    isCustomWallpaper ? wallpaper : null,
    activeChat?.id,
    'image/webp'
  );
  const chatBodyStyle = isCustomWallpaper ? {
    backgroundImage: resolvedWallpaper ? `url(${resolvedWallpaper})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } : {};

  const [inputVal, setInputVal] = useState('');
  const [retryMenuMsgId, setRetryMenuMsgId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMsgActionsId, setShowMsgActionsId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [openedImageUrl, setOpenedImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false);
  const isCurrentlyTypingRef = useRef(isCurrentlyTyping);
  const isRecordingRef = useRef(false);
  const sendTypingStatusRef = useRef(sendTypingStatus);
  const stopRecordingAndSendRef = useRef(null);
  isCurrentlyTypingRef.current = isCurrentlyTyping;
  sendTypingStatusRef.current = sendTypingStatus;

  const [recordMode, setRecordMode] = useState('voice'); // 'voice' or 'video'
  const [isRecording, setIsRecording] = useState(false);
  isRecordingRef.current = isRecording;
  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const isLoadingOlderRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const textareaRef = useRef(null);
  const emojiRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const holdTimeoutRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordStartX = useRef(0);
  const recordStartY = useRef(0);
  const isCancelledRef = useRef(false);
  const isLockedRef = useRef(false);
  const isPausedRef = useRef(false);
  const [isLockActive, setIsLockActive] = useState(false);
  const isLockActiveRef = useRef(false);
  const videoPreviewRef = useRef(null);

  const emojis = ['😀', '😂', '😍', '👍', '🔥', '🎉', '👏', '❤️', '🤔', '👀', '✨', '🚀', '💯', '😎'];

  const uploadFileDirectly = async (file, mediaInfo = validateChatMedia(file)) => {
    setUploading(true);
    const messageId = crypto.randomUUID();
    const mediaType = mediaInfo.kind;
    const msgText = mediaType === 'audio'
      ? 'Голосовое сообщение'
      : mediaType === 'video' ? '🎬 [Видео]' : 'Изображение';

    try {
      if (isSupabaseConfigured) {
        if (!navigator.onLine) {
          sendMessage(msgText, replyingTo?.id, null, file, mediaType, messageId);
          setReplyingTo(null);
          return;
        }

        const fileName = `msg_${messageId}.${mediaInfo.extension}`;
        const filePath = `${activeChat.id}/${currentUser.id}/${fileName}`;
        const blobToUpload = requiresE2EE
          ? await encryptFileForE2EE(file, await resolveSharedKeyForUpload())
          : file;

        const { error } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, blobToUpload, {
            contentType: requiresE2EE ? 'application/octet-stream' : mediaInfo.mimeType
          });

        if (error) throw error;
        sendMessage(
          msgText,
          replyingTo?.id,
          createStorageReference('chat-attachments', filePath),
          null,
          null,
          messageId
        );
      } else {
        const reader = new FileReader();
        reader.onload = (event) => sendMessage(msgText, replyingTo?.id, event.target.result, null, null, messageId);
        reader.readAsDataURL(file);
      }
      setReplyingTo(null);
    } catch (err) {
      console.error('Upload error:', err);
      const isNetworkError = !navigator.onLine || err.message?.includes('FetchError') || err.message?.includes('failed to fetch');
      if (isNetworkError) {
        sendMessage(msgText, replyingTo?.id, null, file, mediaType, messageId);
        setReplyingTo(null);
      } else {
        alert('Ошибка при загрузке: ' + err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await uploadFileDirectly(file, validateChatMedia(file));
    } catch (error) {
      alert(error.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (!item.type.startsWith('image/') && !item.type.startsWith('audio/') && !item.type.startsWith('video/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      e.preventDefault();
      try {
        await uploadFileDirectly(file, validateChatMedia(file));
      } catch (error) {
        alert(error.message);
      }
      break;
    }
  };

function formatDateDivider(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Сегодня';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }
  const isThisYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: isThisYear ? undefined : 'numeric'
  });
}

  // Auto-scroll to bottom on chat switch or new message
  const scrollToBottom = (behavior = 'smooth') => {
    if (chatBodyRef.current) {
      if (behavior === 'auto') {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior });
      }
    }
  };

  const isInitialChatLoadRef = useRef(true);
  const currentChatIdRef = useRef(activeChat?.id);

  useLayoutEffect(() => {
    if (currentChatIdRef.current !== activeChat?.id) {
      currentChatIdRef.current = activeChat?.id;
      isInitialChatLoadRef.current = true;
      shouldAutoScrollRef.current = true;
    }
    if (isInitialChatLoadRef.current && chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [activeChat?.id, activeChat?.messages]);

  useEffect(() => {
    scrollToBottom('auto');
    shouldAutoScrollRef.current = true;
    setReplyingTo(null);
    setOpenedImageUrl(null);
    setInputVal('');

    if (isCurrentlyTypingRef.current) {
      setIsCurrentlyTyping(false);
      sendTypingStatusRef.current(activeChat?.id, false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isRecordingRef.current) {
      stopRecordingAndSendRef.current?.(true);
    }
  }, [activeChat?.id]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isRecording) return;

    const handlePointerMove = (e) => {
      // If already committed to lock state, gestures no longer apply
      if (isLockedRef.current) return;

      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX === undefined || clientY === undefined) return;

      const diffX = recordStartX.current - clientX;
      const diffY = recordStartY.current - clientY;

      // 1. Swipe left to cancel (only if not sliding up to lock)
      if (diffX > 100 && diffY < 40 && !isCancelledRef.current) {
        isCancelledRef.current = true;
        stopRecordingAndSend(true);
      }

      // 2. Slide up to lock / back down to cancel lock
      if (diffY > 80) {
        if (!isLockActiveRef.current) {
          isLockActiveRef.current = true;
          setIsLockActive(true);
        }
      } else if (diffY < 30) {
        if (isLockActiveRef.current) {
          isLockActiveRef.current = false;
          setIsLockActive(false);
        }
      }
    };

    const handleGlobalPointerUp = () => {
      if (isLockActiveRef.current) {
        isLockedRef.current = true;
        setIsRecordingLocked(true);
        return;
      }
      if (isLockedRef.current) return;
      stopRecordingAndSend(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('touchend', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('touchend', handleGlobalPointerUp);
    };
  }, [isRecording]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startRecording = async () => {
    try {
      const constraints = recordMode === 'voice'
        ? { audio: true, video: false }
        : { audio: true, video: { width: { ideal: 320 }, height: { ideal: 320 }, facingMode: 'user' } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (recordMode === 'video') {
        setTimeout(() => {
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.play().catch(e => console.error("Preview play failed", e));
          }
        }, 50);
      }

      const chunks = [];
      mediaChunksRef.current = chunks;

      const options = { mimeType: recordMode === 'video' ? 'video/webm;codecs=vp9,opus' : 'audio/webm' };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        try {
          recorder = new MediaRecorder(stream, { mimeType: recordMode === 'video' ? 'video/webm' : 'audio/ogg' });
        } catch {
          recorder = new MediaRecorder(stream);
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        cleanupRecordingState();

        if (isCancelledRef.current) {
          console.log("Recording cancelled, discarding chunks.");
          return;
        }

        const blob = new Blob(chunks, { type: recordMode === 'video' ? 'video/webm' : 'audio/webm' });
        if (blob.size < 1000) {
          console.log("Blob too small, discarding.");
          return;
        }

        await uploadAndSendRecord(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);

      setIsRecording(true);
      setRecordDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Не удалось получить доступ к микрофону/камере: " + err.message);
      cleanupRecordingState();
    }
  };

  const stopRecordingAndSend = (isCancel = false) => {
    if (isCancel) {
      isCancelledRef.current = true;
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        cleanupRecordingState();
      }
    } catch (e) {
      console.error("Error stopping media recorder:", e);
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(track => track.stop());
        } catch (e2) {
          console.error("Error stopping tracks in fallback:", e2);
        }
      }
      cleanupRecordingState();
    }
  };

  stopRecordingAndSendRef.current = stopRecordingAndSend;

  const pauseRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
    } catch (e) {
      console.error("Failed to pause media recorder:", e);
    }

    setIsRecordingPaused(true);
    isPausedRef.current = true;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recordMode === 'video' && videoPreviewRef.current) {
      try {
        videoPreviewRef.current.pause();
      } catch (e) {
        console.error("Preview pause failed", e);
      }
    }
  };

  const resumeRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
    } catch (e) {
      console.error("Failed to resume media recorder:", e);
    }

    setIsRecordingPaused(false);
    isPausedRef.current = false;

    if (!recordingTimerRef.current) {
      recordingTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    }

    if (recordMode === 'video' && videoPreviewRef.current) {
      videoPreviewRef.current.play().catch(e => console.error("Preview resume play failed", e));
    }
  };

  const cleanupRecordingState = () => {
    setIsRecording(false);
    setIsRecordingLocked(false);
    setIsRecordingPaused(false);
    isLockedRef.current = false;
    isPausedRef.current = false;
    setIsLockActive(false);
    isLockActiveRef.current = false;
    setRecordDuration(0);
    if (videoPreviewRef.current) {
      try {
        videoPreviewRef.current.srcObject = null;
      } catch (e) {
        console.error("Failed to clean up video preview:", e);
      }
    }
  };

  const uploadAndSendRecord = async (blob) => {
    setUploading(true);
    try {
      const MAX_SIZE = 15 * 1024 * 1024;
      if (blob.size > MAX_SIZE) {
        alert("Запись слишком длинная и превышает лимит 15 МБ.");
        return;
      }

      const isVoice = recordMode === 'voice';
      const mediaType = isVoice ? 'audio' : 'video';
      const msgText = isVoice ? 'Голосовое сообщение' : 'Видеосообщение';

      if (isSupabaseConfigured) {
        if (!navigator.onLine) {
          sendMessage(msgText, replyingTo?.id, null, blob, mediaType);
          setReplyingTo(null);
          return;
        }

        const fileExt = 'webm';
        const fileName = `record_${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${activeChat.id}/${currentUser.id}/${fileName}`;

        // E2EE chats must never fall back to uploading plaintext.
        const blobToUpload = requiresE2EE
          ? await encryptFileForE2EE(blob, await resolveSharedKeyForUpload())
          : blob;

        const { error } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, blobToUpload, {
            contentType: blobToUpload.type || (isVoice ? 'audio/webm' : 'video/webm')
          });

        if (error) throw error;

        sendMessage(
          msgText,
          replyingTo?.id,
          createStorageReference('chat-attachments', filePath)
        );
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          sendMessage(msgText, replyingTo?.id, event.target.result);
        };
        reader.readAsDataURL(blob);
      }
      setReplyingTo(null);
    } catch (err) {
      console.error("Upload recording error:", err);
      const isNetworkError = !navigator.onLine || err.message?.includes('FetchError') || err.message?.includes('failed to fetch');
      if (isNetworkError) {
        const isVoice = recordMode === 'voice';
        const mediaType = isVoice ? 'audio' : 'video';
        const msgText = isVoice ? 'Голосовое сообщение' : 'Видеосообщение';
        sendMessage(msgText, replyingTo?.id, null, blob, mediaType);
        setReplyingTo(null);
      } else {
        alert("Ошибка при сохранении сообщения: " + err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    recordStartX.current = clientX;
    recordStartY.current = clientY;
    isCancelledRef.current = false;
    isLockedRef.current = false;
    isPausedRef.current = false;
    setIsRecordingLocked(false);
    setIsRecordingPaused(false);
    setIsLockActive(false);
    isLockActiveRef.current = false;

    holdTimeoutRef.current = setTimeout(() => {
      holdTimeoutRef.current = null;
      startRecording();
    }, 250);
  };

  const handlePointerUp = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
      setRecordMode(prev => prev === 'voice' ? 'video' : 'voice');
    } else if (isRecording) {
      if (isLockActiveRef.current) {
        isLockedRef.current = true;
        setIsRecordingLocked(true);
        return;
      }
      if (isLockedRef.current) return;
      stopRecordingAndSend(false);
    }
  };

  const latestMessage = activeChat?.messages?.[activeChat.messages.length - 1];
  const latestMessageId = latestMessage?.id;
  const latestMessageSenderId = latestMessage?.senderId;
  const messageCount = activeChat?.messages?.length || 0;
  useEffect(() => {
    const isOwnMessage = latestMessageSenderId === currentUser?.id || latestMessageSenderId === 'current';
    if (!isLoadingOlderRef.current) {
      if (isInitialChatLoadRef.current) {
        scrollToBottom('auto');
      } else if (shouldAutoScrollRef.current || isOwnMessage) {
        scrollToBottom('smooth');
      }
    }
  }, [activeChat?.id, latestMessageId, latestMessageSenderId, messageCount, currentUser?.id]);

  // Monitor scroll, virtualize off-screen rows, and page backwards near the top.
  const handleScroll = async () => {
    const element = chatBodyRef.current;
    if (!element) return;
    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 120;
    if (distanceFromBottom > 120) {
      isInitialChatLoadRef.current = false;
    }
    setShowScrollBottom(distanceFromBottom > 300);

    const page = messagePagination?.[activeChat?.id];
    if (scrollTop > 80 || page?.hasMore === false || isLoadingOlderRef.current) return;

    isLoadingOlderRef.current = true;
    const previousHeight = scrollHeight;
    const previousTop = scrollTop;
    try {
      const loaded = await loadOlderMessages(activeChat.id);
      if (loaded > 0) {
        requestAnimationFrame(() => {
          if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = previousTop + chatBodyRef.current.scrollHeight - previousHeight;
          }
        });
      }
    } finally {
      isLoadingOlderRef.current = false;
    }
  };

  useEffect(() => {
    if (!openedImageUrl) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpenedImageUrl(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openedImageUrl]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      // Reaction drawer is portaled to document.body — include it so emoji clicks
      // and the open smile control are not treated as "outside".
      if (
        !e.target.closest('.message-hover-actions') &&
        !e.target.closest('.reaction-drawer')
      ) {
        setShowMsgActionsId(null);
      }
      if (!e.target.closest('.failed-message-menu') && !e.target.closest('.seen-check.failed')) {
        setRetryMenuMsgId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Touch Gestures for Swipe Back on Mobile
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchMoveRef = useRef({ x: 0, y: 0 });
  const isSwipeGestureRef = useRef(false);
  const mainRef = useRef(null);

  const handleTouchStart = (e) => {
    if (window.innerWidth >= 768 || e.touches.length !== 1) return;
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    if (startX > window.innerWidth * 0.25) {
      touchStartRef.current = { x: 0, y: 0 };
      return;
    }
    touchStartRef.current = { x: startX, y: startY };
    touchMoveRef.current = { x: startX, y: startY };
    isSwipeGestureRef.current = false;
    if (mainRef.current) {
      mainRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e) => {
    if (window.innerWidth >= 768 || e.touches.length !== 1 || touchStartRef.current.x === 0) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;
    touchMoveRef.current = { x: currentX, y: currentY };
    if (!isSwipeGestureRef.current) {
      if (deltaX > 15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        isSwipeGestureRef.current = true;
      } else if (Math.abs(deltaY) > 15 || deltaX < -15) {
        touchStartRef.current = { x: 0, y: 0 };
      }
    }
    if (isSwipeGestureRef.current && deltaX > 0) {
      e.preventDefault();
      if (mainRef.current) {
        mainRef.current.style.transform = `translate3d(${deltaX}px, 0, 0)`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (window.innerWidth >= 768 || !isSwipeGestureRef.current || touchStartRef.current.x === 0) {
      isSwipeGestureRef.current = false;
      touchStartRef.current = { x: 0, y: 0 };
      return;
    }
    const deltaX = touchMoveRef.current.x - touchStartRef.current.x;
    const threshold = window.innerWidth * 0.25;
    if (mainRef.current) {
      mainRef.current.style.transition = 'transform 0.24s cubic-bezier(0.1, 0.76, 0.55, 0.94)';
    }
    if (deltaX > threshold) {
      if (mainRef.current) {
        mainRef.current.style.transform = 'translate3d(100%, 0, 0)';
      }
      setTimeout(() => {
        setActiveChatId(null);
        if (mainRef.current) {
          mainRef.current.style.transform = '';
          mainRef.current.style.transition = '';
        }
      }, 240);
    } else {
      if (mainRef.current) {
        mainRef.current.style.transform = '';
      }
      setTimeout(() => {
        if (mainRef.current) {
          mainRef.current.style.transition = '';
        }
      }, 240);
    }
    isSwipeGestureRef.current = false;
    touchStartRef.current = { x: 0, y: 0 };
  };

  if (!activeChat) {
    return (
      <main className="chat-area empty">
        <div className="empty-state">
          <div className="empty-state-logo">💬</div>
          <h3>Выберите чат, чтобы начать общение</h3>
          <p>Или откройте историю в списке чатов</p>
        </div>
      </main>
    );
  }

  const handleSend = () => {
    if (!inputVal.trim()) return;
    sendMessage(inputVal, replyingTo?.id);
    setInputVal('');
    setReplyingTo(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsCurrentlyTyping(false);
    sendTypingStatus(activeChat.id, false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  const handleInputChange = (e) => {
    setInputVal(e.target.value);

    if (!isCurrentlyTyping) {
      setIsCurrentlyTyping(true);
      sendTypingStatus(activeChat.id, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsCurrentlyTyping(false);
      sendTypingStatus(activeChat.id, false);
    }, 3000);
  };

  const handleEmojiClick = (emoji) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? inputVal.length;
      const end = textarea.selectionEnd ?? inputVal.length;
      const nextVal = inputVal.substring(0, start) + emoji + inputVal.substring(end);
      setInputVal(nextVal);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setInputVal(prev => prev + emoji);
    }
  };

  const typingUsersInChat = typingStatuses[activeChat.id] ? Object.values(typingStatuses[activeChat.id]) : [];
  const isTypingText = typingUsersInChat.length > 0
    ? `${typingUsersInChat.join(', ')} ${typingUsersInChat.length > 1 ? 'печатают' : 'печатает'}...`
    : null;

  return (
    <main 
      className="chat-area"
      ref={mainRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <ChatHeader
        activeChat={activeChat}
        renderAvatar={renderAvatar}
        getChatStatus={getChatStatus}
        isTypingText={isTypingText}
        isInfoOpen={isInfoOpen}
        setIsInfoOpen={setIsInfoOpen}
        setIsPulseOpen={setIsPulseOpen}
        setActiveChatId={setActiveChatId}
      />
      {!isOnline && (
        <div className="offline-banner" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <WifiOff size={14} className="offline-banner-icon" />
          <span>Соединение потеряно. Переподключение...</span>
        </div>
      )}

      {/* Messages Window */}
      <div
        className="chat-body"
        ref={chatBodyRef}
        onScroll={handleScroll}
        style={chatBodyStyle}
      >
        <div className="messages-list">
          {activeChat.messages.map((msg, index) => {
            const prevMsg = activeChat.messages[index - 1];
            const showDateDivider = !prevMsg || (
              new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString()
            );
            const dateDividerText = showDateDivider ? formatDateDivider(msg.timestamp) : null;
            return (
              <React.Fragment key={msg.id}>
                {dateDividerText && (
                  <div className="chat-date-divider">
                    <span>{dateDividerText}</span>
                  </div>
                )}
                <MessageBubble
                  msg={msg}
                  index={index}
                  activeChat={activeChat}
                  currentUser={currentUser}
                  renderAvatar={renderAvatar}
                  showMsgActionsId={showMsgActionsId}
                  setShowMsgActionsId={setShowMsgActionsId}
                  retryMenuMsgId={retryMenuMsgId}
                  setRetryMenuMsgId={setRetryMenuMsgId}
                  setReplyingTo={setReplyingTo}
                  setOpenedImageUrl={setOpenedImageUrl}
                  deleteMessage={deleteMessage}
                  toggleReaction={toggleReaction}
                  retrySendMessage={retrySendMessage}
                  deleteFailedMessage={deleteFailedMessage}
                  emojis={emojis}
                />
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating scroll to bottom button */}
      {showScrollBottom && (
        <button
          className="scroll-bottom-btn"
          onClick={() => {
            shouldAutoScrollRef.current = true;
            scrollToBottom('smooth');
          }}
        >
          <ArrowDown size={18} />
        </button>
      )}

      {openedImageUrl && (
        <ImageViewer imageUrl={openedImageUrl} onClose={() => setOpenedImageUrl(null)} />
      )}

      {/* Input Area */}
      {!canPost ? (
        <footer className="chat-footer-input restricted" style={{ padding: '8px 16px' }}>
          <div className="restricted-input-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', color: 'var(--text-secondary)', fontSize: '13px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
            <span>{activeChat?.requiresUpdate
              ? 'Для этого чата требуется версия Coiny с поддержкой E2EE v2. Отправка заблокирована.'
              : activeChat?.type === 'channel'
                ? 'Только администраторы могут отправлять сообщения в этот канал'
                : 'Только администраторы могут отправлять сообщения в эту группу'}</span>
          </div>
        </footer>
      ) : (
        <footer className="chat-footer-input">
        {recipientMissingE2EE && (
          <div className="e2ee-waiting-banner">
            <Lock size={14} className="e2ee-banner-icon" />
            <span>Ожидание настройки ключей шифрования собеседником...</span>
          </div>
        )}

        {/* Reply Bar Overlay */}
        {replyingTo && (
          <div className="reply-indicator-bar">
            <CornerUpLeft size={16} className="reply-bar-icon" />
            <div className="reply-bar-meta">
              <span className="reply-bar-title">Ответ пользователю {replyingTo.senderName}</span>
              <p className="reply-bar-desc">{replyingTo.text}</p>
            </div>
            <button className="reply-bar-close" onClick={() => setReplyingTo(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        <div className="input-row">
          {isRecording ? (
            <div className={`recording-panel ${isRecordingLocked ? 'locked' : ''}`}>
              <div className={`record-dot ${isRecordingPaused ? 'paused' : ''}`} />
              {isRecordingLocked && (
                <div className="record-locked-badge">
                  <Lock size={13} />
                </div>
              )}
              <span className="record-timer">{formatDuration(recordDuration)}</span>
              
              {!isRecordingLocked ? (
                <>
                  <div className="record-wave">
                    <span className="record-wave-bar" />
                    <span className="record-wave-bar" />
                    <span className="record-wave-bar" />
                    <span className="record-wave-bar" />
                    <span className="record-wave-bar" />
                  </div>
                  <span className="record-cancel-hint">← Проведите влево для отмены</span>
                </>
              ) : (
                <div className="record-locked-controls">
                  <button 
                    type="button" 
                    className="record-control-btn btn-trash" 
                    onClick={() => stopRecordingAndSend(true)}
                    title="Удалить запись"
                  >
                    <Trash2 size={18} />
                  </button>
                  
                  <button 
                    type="button" 
                    className="record-control-btn btn-pause-resume" 
                    onClick={isRecordingPaused ? resumeRecording : pauseRecording}
                    title={isRecordingPaused ? "Продолжить запись" : "Приостановить запись"}
                  >
                    {isRecordingPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
                  </button>
                  
                  <button 
                    type="button" 
                    className="record-control-btn btn-send" 
                    onClick={() => stopRecordingAndSend(false)}
                    title="Отправить"
                  >
                    <Send size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Attachment button */}
              {canSendMedia && !recipientMissingE2EE && (
                <div className="attach-wrapper">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept={CHAT_MEDIA_ACCEPT}
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                  <button
                    type="button"
                    className="input-action-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Прикрепить изображение или файл"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <div className="spinner" style={{ width: '18px', height: '18px', borderColor: 'var(--text-secondary)', borderTopColor: 'var(--accent-color)' }} />
                    ) : (
                      <Paperclip size={22} />
                    )}
                  </button>
                </div>
              )}

              {/* Text Area */}
              <div className="input-textarea-wrapper">
                <textarea
                  ref={textareaRef}
                  placeholder={recipientMissingE2EE ? "Шифрование недоступно..." : "Напишите сообщение..."}
                  value={inputVal}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  onPaste={handlePaste}
                  rows={1}
                  disabled={recipientMissingE2EE}
                />

                {/* Emoji / Sticker / GIF picker */}
                <div className="emoji-wrapper" ref={emojiRef} onMouseDown={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`input-action-btn emoji-trigger ${showEmojiPicker ? 'active' : ''}`}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Смайлы, стикеры и GIF"
                  >
                    <Smile size={22} />
                  </button>

                  <MediaPickerPanel
                    isOpen={showEmojiPicker}
                    onClose={() => setShowEmojiPicker(false)}
                    onSelectEmoji={handleEmojiClick}
                    onSelectSticker={(stickerTag, fileUrl) => {
                      sendMessage(stickerTag, replyingTo?.id, fileUrl);
                      setReplyingTo(null);
                    }}
                    onSelectGif={(gifUrl) => {
                      sendMessage('', replyingTo?.id, gifUrl);
                      setReplyingTo(null);
                    }}
                    installedStickers={installedStickers}
                    onOpenStickerSettings={() => {
                      setIsSettingsOpen(true);
                      setSettingsTab('stickers');
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Send Action */}
          {inputVal.trim() && !recipientMissingE2EE ? (
            <button
              className="send-message-btn"
              onClick={handleSend}
              title="Отправить"
            >
              <Send size={20} />
            </button>
          ) : canSendMedia && !recipientMissingE2EE ? (
            <div style={{ position: 'relative' }}>
              {isRecording && !isRecordingLocked && (
                <div className={`recording-lock-indicator ${isLockActive ? 'active' : ''}`}>
                  <div className="lock-arrow-up">▲</div>
                  <div className="lock-icon-wrapper">
                    <Lock size={15} />
                  </div>
                </div>
              )}
              <button
                className={`send-message-btn ${isRecording ? 'recording' : ''}`}
                onMouseDown={handlePointerDown}
                onMouseUp={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchEnd={handlePointerUp}
                title={recordMode === 'voice' ? 'Голосовое сообщение' : 'Видеосообщение'}
                style={{
                  backgroundColor: isRecording ? '#f64f59' : undefined,
                  color: isRecording ? 'white' : undefined,
                  transform: isRecording ? 'scale(1.2)' : undefined,
                  transition: 'all 0.2s ease-in-out',
                  touchAction: 'none'
                }}
              >
                {recordMode === 'voice' ? <Mic size={20} /> : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <button
              className="send-message-btn"
              disabled
              title={recipientMissingE2EE ? "Ожидание настройки собеседником" : "Отправка медиа ограничена"}
              style={{ opacity: 0.4, cursor: 'not-allowed' }}
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </footer>
      )}

      {/* Video Recording Live Preview Overlay */}
      {isRecording && recordMode === 'video' && (
        <div className={`video-record-preview-overlay ${isRecordingPaused ? 'paused' : ''}`}>
          <div className="video-record-circle">
            <video ref={videoPreviewRef} muted playsInline autoPlay />
            {isRecordingPaused && (
              <div className="video-paused-overlay">
                <Pause size={32} />
              </div>
            )}
          </div>
          <div className="video-record-timer">
            {formatDuration(recordDuration)}
          </div>
          <div className="video-record-hint">
            {isRecordingPaused ? (
              <>Запись приостановлена<br />Нажмите кнопку воспроизведения внизу для продолжения</>
            ) : isRecordingLocked ? (
              <>Запись заблокирована<br />Используйте кнопки управления внизу для паузы или отправки</>
            ) : (
              <>Запись круглого видеосообщения<br />Отпустите кнопку для отправки, проведите влево для отмены, проведите вверх для блокировки</>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
