import React from 'react';
import { ArrowLeft, Lock, MoreVertical } from 'lucide-react';

export default function ChatHeader({
  activeChat,
  renderAvatar,
  getChatStatus,
  isTypingText,
  isInfoOpen,
  setIsInfoOpen,
  setActiveChatId
}) {
  return (
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
        <button className="chat-header-btn" onClick={() => setIsInfoOpen(!isInfoOpen)} title="Информация">
          <MoreVertical size={20} />
        </button>
      </div>
    </header>
  );
}
