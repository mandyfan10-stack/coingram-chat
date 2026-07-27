import React from 'react';
import {
  CornerUpLeft,
  Trash2,
  Smile,
  Lock,
  AlertCircle
} from 'lucide-react';
import { normalizeReaction } from '../../utils/reactionUtils';
import { SingleCheck, DoubleCheck, PendingClock } from './messageStatusIcons';
import { renderMessageTextWithLinks } from './renderMessageText';
import {
  DecryptedImage,
  DecryptedVideoPlayer,
  DecryptedVoicePlayer,
  DecryptedSticker
} from './mediaPlayers';

function getFormatTime(dateObj) {
  const d = new Date(dateObj);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({
  msg,
  index,
  activeChat,
  currentUser,
  showMsgActionsId,
  setShowMsgActionsId,
  retryMenuMsgId,
  setRetryMenuMsgId,
  setReplyingTo,
  setOpenedImageUrl,
  deleteMessage,
  toggleReaction,
  retrySendMessage,
  deleteFailedMessage,
  emojis
}) {
  const isMe = msg.senderId === currentUser?.id || msg.senderId === 'current';
  const showSenderName = activeChat.type === 'group' && !isMe;
  const replyMsg = msg.replyTo ? activeChat.messages.find(m => m.id === msg.replyTo) : null;

  const nextMsg = activeChat.messages[index + 1];
  const prevMsg = activeChat.messages[index - 1];
  const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
  const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;

  const isVoice = msg.text && (msg.text.startsWith('🎤 Голосовое сообщение') || msg.text.startsWith('Голосовое сообщение')) && msg.media;
  const isVideo = msg.text && (msg.text.startsWith('🎬 Видеосообщение') || (msg.text.startsWith('Видеосообщение') || msg.text === 'Видео')) && msg.media;
  const isSticker = msg.text && msg.text.startsWith('sticker:') && msg.media;

  return (
              <div
                key={msg.id}
                className={`message-row ${isMe ? 'row-me' : 'row-other'} ${isFirstInGroup ? 'group-first' : ''} ${isLastInGroup ? 'group-last' : ''}`}
                data-message-id={msg.id}
                data-message-sender-id={msg.senderId}
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
                      <DecryptedImage
                        mediaUrl={msg.media}
                        chatId={activeChat.id}
                        onOpen={setOpenedImageUrl}
                      />
                    </div>
                  )}

                  {isSticker ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <DecryptedSticker mediaUrl={msg.media} chatId={activeChat.id} />
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
                      {msg.reactions.map(r => {
                        const normalizedReaction = normalizeReaction(r);
                        return (
                          <button
                            key={r.emoji}
                            className={`reaction-badge ${(normalizedReaction.users.includes('current') || (currentUser && normalizedReaction.users.includes(currentUser.id))) ? 'active' : ''}`}
                            onClick={() => toggleReaction(activeChat.id, msg.id, r.emoji)}
                          >
                            {r.emoji} <span className="react-count">{normalizedReaction.count}</span>
                          </button>
                        );
                      })}
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
}
