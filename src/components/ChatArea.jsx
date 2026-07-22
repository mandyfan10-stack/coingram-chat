import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import StickerMessage from './StickerMessage';
import './ChatArea.css';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  MoreVertical,
  CornerUpLeft,
  Trash2,
  X,
  ArrowDown,
  Play,
  Pause,
  Lock,
  Sparkles,
  Film,
  ArrowLeft,
  VolumeX,
  Volume2,
  AlertCircle,
  WifiOff
} from 'lucide-react';

const SingleCheck = ({ className }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const DoubleCheck = ({ className }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="3.5" fill="currentColor" />
  </svg>
);

const PendingClock = ({ className }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: '10px', height: '10px' }}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

function renderMessageTextWithLinks(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      let href = part;
      let display = part;
      
      const trailingPunctuation = /[.,!?;)]+$/;
      const match = part.match(trailingPunctuation);
      let trailing = "";
      if (match) {
        trailing = match[0];
        href = part.substring(0, part.length - trailing.length);
        display = href;
      }
      
      return (
        <React.Fragment key={i}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {display}
          </a>
          {trailing}
        </React.Fragment>
      );
    }
    return part;
  });
}

import { useAuth } from '../context/AuthContext';
import { useE2EE } from '../context/E2EEContext';
import { encryptFile, decryptFile } from '../utils/e2eeHelper';

function getAttachmentMimeType(mediaUrl, fallbackMimeType) {
  const extension = mediaUrl?.split('?')[0].split('.').pop()?.toLowerCase();
  const mimeTypes = {
    avif: 'image/avif',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    mp3: 'audio/mpeg',
    mp4: fallbackMimeType?.startsWith('audio/') ? 'audio/mp4' : 'video/mp4',
    ogg: fallbackMimeType?.startsWith('video/') ? 'video/ogg' : 'audio/ogg',
    png: 'image/png',
    wav: 'audio/wav',
    webm: fallbackMimeType || 'video/webm',
    webp: 'image/webp'
  };

  return mimeTypes[extension] || fallbackMimeType || 'application/octet-stream';
}

function useDecryptedAttachment(mediaUrl, chatId, fallbackMimeType) {
  const [attachment, setAttachment] = useState({
    mediaUrl: null,
    url: null,
    loading: false,
    error: null
  });
  const { sharedKeysCache } = useE2EE();
  const { chats } = useChat();
  const chatType = chats.find(chat => chat.id === chatId)?.type;
  const sharedKey = chatType === 'personal' ? sharedKeysCache[chatId] : null;

  useEffect(() => {
    if (!mediaUrl) {
      setAttachment({ mediaUrl, url: null, loading: false, error: null });
      return;
    }

    if (mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:')) {
      setAttachment({ mediaUrl, url: mediaUrl, loading: false, error: null });
      return;
    }

    let isMounted = true;
    let objectUrl = null;
    setAttachment({ mediaUrl, url: null, loading: true, error: null });

    const loadAttachment = async () => {
      try {
        const parts = mediaUrl.split('chat-attachments/');
        if (parts.length < 2) {
          if (isMounted) {
            setAttachment({ mediaUrl, url: mediaUrl, loading: false, error: null });
          }
          return;
        }

        const filePath = decodeURIComponent(parts[1].split('?')[0]);

        const { data: encryptedBlob, error } = await supabase.storage
          .from('chat-attachments')
          .download(filePath);

        if (error) throw error;

        let finalBlob = encryptedBlob;
        const isEncrypted = encryptedBlob.type.split(';')[0] === 'application/octet-stream';

        if (isEncrypted) {
          if (!sharedKey) {
            throw new Error('Encryption key is unavailable for this attachment.');
          }

          try {
            finalBlob = await decryptFile(
              encryptedBlob,
              sharedKey,
              getAttachmentMimeType(mediaUrl, fallbackMimeType)
            );
          } catch (decryptErr) {
            throw new Error('Unable to decrypt this attachment.', { cause: decryptErr });
          }
        }

        const localUrl = URL.createObjectURL(finalBlob);
        if (isMounted) {
          objectUrl = localUrl;
          setAttachment({ mediaUrl, url: localUrl, loading: false, error: null });
        } else {
          URL.revokeObjectURL(localUrl);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Attachment is unavailable:', err);
        if (isMounted) {
          setAttachment({
            mediaUrl,
            url: null,
            loading: false,
            error: 'Вложение недоступно'
          });
        }
      }
    };

    loadAttachment();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mediaUrl, chatId, sharedKey, fallbackMimeType]);

  if (attachment.mediaUrl !== mediaUrl) {
    return { url: null, loading: Boolean(mediaUrl), error: null };
  }

  return attachment;
}

function AttachmentUnavailable({ compact = false }) {
  return (
    <div className={'bubble-media-error' + (compact ? ' bubble-media-error-compact' : '')}>
      Вложение недоступно
    </div>
  );
}

function DecryptedImage({ mediaUrl, chatId }) {
  const { url, loading, error } = useDecryptedAttachment(mediaUrl, chatId, 'image/png');
  if (loading) {
    return (
      <div className="bubble-media-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
        <div className="spinner" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', width: '20px', height: '20px' }}></div>
      </div>
    );
  }
  if (error || !url) return <AttachmentUnavailable />;
  return <img src={url} alt="Изображение" className="bubble-media" />;
}

function DecryptedVideoPlayer({ mediaUrl, chatId }) {
  const { url, loading, error } = useDecryptedAttachment(mediaUrl, chatId, 'video/webm');
  if (loading) {
    return (
      <div className="bubble-media-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
        <div className="spinner" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', width: '20px', height: '20px' }}></div>
      </div>
    );
  }
  if (error || !url) return <AttachmentUnavailable />;
  return <VideoMessagePlayer videoUrl={url} />;
}

function DecryptedVoicePlayer({ mediaUrl, chatId }) {
  const { url, loading, error } = useDecryptedAttachment(mediaUrl, chatId, 'audio/webm');
  if (loading) {
    return (
      <div className="voice-player-bubble-loading" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px' }}>
        <div className="spinner" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', width: '12px', height: '12px' }}></div>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Загрузка голосового сообщения...</span>
      </div>
    );
  }
  if (error || !url) return <AttachmentUnavailable compact />;
  return <VoiceMessagePlayer audioUrl={url} />;
}

function VoiceMessagePlayer({ audioUrl, duration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(duration || 0);
  const audioRef = useRef(null);
  const isCalculatingRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      if (!isCalculatingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleDurationCompute = () => {
      if (audio.duration === Infinity) {
        isCalculatingRef.current = true;
        audio.currentTime = 1e101;
        
        const onSeeked = () => {
          audio.removeEventListener('seeked', onSeeked);
          setMaxDuration(audio.duration);
          audio.currentTime = 0;
          setTimeout(() => {
            isCalculatingRef.current = false;
          }, 150);
        };
        audio.addEventListener('seeked', onSeeked);
      } else if (audio.duration && !isNaN(audio.duration)) {
        setMaxDuration(audio.duration);
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDurationCompute);
    audio.addEventListener('durationchange', handleDurationCompute);

    setIsPlaying(false);
    setCurrentTime(0);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDurationCompute);
      audio.removeEventListener('durationchange', handleDurationCompute);
    };
  }, [audioUrl]);

  const togglePlay = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => console.error("Error playing audio:", err));
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    const val = parseFloat(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const formatTime = (time) => {
    if (isNaN(time) || time === Infinity) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="voice-player-bubble" onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button className="voice-play-btn" onClick={togglePlay}>
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
      <div className="voice-player-details">
        <input
          type="range"
          className="voice-seek-bar"
          min={0}
          max={maxDuration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
        />
        <div className="voice-player-meta">
          <span>{formatTime(currentTime)} / {formatTime(maxDuration)}</span>
        </div>
      </div>
    </div>
  );
}

function VideoMessagePlayer({ videoUrl }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const isCalculatingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isCalculatingRef.current && video.duration && video.duration !== Infinity) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleEnded = () => {
      setProgress(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleDurationCompute = () => {
      if (video.duration === Infinity) {
        isCalculatingRef.current = true;
        video.currentTime = 1e101;
        
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          video.currentTime = 0;
          setTimeout(() => {
            isCalculatingRef.current = false;
          }, 150);
        };
        video.addEventListener('seeked', onSeeked);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleDurationCompute);
    video.addEventListener('durationchange', handleDurationCompute);

    video.play().catch(() => {
      setIsPlaying(false);
    });

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleDurationCompute);
      video.removeEventListener('durationchange', handleDurationCompute);
    };
  }, [videoUrl]);

  const togglePlaybackAndMute = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.play().then(() => setIsPlaying(true)).catch(err => console.error(err));
    } else {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().then(() => setIsPlaying(true)).catch(err => console.error(err));
      }
    }
  };

  const handleMuteBtnClick = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const r = 88;
  const circ = 2 * Math.PI * r;
  const strokeDashoffset = circ - (progress / 100) * circ;

  return (
    <div className="round-video-wrapper" onClick={togglePlaybackAndMute}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="round-video-element"
        loop
        muted={isMuted}
        playsInline
        autoPlay
      />
      
      <svg className="video-progress-ring" viewBox="0 0 184 184">
        <circle
          className="video-progress-ring-circle"
          cx="92"
          cy="92"
          r={r}
          stroke="var(--accent-color)"
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circ}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 92 92)"
        />
      </svg>

      {!isPlaying && (
        <div className="video-mute-icon-overlay" style={{ top: '55%', left: '50%', transform: 'translate(-50%, -50%)', width: '36px', height: '36px', fontSize: '14px', position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />
        </div>
      )}

      <div className="video-mute-icon-overlay" onClick={handleMuteBtnClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </div>
    </div>
  );
}

export default function ChatArea() {
  const {
    activeChat,
    getChatStatus,
    sendMessage,
    deleteMessage,
    toggleReaction,
    isInfoOpen,
    setIsInfoOpen,
    typingStatuses,
    sendTypingStatus,
    wallpaper,
    renderAvatar,
    installedStickers,
    setActiveChatId,
    isOnline,
    retrySendMessage,
    deleteFailedMessage
  } = useChat();

  const { currentUser } = useAuth();
  const { sharedKeysCache } = useE2EE();

  const isOwner = activeChat && currentUser && (
    activeChat.createdBy === currentUser.id ||
    activeChat.createdBy === 'current'
  );

  const canPost = !activeChat || 
    activeChat.type === 'personal' || 
    isOwner || 
    (activeChat.type === 'group' && !activeChat.settings?.only_admins_can_post);

  const canSendMedia = !activeChat ||
    activeChat.type === 'personal' ||
    isOwner ||
    activeChat.settings?.allow_media !== false;

  const otherMember = activeChat?.type === 'personal'
    ? activeChat.members?.find(m => m.id !== currentUser?.id)
    : null;
  const recipientMissingE2EE = activeChat?.type === 'personal' && otherMember && !otherMember.hasE2ee;

  const isCustomWallpaper = wallpaper && !['classic', 'sunset', 'space', 'mint', 'cyber'].includes(wallpaper);
  const chatBodyStyle = isCustomWallpaper ? {
    backgroundImage: `url(${wallpaper})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } : {};

  const [inputVal, setInputVal] = useState('');
  const [retryMenuMsgId, setRetryMenuMsgId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState('emoji'); // 'emoji' | 'sticker'
  const [activeStickerPackId, setActiveStickerPackId] = useState(null);

  useEffect(() => {
    if (installedStickers.length > 0 && !activeStickerPackId) {
      setActiveStickerPackId(installedStickers[0].id);
    }
  }, [installedStickers, activeStickerPackId]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMsgActionsId, setShowMsgActionsId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
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

  const uploadFileDirectly = async (file, isAudio) => {
    setUploading(true);
    try {
      const mediaType = isAudio ? 'audio' : 'image';
      const msgText = isAudio ? 'Голосовое сообщение' : 'Изображение';

      if (isSupabaseConfigured) {
        if (!navigator.onLine) {
          sendMessage(msgText, replyingTo?.id, null, file, mediaType);
          setReplyingTo(null);
          return;
        }

        const fileExt = file.name ? file.name.split('.').pop() : (isAudio ? 'webm' : 'png');
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${activeChat.id}/${currentUser.id}/${fileName}`;

        // Encrypt file blob before upload if in E2EE chat
        let blobToUpload = file;
        const sharedKey = activeChat?.type === 'personal' ? sharedKeysCache[activeChat.id] : null;
        if (sharedKey) {
          try {
            blobToUpload = await encryptFile(file, sharedKey);
          } catch (cryptErr) {
            console.error("Failed to encrypt attachment before upload:", cryptErr);
          }
        }

        const { error } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, blobToUpload, {
            contentType: blobToUpload.type || file.type || (isAudio ? 'audio/webm' : 'image/png')
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);

        sendMessage(msgText, replyingTo?.id, publicUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          sendMessage(msgText, replyingTo?.id, event.target.result);
        };
        reader.readAsDataURL(file);
      }
      setReplyingTo(null);
    } catch (err) {
      console.error("Upload error:", err);
      const isNetworkError = !navigator.onLine || err.message?.includes('FetchError') || err.message?.includes('failed to fetch');
      if (isNetworkError) {
        const mediaType = isAudio ? 'audio' : 'image';
        const msgText = isAudio ? 'Голосовое сообщение' : 'Изображение';
        sendMessage(msgText, replyingTo?.id, null, file, mediaType);
        setReplyingTo(null);
      } else {
        alert("Ошибка при загрузке: " + err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("Размер файла превышает лимит 15 МБ. Выберите файл меньшего размера.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const isAudio = (file.type && file.type.startsWith('audio/')) || 
                    ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].some(ext => file.name.toLowerCase().endsWith(ext));
    await uploadFileDirectly(file, isAudio);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    let fileToUpload = null;
    let isAudio = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        fileToUpload = item.getAsFile();
        isAudio = false;
        break;
      } else if (item.type.indexOf('audio') !== -1) {
        fileToUpload = item.getAsFile();
        isAudio = true;
        break;
      }
    }

    if (fileToUpload) {
      e.preventDefault();
      const MAX_SIZE = 15 * 1024 * 1024;
      if (fileToUpload.size > MAX_SIZE) {
        alert("Размер вставляемого файла превышает лимит 15 МБ.");
        return;
      }
      await uploadFileDirectly(fileToUpload, isAudio);
    }
  };

  // Auto-scroll to bottom on chat switch or new message
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
    setReplyingTo(null);
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
      } catch (e) {
        try {
          recorder = new MediaRecorder(stream, { mimeType: recordMode === 'video' ? 'video/webm' : 'audio/ogg' });
        } catch (e2) {
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
        if (videoPreviewRef.current.src) {
          URL.revokeObjectURL(videoPreviewRef.current.src);
          videoPreviewRef.current.src = '';
        }
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

        // Encrypt record blob before upload if in E2EE chat
        let blobToUpload = blob;
        const sharedKey = activeChat?.type === 'personal' ? sharedKeysCache[activeChat.id] : null;
        if (sharedKey) {
          try {
            blobToUpload = await encryptFile(blob, sharedKey);
          } catch (cryptErr) {
            console.error("Failed to encrypt recording before upload:", cryptErr);
          }
        }

        const { error } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, blobToUpload, {
            contentType: blobToUpload.type || (isVoice ? 'audio/webm' : 'video/webm')
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);

        sendMessage(msgText, replyingTo?.id, publicUrl);
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

  useEffect(() => {
    scrollToBottom('smooth');
  }, [activeChat?.messages?.length]);

  // Monitor scroll to show "Scroll to Bottom" button
  const handleScroll = () => {
    if (!chatBodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
    const isFar = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBottom(isFar);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (!e.target.closest('.message-hover-actions')) {
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
          <p>Или запустите историю из панели слева!</p>
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
    setInputVal(prev => prev + emoji);
  };

  const getFormatTime = (dateObj) => {
    const d = new Date(dateObj);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      {/* Header */}
      <header className="chat-header" onClick={() => setIsInfoOpen(!isInfoOpen)}>
        <div className="chat-header-info">
          <button 
            type="button" 
            className="chat-back-btn" 
            onClick={(e) => {
              e.stopPropagation();
              setActiveChatId(null);
            }} 
            title="Назад"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="chat-avatar header-avatar" style={{ background: activeChat.avatarColor }}>
            {renderAvatar(activeChat.avatar, activeChat.type === 'channel' ? '📢' : '👥')}
          </div>
          <div className="chat-header-meta">
            <h4 className="chat-header-name">
              {activeChat.name}
              {activeChat.type === 'personal' && (
                <Lock size={15} className="e2ee-header-lock-icon" title="Сквозное шифрование включено" style={{ color: '#2ecc71', marginLeft: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
              )}
            </h4>
            <span className={`chat-header-status ${isTypingText ? 'typing' : ''}`}>
              {isTypingText || getChatStatus(activeChat)}
            </span>
          </div>
        </div>
        <div className="chat-header-actions" onClick={(e) => e.stopPropagation()}>
          <button className="chat-header-btn" onClick={() => setIsInfoOpen(!isInfoOpen)} title="Информация">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>
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
            const isMe = msg.senderId === currentUser?.id || msg.senderId === 'current';
            const showSenderName = activeChat.type === 'group' && !isMe;
            const replyMsg = msg.replyTo ? activeChat.messages.find(m => m.id === msg.replyTo) : null;

            // Check if sequential messages are from same sender (bubble grouping)
            const nextMsg = activeChat.messages[index + 1];
            const prevMsg = activeChat.messages[index - 1];
            const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
            const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;

            const isVoice = msg.text && (msg.text.startsWith('🎤 Голосовое сообщение') || msg.text.startsWith('Голосовое сообщение')) && msg.media;
            const isVideo = msg.text && (msg.text.startsWith('🎬 Видеосообщение') || msg.text.startsWith('Видеосообщение')) && msg.media;
            const isSticker = msg.text && msg.text.startsWith('sticker:') && msg.media;

            return (
              <div
                key={msg.id}
                className={`message-row ${isMe ? 'row-me' : 'row-other'} ${isFirstInGroup ? 'group-first' : ''} ${isLastInGroup ? 'group-last' : ''}`}
                onMouseLeave={() => {
                  if (showMsgActionsId !== msg.id) {
                    setShowMsgActionsId(null);
                  }
                }}
              >
                {/* Bubble */}
                <div className={`message-bubble ${isMe ? 'bubble-me' : 'bubble-other'} ${isVideo ? 'bubble-video' : ''} ${isSticker ? 'bubble-sticker' : ''}`}>
                  {showSenderName && isFirstInGroup && (
                    <span className="sender-name">{msg.senderName}</span>
                  )}

                  {/* Reply Context in Bubble */}
                  {replyMsg && (
                    <div className="reply-preview-bubble">
                      <span className="reply-preview-sender">{replyMsg.senderName}</span>
                      <p className="reply-preview-text">{replyMsg.text}</p>
                    </div>
                  )}

                  {/* Media attachment if any */}
                  {msg.media && !isVoice && !isVideo && !isSticker && (
                    <div className="bubble-media-wrapper">
                      <DecryptedImage mediaUrl={msg.media} chatId={activeChat.id} />
                    </div>
                  )}

                  {isSticker ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <StickerMessage mediaUrl={msg.media} />
                      <div className="bubble-metadata sticker-metadata" style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        background: 'rgba(0, 0, 0, 0.45)',
                        padding: '1px 5px',
                        borderRadius: '8px',
                        color: 'white',
                        zIndex: 10,
                        fontSize: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        pointerEvents: 'none'
                      }}>
                        <span className="message-time" style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '9px' }}>
                          {getFormatTime(msg.timestamp)}
                        </span>
                        {isMe && (
                          <span className="check-icons" style={{ color: 'white' }}>
                            {msg.isFailed ? (
                              <AlertCircle 
                                className="seen-check failed" 
                                style={{ width: '12px', height: '12px', color: '#f87171', cursor: 'pointer', pointerEvents: 'auto' }} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRetryMenuMsgId(retryMenuMsgId === msg.id ? null : msg.id);
                                }}
                              />
                            ) : msg.isPending ? (
                              <PendingClock className="seen-check pending" style={{ width: '10px', height: '10px' }} />
                            ) : activeChat.type === 'channel' ? (
                              <SingleCheck className="seen-check" style={{ width: '10px', height: '10px' }} />
                            ) : msg.read ? (
                              <DoubleCheck className="seen-check blue" style={{ width: '10px', height: '10px' }} />
                            ) : (
                              <SingleCheck className="seen-check" style={{ width: '10px', height: '10px' }} />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : isVideo ? (
                    <div style={{ position: 'relative' }}>
                      <DecryptedVideoPlayer mediaUrl={msg.media} chatId={activeChat.id} />
                      <div className="bubble-metadata" style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '36px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        color: 'white',
                        zIndex: 10
                      }}>
                        <span className="message-time" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          {getFormatTime(msg.timestamp)}
                        </span>
                        {isMe && (
                          <span className="check-icons" style={{ color: 'white' }}>
                            {msg.isFailed ? (
                              <AlertCircle 
                                className="seen-check failed" 
                                style={{ width: '12px', height: '12px', color: '#f87171', cursor: 'pointer', pointerEvents: 'auto' }} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRetryMenuMsgId(retryMenuMsgId === msg.id ? null : msg.id);
                                }}
                              />
                            ) : msg.isPending ? (
                              <PendingClock className="seen-check pending" />
                            ) : activeChat.type === 'channel' ? (
                              <SingleCheck className="seen-check" />
                            ) : msg.read ? (
                              <DoubleCheck className="seen-check blue" />
                            ) : (
                              <SingleCheck className="seen-check" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Message content */
                    <div className="bubble-content">
                      {isVoice ? (
                        <DecryptedVoicePlayer mediaUrl={msg.media} chatId={activeChat.id} />
                      ) : (msg.text && msg.text.startsWith('```')) ? (
                        <pre className="code-block">
                          <code>{msg.text.replace(/```/g, '')}</code>
                        </pre>
                      ) : (
                        (!msg.text || (msg.text !== '🖼️ [Изображение]' && msg.text !== 'Изображение')) && (
                          <p className="message-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {msg.isLocked && <Lock size={13} style={{ color: 'var(--text-secondary)', opacity: 0.8, flexShrink: 0 }} />}
                            <span>{renderMessageTextWithLinks(msg.text)}</span>
                          </p>
                        )
                      )}

                      <div className="bubble-metadata">
                        <span className="message-time">{getFormatTime(msg.timestamp)}</span>
                        {isMe && (
                          <span className="check-icons">
                            {msg.isFailed ? (
                              <AlertCircle 
                                className="seen-check failed" 
                                style={{ width: '12px', height: '12px', color: '#f87171', cursor: 'pointer', pointerEvents: 'auto' }} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRetryMenuMsgId(retryMenuMsgId === msg.id ? null : msg.id);
                                }}
                              />
                            ) : msg.isPending ? (
                              <PendingClock className="seen-check pending" />
                            ) : activeChat.type === 'channel' ? (
                              <SingleCheck className="seen-check" />
                            ) : msg.read ? (
                              <DoubleCheck className="seen-check blue" />
                            ) : (
                              <SingleCheck className="seen-check" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Reactions Render */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="bubble-reactions">
                      {msg.reactions.map(r => (
                        <button
                          key={r.emoji}
                          className={`reaction-badge ${(r.users.includes('current') || (currentUser && r.users.includes(currentUser.id))) ? 'active' : ''}`}
                          onClick={() => toggleReaction(activeChat.id, msg.id, r.emoji)}
                        >
                          {r.emoji} <span className="react-count">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Action hover tools */}
                  <div className={`message-hover-actions ${showMsgActionsId === msg.id ? 'active' : ''}`}>
                    <button
                      className="hover-action-btn"
                      onClick={() => setReplyingTo(msg)}
                      title="Ответить"
                    >
                      <CornerUpLeft size={14} />
                    </button>
                    <button
                      className="hover-action-btn"
                      onClick={() => {
                        if (showMsgActionsId === msg.id) {
                          setShowMsgActionsId(null);
                        } else {
                          setShowMsgActionsId(msg.id);
                        }
                      }}
                    >
                      <Smile size={14} />
                    </button>
                    <button
                      className="hover-action-btn delete"
                      onClick={() => deleteMessage(activeChat.id, msg.id)}
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>

                    {/* Emoji Reaction Drawer */}
                    {showMsgActionsId === msg.id && (
                      <div className="reaction-drawer">
                        {emojis.slice(0, 8).map(emo => (
                          <span
                            key={emo}
                            className="reaction-drawer-item"
                            onClick={() => {
                              toggleReaction(activeChat.id, msg.id, emo);
                              setShowMsgActionsId(null);
                            }}
                          >
                            {emo}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {retryMenuMsgId === msg.id && (
                    <div className="failed-message-menu">
                      <button className="failed-menu-btn retry" onClick={(e) => {
                        e.stopPropagation();
                        retrySendMessage(msg.id);
                        setRetryMenuMsgId(null);
                      }}>
                        Повторить
                      </button>
                      <button className="failed-menu-btn delete" onClick={(e) => {
                        e.stopPropagation();
                        deleteFailedMessage(msg.id);
                        setRetryMenuMsgId(null);
                      }}>
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating scroll to bottom button */}
      {showScrollBottom && (
        <button className="scroll-bottom-btn" onClick={() => scrollToBottom('smooth')}>
          <ArrowDown size={18} />
        </button>
      )}

      {/* Input Area */}
      {!canPost ? (
        <footer className="chat-footer-input restricted" style={{ padding: '8px 16px' }}>
          <div className="restricted-input-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', color: 'var(--text-secondary)', fontSize: '13px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
            <span>{activeChat?.type === 'channel' ? 'Только администраторы могут отправлять сообщения в этот канал' : 'Только администраторы могут отправлять сообщения в эту группу'}</span>
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
                    accept="image/*,audio/*"
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                  <button
                    className="input-action-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Прикрепить изображение"
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
                  placeholder={recipientMissingE2EE ? "Шифрование недоступно..." : "Напишите сообщение..."}
                  value={inputVal}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  onPaste={handlePaste}
                  rows={1}
                  disabled={recipientMissingE2EE}
                />

                {/* Emoji picker button */}
                <div className="emoji-wrapper" ref={emojiRef} onMouseDown={(e) => e.stopPropagation()}>
                  <button
                    className={`input-action-btn emoji-trigger ${showEmojiPicker ? 'active' : ''}`}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile size={22} />
                  </button>

                  {showEmojiPicker && (
                    <div className="emoji-picker-popup tabbed-picker">
                      <div className="picker-header-tabs">
                        <button
                          type="button"
                          className={`picker-tab-btn ${pickerTab === 'emoji' ? 'active' : ''}`}
                          onClick={() => setPickerTab('emoji')}
                        >
                          Смайлы
                        </button>
                        <button
                          type="button"
                          className={`picker-tab-btn ${pickerTab === 'sticker' ? 'active' : ''}`}
                          onClick={() => setPickerTab('sticker')}
                        >
                          Стикеры
                        </button>
                      </div>

                      {pickerTab === 'emoji' ? (
                        <div className="emoji-picker-grid">
                          {emojis.map((emo, index) => (
                            <span
                              key={`${emo}-${index}`}
                              className="emoji-item"
                              onClick={() => handleEmojiClick(emo)}
                            >
                              {emo}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="sticker-picker-container">
                          {installedStickers.length === 0 ? (
                            <div className="no-stickers-placeholder">
                              <p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>Нет установленных стикеров</p>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Вы можете импортировать их в настройках профиля
                              </span>
                            </div>
                          ) : (
                            <>
                              {/* Sticker Pack Tabs */}
                              <div className="sticker-pack-tabs">
                                {installedStickers.map((pack) => {
                                  const firstSticker = pack.stickers?.[0];
                                  if (!firstSticker) return null;
                                  const isPublicUrl = firstSticker.filePath.startsWith('http');
                                  const coverUrl = isPublicUrl 
                                    ? firstSticker.filePath 
                                    : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/stickers/${firstSticker.filePath}`;

                                  return (
                                    <button
                                      key={pack.id}
                                      type="button"
                                      className={`sticker-pack-tab-btn ${activeStickerPackId === pack.id ? 'active' : ''}`}
                                      onClick={() => setActiveStickerPackId(pack.id)}
                                      title={pack.title}
                                    >
                                      {pack.is_animated ? (
                                        <Sparkles size={16} style={{ color: 'var(--text-secondary)' }} />
                                      ) : pack.is_video ? (
                                        <Film size={16} style={{ color: 'var(--text-secondary)' }} />
                                      ) : (
                                        <img src={coverUrl} alt="set-cover" className="pack-tab-icon" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Sticker Grid */}
                              <div className="sticker-grid">
                                {(() => {
                                  const activePack = installedStickers.find(p => p.id === activeStickerPackId) || installedStickers[0];
                                  if (!activePack) return null;

                                  return activePack.stickers.map((st) => {
                                    const isPublicUrl = st.filePath.startsWith('http');
                                    const fileUrl = isPublicUrl 
                                      ? st.filePath 
                                      : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/stickers/${st.filePath}`;

                                    const handleStickerSend = () => {
                                      sendMessage(`sticker:${activePack.name}`, null, fileUrl);
                                      setShowEmojiPicker(false);
                                    };

                                    return (
                                      <div
                                        key={st.id}
                                        className="sticker-picker-item"
                                        onClick={handleStickerSend}
                                        title={st.emoji || 'sticker'}
                                      >
                                        {activePack.is_animated ? (
                                          st.emoji ? (
                                            <span style={{ fontSize: '24px' }}>{st.emoji}</span>
                                          ) : (
                                            <Sparkles size={24} style={{ color: 'var(--text-secondary)', display: 'block', margin: 'auto' }} />
                                          )
                                        ) : activePack.is_video ? (
                                          <video src={fileUrl} autoPlay loop muted playsInline className="picker-sticker-preview" />
                                        ) : (
                                          <img src={fileUrl} alt="sticker" className="picker-sticker-preview" />
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
