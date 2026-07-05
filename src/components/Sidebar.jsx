import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Menu, Search, Pin, VolumeX, MessageSquare, User, Users, Megaphone, Bot, MessageSquarePlus, Eye, Plus } from 'lucide-react';

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
    renderAvatar,
    createChat
  } = useChat();

  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [showMyStoriesMenu, setShowMyStoriesMenu] = useState(false);
  const storiesTrayRef = useRef(null);

  // Translate vertical wheel scroll to horizontal scroll on stories tray
  useEffect(() => {
    const el = storiesTrayRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => {
      setShowMyStoriesMenu(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Debounced global username search
  useEffect(() => {
    if (!currentUser || !searchQuery.trim()) {
      setGlobalResults([]);
      setGlobalLoading(false);
      return;
    }

    const cleanQuery = searchQuery.trim().toLowerCase().replace('@', '');
    if (cleanQuery.length < 3) {
      setGlobalResults([]);
      setGlobalLoading(false);
      return;
    }

    setGlobalLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar, avatar_color, bio')
            .neq('id', currentUser.id) // Exclude myself
            .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
            .limit(5);

          if (error) throw error;
          
          // Filter out users we already have a personal chat with
          const existingUserIds = chats
            .filter(c => c.type === 'personal')
            .flatMap(c => c.members.map(m => m.id));
          
          const filtered = (data || []).filter(u => !existingUserIds.includes(u.id));
          setGlobalResults(filtered);
        } else {
          const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
          const filtered = mockUsers.filter(u => 
            u.id !== currentUser.id && 
            (u.username.toLowerCase().includes(cleanQuery) || (u.name && u.name.toLowerCase().includes(cleanQuery)))
          );
          
          const existingUserIds = chats
            .filter(c => c.type === 'personal')
            .flatMap(c => c.members.map(m => m.id));
          
          const finalFiltered = filtered.filter(u => !existingUserIds.includes(u.id));
          setGlobalResults(finalFiltered.slice(0, 5));
        }
      } catch (err) {
        console.error("Global search failed:", err);
      } finally {
        setGlobalLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, currentUser, chats]);

  const handleSelectGlobalUser = async (user) => {
    setSearchQuery('');
    setGlobalResults([]);
    await createChat(user.username, 'personal');
  };

  // Filter chats by folder and query
  const filteredChats = chats.filter(chat => {
    // 1. Filter by Folder
    if (activeFolder === 'personal' && chat.type !== 'personal') return false;
    if (activeFolder === 'groups' && chat.type !== 'group') return false;
    if (activeFolder === 'channels' && chat.type !== 'channel') return false;

    // 2. Filter by Search Query
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase().replace('@', '');
    const nameMatch = chat.name.toLowerCase().includes(query);
    const usernameMatch = chat.username && chat.username.toLowerCase().includes(query);
    const msgMatch = chat.messages.some(m => m.text.toLowerCase().includes(query));
    return nameMatch || usernameMatch || msgMatch;
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
          { id: 'channels', name: 'Каналы' }
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
      <div className="stories-tray" ref={storiesTrayRef}>
        {(() => {
          const myStoriesList = stories.filter(s => s.userId === currentUser?.id);
          const hasMyStories = myStoriesList.length > 0;
          const hasUnviewedMyStories = myStoriesList.some(s => !s.viewed);
          
          return (
            <div 
              className="story-item current-user-story" 
              style={{ position: 'relative' }}
              onClick={(e) => {
                e.stopPropagation();
                if (hasMyStories) {
                  setShowMyStoriesMenu(prev => !prev);
                } else {
                  setIsCreateStoryOpen(true);
                }
              }}
            >
              <div className={`story-avatar-wrapper ${hasMyStories ? (hasUnviewedMyStories ? 'unviewed' : 'viewed') : 'plus-icon'}`}>
                <span className="story-avatar-initials" style={{ padding: 0 }}>
                  {renderAvatar(currentUser?.avatar, '🪙')}
                </span>
              </div>
              <span className="story-username">Моя история</span>
            </div>
          );
        })()}
        
        {(() => {
          const otherStories = stories.filter(s => s.userId !== currentUser?.id);
          const groupedStories = [];
          const seenUsers = new Set();

          for (const story of otherStories) {
            if (!seenUsers.has(story.userId)) {
              seenUsers.add(story.userId);
              const userStories = otherStories.filter(s => s.userId === story.userId);
              const hasUnviewed = userStories.some(s => !s.viewed);
              const storyToOpen = userStories.find(s => !s.viewed) || userStories[0];
              
              groupedStories.push({
                ...story,
                hasUnviewed,
                storyToOpenId: storyToOpen.id
              });
            }
          }

          return groupedStories.map(story => (
            <div
              key={story.userId}
              className={`story-item ${story.hasUnviewed ? 'unviewed' : 'viewed'}`}
              onClick={() => viewStory(story.storyToOpenId)}
            >
              <div className="story-avatar-wrapper">
                <span className="story-avatar-initials" style={{ padding: 0 }}>
                  {renderAvatar(story.userAvatar, '🪙')}
                </span>
              </div>
              <span className="story-username">{story.userName}</span>
            </div>
          ));
        })()}
      </div>

      {/* Chat List */}
      <div className="chat-list">
        {searchQuery.trim() !== '' && (
          <div className="search-section-header" style={{ padding: '8px 16px 4px 16px', fontSize: '11px', fontWeight: '600', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Чаты и контакты
          </div>
        )}

        {sortedChats.length === 0 ? (
          <div className="no-chats" style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Ничего не найдено</div>
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

        {searchQuery.trim() !== '' && (
          <>
            <div className="search-section-header" style={{ padding: '16px 16px 4px 16px', borderTop: '1px solid var(--border-color)', marginTop: '8px', fontSize: '11px', fontWeight: '600', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Глобальный поиск
            </div>
            
            {globalLoading ? (
              <div className="search-status" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span>Ищем в сети...</span>
              </div>
            ) : globalResults.length === 0 ? (
              <div className="no-chats" style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {searchQuery.trim().replace('@', '').length < 3 ? 'Введите не менее 3 символов' : 'Пользователи не найдены'}
              </div>
            ) : (
              globalResults.map(user => (
                <div
                  key={user.id}
                  className="chat-item"
                  onClick={() => handleSelectGlobalUser(user)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="chat-avatar" style={{ background: user.avatar_color || 'var(--accent-gradient)' }}>
                    {renderAvatar(user.avatar, '👤')}
                  </div>
                  <div className="chat-info-block">
                    <div className="chat-info-header">
                      <span className="chat-name">{user.display_name || user.username}</span>
                    </div>
                    <div className="chat-info-body">
                      <p className="chat-last-message" style={{ color: 'var(--accent-color)' }}>
                        @{user.username}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {showMyStoriesMenu && (() => {
        const myStoriesList = stories.filter(s => s.userId === currentUser?.id);
        return (
          <div className="my-stories-dropdown" style={{ top: '172px', left: '12px' }} onClick={(e) => e.stopPropagation()}>
            <button 
              type="button"
              className="my-stories-dropdown-btn" 
              onClick={() => {
                setShowMyStoriesMenu(false);
                const storyToOpen = myStoriesList.find(s => !s.viewed) || myStoriesList[0];
                if (storyToOpen) viewStory(storyToOpen.id);
              }}
            >
              <Eye size={16} /> Посмотреть
            </button>
            <button 
              type="button"
              className="my-stories-dropdown-btn" 
              onClick={() => {
                setShowMyStoriesMenu(false);
                setIsCreateStoryOpen(true);
              }}
            >
              <Plus size={16} /> Добавить
            </button>
          </div>
        );
      })()}
    </aside>
  );
}
