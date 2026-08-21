import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CornerUpLeft, Copy, Trash2, Check } from 'lucide-react';
import { normalizeReaction } from '../../utils/reactionUtils';

export default function MobileActionSheet({
  isOpen,
  msg,
  activeChat,
  currentUser,
  emojis = [],
  onClose,
  setReplyingTo,
  deleteMessage,
  toggleReaction
}) {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleReactionClick = useCallback((emo) => {
    if (!msg || !activeChat) return;
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
    toggleReaction(activeChat.id, msg.id, emo);
    onClose();
  }, [activeChat, msg, toggleReaction, onClose]);

  const handleReply = useCallback(() => {
    if (!msg) return;
    setReplyingTo(msg);
    onClose();
  }, [msg, setReplyingTo, onClose]);

  const handleCopyText = useCallback(async () => {
    if (!msg?.text) return;
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopied(true);
      try {
        navigator.vibrate?.(10);
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        onClose();
      }, 350);
    } catch {
      onClose();
    }
  }, [msg?.text, onClose]);

  const handleDelete = useCallback(() => {
    if (!msg || !activeChat) return;
    deleteMessage(activeChat.id, msg.id);
    onClose();
  }, [activeChat, msg, deleteMessage, onClose]);

  if (!isOpen || !msg) return null;

  const reactionList = emojis && emojis.length > 0
    ? emojis.slice(0, 14)
    : ['❤️', '👍', '👎', '🔥', '😂', '👏', '🎉', '😢', '😍', '⚡', '🤔', '🙏'];

  return createPortal(
    <div
      className="mobile-action-sheet-backdrop"
      onClick={onClose}
      data-test="mobile-action-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Действия с сообщением"
    >
      <div
        className="mobile-action-sheet"
        onClick={(e) => e.stopPropagation()}
        data-test="mobile-action-sheet"
      >
        {/* Quick Reaction Carousel */}
        <div className="mobile-sheet-reactions" role="toolbar" aria-label="Быстрые реакции">
          {reactionList.map((emo) => {
            const isActive = msg.reactions?.some((r) => {
              const norm = normalizeReaction(r);
              return (
                r.emoji === emo &&
                (norm.users.includes('current') ||
                  (currentUser && norm.users.includes(currentUser.id)))
              );
            });

            return (
              <button
                key={emo}
                type="button"
                className={`mobile-sheet-reaction-pill ${isActive ? 'active' : ''}`}
                onClick={() => handleReactionClick(emo)}
                aria-label={`Реакция ${emo}`}
                data-test={`mobile-reaction-${emo}`}
              >
                {emo}
              </button>
            );
          })}
        </div>

        {/* Action Menu Items */}
        <div className="mobile-sheet-menu">
          <button
            type="button"
            className="mobile-sheet-item"
            onClick={handleReply}
            data-test="mobile-action-reply"
          >
            <div className="mobile-sheet-item-icon">
              <CornerUpLeft size={19} />
            </div>
            <span className="mobile-sheet-item-label">Ответить</span>
          </button>

          {msg.text && (
            <button
              type="button"
              className="mobile-sheet-item"
              onClick={handleCopyText}
              data-test="mobile-action-copy"
            >
              <div className="mobile-sheet-item-icon">
                {copied ? <Check size={19} className="success-icon" /> : <Copy size={19} />}
              </div>
              <span className="mobile-sheet-item-label">
                {copied ? 'Скопировано!' : 'Копировать текст'}
              </span>
            </button>
          )}

          <button
            type="button"
            className="mobile-sheet-item delete"
            onClick={handleDelete}
            data-test="mobile-action-delete"
          >
            <div className="mobile-sheet-item-icon">
              <Trash2 size={19} />
            </div>
            <span className="mobile-sheet-item-label">Удалить</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
