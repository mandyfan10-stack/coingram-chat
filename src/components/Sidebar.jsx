import React from 'react';
import { useChat } from '../context/ChatContext';
import { Menu, Search, Pin, VolumeX, MessageSquare, User, Users, Megaphone, Bot, MessageSquarePlus } from 'lucide-react';

export default function Sidebar() {
  const {
    chats,
    activeChatId,
    setActiveChatId,
    searchQuery,
    setSearchQuery,
    activeFolder,
    setActiveFolder,
    setIsSettingsOpen,
    stories,
    viewStory,
    currentUser,
    setIsNewChatOpen,
    typingStatuses,
    setIsCreateStoryOpen,
    setIsDrawerOpen,
    setNewChatModalTab,
    renderAvatar
  } = useChat();

  // Filter chats by folder and query
  const filteredChats = chats.filter(chat => {
    // 1. Filter by Folder
    if (activeFolder === 'personal' && chat.type !== 'personal') return false;
    if (activeFolder === 'groups' && chat.type !== 'group') return false;
    if (activeFolder === 'channels' && chat.type !== 'channel') return false;
    if (activeFolder === 'bots' && chat.type !== 'bot') return false;

    // 2. Filter by Search Query
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = chat.name.toLowerCase().includes(query);
    const msgMatch = chat.messages.some(m => m.text.toLowerCase().includes(query));
    return nameMatch || msgMatch;
  });

  // Sort chats: pinned first, then by last message timestamp
  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    
    const aLastMsg = a.messages[a.messages.length - 1];
    const bLastMsg = b.messages[b.messages.length - 1];
    if (!aLastMsg) return 1;
    if (!bLastMsg) return -1;
    return new Date(bLastMsg.timestamp) - new Date(aLastMsg.timestamp);
  });

  const getFormatTime = (dateObj) => {
    const d = new Date(dateObj);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getFolderIcon = (folder) => {
    switch (folder) {
      case 'all': return <MessageSquare size={16} />;
      case 'personal': return <User size={16} />;
      case 'groups': return <Users size={16} />;
      case 'channels': return <Megaphone size={16} />;
      case 'bots': return <Bot size={16} />;
      default: return null;
    }
  };

  return (
    <aside className="sidebar">
      {/* Top Header */}
      <div className="sidebar-header">
        <button className="menu-btn" onClick={() => setIsDrawerOpen(true)} title="Настройки">
          <Menu size={22} />
        </button>
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Поиск чатов и сообщений..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="menu-btn" onClick={() => {
          setNewChatModalTab('personal');
          setIsNewChatOpen(true);
        }} title="Новый чат">
          <MessageSquarePlus size={22} />
        </button>
      </div>

      {/* Folders Navigation */}
      <div className="folders-nav">
        {[
          { id: 'all', name: 'Все' },
          { id: 'personal', name: 'Личные' },
          { id: 'groups', name: 'Группы' },
          { id: 'channels', name: 'Каналы' },
          { id: 'bots', name: 'Боты' }
        ].map(folder => (
          <button
            key={folder.id}
            className={`folder-tab ${activeFolder === folder.id ? 'active' : ''}`}
            onClick={() => setActiveFolder(folder.id)}
          >
            {getFolderIcon(folder.id)}
            <span>{folder.name}</span>
          </button>
        ))}
      </div>

      {/* Stories Tray */}
      <div className="stories-tray">
        <div 
          className="story-item current-user-story" 
          onClick={() => {
            const myStory = stories.find(s => s.userId === currentUser?.id);
            if (myStory) {
              viewStory(myStory.id);
            } else {
              setIsCreateStoryOpen(true);
            }
          }}
        >
          <div className="story-avatar-wrapper plus-icon">
            <span className="story-avatar-initials" style={{ padding: 0 }}>
              {renderAvatar(currentUser?.avatar, '🪙')}
            </span>
          </div>
          <span className="story-username">Моя история</span>
        </div>
        
        {stories.map(story => (
          <div
            key={story.id}
            className={`story-item ${story.viewed ? 'viewed' : 'unviewed'}`}
            onClick={() => viewStory(story.id)}
          >
            <div className="story-avatar-wrapper">
              <span className="story-avatar-initials" style={{ padding: 0 }}>
                {renderAvatar(story.userAvatar, '🪙')}
              </span>
            </div>
            <span className="story-username">{story.userName}</span>
          </div>
        ))}
      </div>

      {/* Chat List */}
      <div className="chat-list">
        {sortedChats.length === 0 ? (
          <div className="no-chats">Чат не найден</div>
        ) : (
          sortedChats.map(chat => {
            const lastMsg = chat.messages[chat.messages.length - 1];
            const isActive = chat.id === activeChatId;
            const unreadCount = chat.messages.filter(
              m => m.senderId !== currentUser?.id && m.senderId !== 'current' && !m.read
            ).length;

            const typingUsers = typingStatuses[chat.id] ? Object.values(typingStatuses[chat.id]) : [];
            const isTypingText = typingUsers.length > 0
              ? `${typingUsers.join(', ')} ${typingUsers.length > 1 ? 'печатают' : 'печатает'}...`
              : null;

            return (
              <div
                key={chat.id}
                className={`chat-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveChatId(chat.id)}
              >
                {/* Avatar */}
                <div className="chat-avatar" style={{ background: chat.avatarColor }}>
                  {renderAvatar(chat.avatar, '👤')}
                  {chat.isOnline && chat.type !== 'bot' && <span className="online-badge" />}
                </div>

                {/* Info info */}
                <div className="chat-info-block">
                  <div className="chat-info-header">
                    <span className="chat-name">{chat.name}</span>
                    <span className="chat-time">
                      {lastMsg ? getFormatTime(lastMsg.timestamp) : ''}
                    </span>
                  </div>

                  <div className="chat-info-body">
                    <p className="chat-last-message">
                      {isTypingText ? (
                        <span className="typing-indicator-sidebar">{isTypingText}</span>
                      ) : lastMsg ? (
                        <>
                          {(lastMsg.senderId === currentUser?.id || lastMsg.senderId === 'current') && <span className="you-prefix">Вы: </span>}
                          {lastMsg.text}
                        </>
                      ) : (
                        <span className="empty-chat-msg">Нет сообщений</span>
                      )}
                    </p>

                    <div className="chat-badges">
                      {!chat.notifications && <VolumeX size={14} className="mute-icon" />}
                      {chat.pinned && <Pin size={14} className="pinned-icon" />}
                      {unreadCount > 0 && (
                        <span className="unread-badge">{unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
