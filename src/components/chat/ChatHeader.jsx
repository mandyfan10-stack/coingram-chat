import React from 'react';
import { ArrowLeft, Lock, MoreVertical } from 'lucide-react';
import { isSavedMessagesChat, savedMessagesDisplayName } from '../../utils/savedMessages';
import { chatAvatarFallback } from '../../context/chat/avatarFallback';

export default function ChatHeader({
  activeChat,
  renderAvatar,
  getChatStatus,
  isTypingText,
  isInfoOpen,
  setIsInfoOpen,
  setActiveChatId
}) {
  const toggleInfo = () => {
    setIsInfoOpen(!isInfoOpen);
  };
  const isSaved = isSavedMessagesChat(activeChat);
  const title = isSaved ? savedMessagesDisplayName(activeChat) : activeChat.name;

  return (
    <header className="chat-header" onClick={toggleInfo}>
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
        <div className="chat-avatar header-avatar">{renderAvatar(activeChat.avatar, chatAvatarFallback(activeChat))}</div>
        <div className="chat-header-meta">
          <h4 className="chat-header-name">
            {title}
            {activeChat.type === 'personal' && !isSaved && (
              <Lock
                size={15}
                className="e2ee-header-lock-icon"
                title="Сквозное шифрование включено"
                style={{ color: '#2ecc71', marginLeft: '6px', display: 'inline-block', verticalAlign: 'middle' }}
              />
            )}
          </h4>
          <span className={`chat-header-status ${isTypingText ? 'typing' : ''}`}>
            {isTypingText || getChatStatus(activeChat)}
          </span>
        </div>
      </div>
      <div className="chat-header-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="chat-header-btn" onClick={toggleInfo} title="Информация">
          <MoreVertical size={20} />
        </button>
      </div>
    </header>
  );
}
