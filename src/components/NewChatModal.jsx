import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { X, Search, UserPlus, Users, MessageSquare } from 'lucide-react';

export default function NewChatModal() {
  const {
    isNewChatOpen,
    setIsNewChatOpen,
    createChat,
    currentUser,
    newChatModalTab,
    renderAvatar
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (!currentUser || !isNewChatOpen || newChatModalTab !== 'personal') {
      setResults([]);
      setLoading(false);
      return;
    }

    if (!searchQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        if (isSupabaseConfigured) {
          const cleanQuery = searchQuery.trim().toLowerCase();
          
          // Search in Supabase profiles
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar, avatar_color, bio')
            .neq('id', currentUser.id) // Exclude myself
            .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
            .limit(5);

          if (error) throw error;
          setResults(data || []);
        } else {
          // Search in Mock local storage users
          const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
          const cleanQuery = searchQuery.trim().toLowerCase();
          const filtered = mockUsers.filter(u => 
            u.id !== currentUser.id && 
            (u.username.toLowerCase().includes(cleanQuery) || (u.name && u.name.toLowerCase().includes(cleanQuery)))
          );
          setResults(filtered.slice(0, 5));
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, newChatModalTab, currentUser, isNewChatOpen]);

  // Clean form when modal closes/opens
  useEffect(() => {
    if (!isNewChatOpen) {
      setSearchQuery('');
      setGroupName('');
      setChannelName('');
      setResults([]);
    }
  }, [isNewChatOpen]);

  if (!currentUser) return null;

  const handleSelectUser = async (user) => {
    setIsNewChatOpen(false);
    await createChat(user.username, 'personal');
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    
    setIsNewChatOpen(false);
    await createChat(groupName.trim(), 'group');
  };

  const handleCreateChannelSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    
    setIsNewChatOpen(false);
    await createChat(channelName.trim(), 'channel');
  };

  const getTitle = () => {
    if (newChatModalTab === 'group') return 'Создать группу';
    if (newChatModalTab === 'channel') return 'Создать канал';
    return 'Новый чат';
  };

  return (
    <div className={`settings-modal-overlay ${isNewChatOpen ? 'open' : ''}`}>
      <div className="new-chat-container">
        {/* Header */}
        <div className="settings-header">
          <h3>{getTitle()}</h3>
          <button className="settings-close-btn" onClick={() => setIsNewChatOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="new-chat-body">
          {newChatModalTab === 'personal' && (
            <div className="personal-chat-search">
              <div className="search-container modal-search">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Введите имя или никнейм пользователя..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Results list */}
              <div className="search-results-list">
                {loading ? (
                  <div className="search-status">
                    <div className="spinner" style={{ width: '22px', height: '22px', borderColor: 'var(--text-secondary)', borderTopColor: 'var(--accent-color)' }} />
                    <span>Поиск пользователей...</span>
                  </div>
                ) : searchQuery.trim() === '' ? (
                  <div className="search-status-info">
                    <MessageSquare size={32} className="info-icon" />
                    <p>Начните вводить никнейм, чтобы найти собеседника</p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="search-status">
                    <span>Пользователь не найден</span>
                  </div>
                ) : (
                  results.map(user => (
                    <div
                      key={user.id}
                      className="search-user-item"
                      onClick={() => handleSelectUser(user)}
                    >
                      <div className="chat-avatar" style={{ background: user.avatar_color || 'var(--accent-gradient)' }}>
                        {renderAvatar(user.avatar, '👤')}
                      </div>
                      <div className="search-user-info">
                        <span className="search-user-name">{user.display_name || user.username}</span>
                        <span className="search-user-username">@{user.username}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {newChatModalTab === 'group' && (
            <form onSubmit={handleCreateGroupSubmit} className="group-chat-create-form">
              <div className="input-group">
                <label htmlFor="groupName">Название группового чата *</label>
                <input
                  id="groupName"
                  type="text"
                  placeholder="Например: Обсуждение проекта 🚀"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              
              <button type="submit" className="group-submit-btn" disabled={!groupName.trim()}>
                <Users size={18} />
                <span>Создать группу</span>
              </button>
            </form>
          )}

          {newChatModalTab === 'channel' && (
            <form onSubmit={handleCreateChannelSubmit} className="group-chat-create-form">
              <div className="input-group">
                <label htmlFor="channelName">Название канала *</label>
                <input
                  id="channelName"
                  type="text"
                  placeholder="Например: Новости CoinGram 🌊"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              
              <button type="submit" className="group-submit-btn" disabled={!channelName.trim()} style={{ background: 'var(--accent-gradient)' }}>
                <Users size={18} />
                <span>Создать канал</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
