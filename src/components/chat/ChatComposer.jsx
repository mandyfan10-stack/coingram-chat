import React from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  X,
  Play,
  Pause,
  Lock,
  Sparkles,
  Film,
  Trash2,
  CornerUpLeft
} from 'lucide-react';
import { CHAT_MEDIA_ACCEPT } from '../../utils/mediaValidation';

/**
 * Presentational chat footer: reply bar, text input, emoji/sticker picker,
 * attachment, voice/video record controls. All state/handlers come from ChatArea.
 */
export default function ChatComposer({
  activeChat,
  canPost,
  canSendMedia,
  recipientMissingE2EE,
  replyingTo,
  setReplyingTo,
  inputVal,
  handleInputChange,
  handleKeyPress,
  handlePaste,
  handleSend,
  handleEmojiClick,
  showEmojiPicker,
  setShowEmojiPicker,
  pickerTab,
  setPickerTab,
  emojiRef,
  emojis,
  installedStickers,
  activeStickerPackId,
  setActiveStickerPackId,
  sendMessage,
  fileInputRef,
  handleFileChange,
  uploading,
  isRecording,
  isRecordingLocked,
  isRecordingPaused,
  isLockActive,
  recordMode,
  recordDuration,
  formatDuration,
  stopRecordingAndSend,
  pauseRecording,
  resumeRecording,
  handlePointerDown,
  handlePointerUp,
  videoPreviewRef
}) {
  if (!canPost) {
    return (
      <footer className="chat-footer-input restricted" style={{ padding: '8px 16px' }}>
        <div className="restricted-input-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', color: 'var(--text-secondary)', fontSize: '13px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
          <span>{activeChat?.type === 'channel' ? 'Только администраторы могут отправлять сообщения в этот канал' : 'Только администраторы могут отправлять сообщения в эту группу'}</span>
        </div>
      </footer>
    );
  }

  return (
    <>
      <footer className="chat-footer-input">
        {recipientMissingE2EE && (
          <div className="e2ee-waiting-banner">
            <Lock size={14} className="e2ee-banner-icon" />
            <span>Ожидание настройки ключей шифрования собеседником...</span>
          </div>
        )}

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
                    title={isRecordingPaused ? 'Продолжить запись' : 'Приостановить запись'}
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

              <div className="input-textarea-wrapper">
                <textarea
                  placeholder={recipientMissingE2EE ? 'Шифрование недоступно...' : 'Напишите сообщение...'}
                  value={inputVal}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  onPaste={handlePaste}
                  rows={1}
                  disabled={recipientMissingE2EE}
                />

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

                              <div className="sticker-grid">
                                {(() => {
                                  const activePack = installedStickers.find((p) => p.id === activeStickerPackId) || installedStickers[0];
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
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <button
              className="send-message-btn"
              disabled
              title={recipientMissingE2EE ? 'Ожидание настройки собеседником' : 'Отправка медиа ограничена'}
              style={{ opacity: 0.4, cursor: 'not-allowed' }}
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </footer>

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
    </>
  );
}
