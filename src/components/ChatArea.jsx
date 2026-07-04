import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
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
  ArrowDown
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

function VoiceMessagePlayer({ audioUrl, duration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(duration || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setMaxDuration(audio.duration);
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    setIsPlaying(false);
    setCurrentTime(0);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleEnded = () => {
      setProgress(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    video.play().catch(() => {
      setIsPlaying(false);
    });

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
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
        <div className="video-mute-icon-overlay" style={{ top: '55%', left: '50%', transform: 'translate(-50%, -50%)', width: '36px', height: '36px', fontSize: '14px', position: 'absolute' }}>
          ▶️
        </div>
      )}

      <div className="video-mute-icon-overlay" onClick={handleMuteBtnClick}>
        {isMuted ? '🔇' : '🔊'}
      </div>
    </div>
  );
}

export default function ChatArea() {
  const {
    activeChat,
    sendMessage,
    deleteMessage,
    toggleReaction,
    isInfoOpen,
    setIsInfoOpen,
    currentUser,
    typingStatuses,
    sendTypingStatus,
    wallpaper,
    renderAvatar
  } = useChat();

  const isCustomWallpaper = wallpaper && !['classic', 'sunset', 'space', 'mint', 'cyber'].includes(wallpaper);
  const chatBodyStyle = isCustomWallpaper ? {
    backgroundImage: `url(${wallpaper})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } : {};

  const [inputVal, setInputVal] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMsgActionsId, setShowMsgActionsId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false);

  const [recordMode, setRecordMode] = useState('voice'); // 'voice' or 'video'
  const [isRecording, setIsRecording] = useState(false);
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
  const isCancelledRef = useRef(false);
  const videoPreviewRef = useRef(null);

  const emojis = ['😀', '😂', '😍', '👍', '🔥', '🎉', '👏', '❤️', '🤔', '👀', '✨', '🚀', '💯', '😎', '🎉'];

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      if (isSupabaseConfigured) {
        // Upload image to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        const { error } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);

        sendMessage('🖼️ [Изображение]', replyingTo?.id, publicUrl);
      } else {
        // Mock Base64 fallback logic
        const reader = new FileReader();
        reader.onload = (event) => {
          sendMessage('🖼️ [Изображение]', replyingTo?.id, event.target.result);
        };
        reader.readAsDataURL(file);
      }
      setReplyingTo(null);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Ошибка при загрузке изображения: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

    if (isCurrentlyTyping) {
      setIsCurrentlyTyping(false);
      sendTypingStatus(activeChat?.id, false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isRecording) {
      stopRecordingAndSend(true);
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
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (clientX === undefined) return;

      const diffX = recordStartX.current - clientX;
      if (diffX > 100 && !isCancelledRef.current) {
        isCancelledRef.current = true;
        stopRecordingAndSend(true);
      }
    };

    const handleGlobalPointerUp = () => {
      stopRecordingAndSend(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove);
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

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      cleanupRecordingState();
    }
  };

  const cleanupRecordingState = () => {
    setIsRecording(false);
    setRecordDuration(0);
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  const uploadAndSendRecord = async (blob) => {
    setUploading(true);
    try {
      const isVoice = recordMode === 'voice';
      const fileExt = 'webm';
      const fileName = `record_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;

      if (isSupabaseConfigured) {
        const { error } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, blob, {
            contentType: isVoice ? 'audio/webm' : 'video/webm'
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);

        const msgText = isVoice ? '🎤 Голосовое сообщение' : '🎬 Видеосообщение';
        sendMessage(msgText, replyingTo?.id, publicUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const msgText = isVoice ? '🎤 Голосовое сообщение' : '🎬 Видеосообщение';
          sendMessage(msgText, replyingTo?.id, event.target.result);
        };
        reader.readAsDataURL(blob);
      }
      setReplyingTo(null);
    } catch (err) {
      console.error("Upload recording error:", err);
      alert("Ошибка при сохранении сообщения: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    recordStartX.current = clientX;
    isCancelledRef.current = false;

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
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
    <main className="chat-area">
      {/* Header */}
      <header className="chat-header" onClick={() => setIsInfoOpen(!isInfoOpen)}>
        <div className="chat-header-info">
          <div className="chat-avatar header-avatar" style={{ background: activeChat.avatarColor }}>
            {renderAvatar(activeChat.avatar, activeChat.type === 'channel' ? '📢' : '👥')}
          </div>
          <div className="chat-header-meta">
            <h4 className="chat-header-name">{activeChat.name}</h4>
            <span className={`chat-header-status ${activeChat.lastSeen === 'печатает...' || isTypingText ? 'typing' : ''}`}>
              {isTypingText || activeChat.lastSeen}
            </span>
          </div>
        </div>
        <div className="chat-header-actions" onClick={(e) => e.stopPropagation()}>
          <button className="chat-header-btn" onClick={() => setIsInfoOpen(!isInfoOpen)} title="Информация">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

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

            const isVoice = msg.text && msg.text.startsWith('🎤 Голосовое сообщение') && msg.media;
            const isVideo = msg.text && msg.text.startsWith('🎬 Видеосообщение') && msg.media;

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
                <div className={`message-bubble ${isMe ? 'bubble-me' : 'bubble-other'} ${isVideo ? 'bubble-video' : ''}`}>
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
                  {msg.media && !isVoice && !isVideo && (
                    <div className="bubble-media-wrapper">
                      <img src={msg.media} alt="Вложение" className="bubble-media" />
                    </div>
                  )}

                  {isVideo ? (
                    <div style={{ position: 'relative' }}>
                      <VideoMessagePlayer videoUrl={msg.media} />
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
                            {activeChat.type === 'channel' ? (
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
                        <VoiceMessagePlayer audioUrl={msg.media} />
                      ) : msg.text.startsWith('```') ? (
                        <pre className="code-block">
                          <code>{msg.text.replace(/```/g, '')}</code>
                        </pre>
                      ) : (
                        <p className="message-text">{msg.text}</p>
                      )}

                      {/* Metadata & Read Checks */}
                      <div className="bubble-metadata">
                        <span className="message-time">{getFormatTime(msg.timestamp)}</span>
                        {isMe && (
                          <span className="check-icons">
                            {activeChat.type === 'channel' ? (
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
                          className={`reaction-badge ${r.users.includes('current') ? 'active' : ''}`}
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
      <footer className="chat-footer-input">
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
            <div className="recording-panel">
              <div className="record-dot" />
              <span className="record-timer">{formatDuration(recordDuration)}</span>
              <div className="record-wave">
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
              </div>
              <span className="record-cancel-hint">← Проведите влево для отмены</span>
            </div>
          ) : (
            <>
              {/* Attachment button */}
              <div className="attach-wrapper">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
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

              {/* Text Area */}
              <div className="input-textarea-wrapper">
                <textarea
                  placeholder="Напишите сообщение..."
                  value={inputVal}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  rows={1}
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
                    <div className="emoji-picker-popup">
                      <div className="emoji-picker-grid">
                        {emojis.map(emo => (
                          <span
                            key={emo}
                            className="emoji-item"
                            onClick={() => handleEmojiClick(emo)}
                          >
                            {emo}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Send Action */}
          {inputVal.trim() ? (
            <button
              className="send-message-btn"
              onClick={handleSend}
              title="Отправить"
            >
              <Send size={20} />
            </button>
          ) : (
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
          )}
        </div>
      </footer>

      {/* Video Recording Live Preview Overlay */}
      {isRecording && recordMode === 'video' && (
        <div className="video-record-preview-overlay">
          <div className="video-record-circle">
            <video ref={videoPreviewRef} muted playsInline autoPlay />
          </div>
          <div className="video-record-timer">
            {formatDuration(recordDuration)}
          </div>
          <div className="video-record-hint">
            Запись круглого видеосообщения<br />
            Отпустите кнопку для отправки, проведите влево для отмены
          </div>
        </div>
      )}
    </main>
  );
}
