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

  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const emojiRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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
  }, [activeChat?.id]);

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
                <div className={`message-bubble ${isMe ? 'bubble-me' : 'bubble-other'}`}>
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
                  {msg.media && (
                    <div className="bubble-media-wrapper">
                      <img src={msg.media} alt="Вложение" className="bubble-media" />
                    </div>
                  )}

                  {/* Message content */}
                  <div className="bubble-content">
                    {msg.text.startsWith('```') ? (
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

          {/* Send Action */}
          <button
            className="send-message-btn"
            onClick={handleSend}
            title={inputVal.trim() ? 'Отправить' : 'Голосовое сообщение'}
          >
            {inputVal.trim() ? <Send size={20} /> : <Mic size={20} />}
          </button>
        </div>
      </footer>
    </main>
  );
}
