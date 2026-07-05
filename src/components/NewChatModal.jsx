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

  // States for inviting members
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Debounced search effect for personal chat tab
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

  // Debounced search effect for members to invite (group/channel tabs)
  useEffect(() => {
    if (!currentUser || !isNewChatOpen || (newChatModalTab !== 'group' && newChatModalTab !== 'channel')) {
      setMemberResults([]);
      setMemberLoading(false);
      return;
    }

    if (!memberSearchQuery.trim()) {
      setMemberResults([]);
      setMemberLoading(false);
      return;
    }

    setMemberLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        if (isSupabaseConfigured) {
          const cleanQuery = memberSearchQuery.trim().toLowerCase();
          
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar, avatar_color, bio')
            .neq('id', currentUser.id)
            .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
            .limit(5);

          if (error) throw error;
          setMemberResults(data || []);
        } else {
          const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
          const cleanQuery = memberSearchQuery.trim().toLowerCase();
          const filtered = mockUsers.filter(u => 
            u.id !== currentUser.id && 
            (u.username.toLowerCase().includes(cleanQuery) || (u.name && u.name.toLowerCase().includes(cleanQuery)))
          );
          setMemberResults(filtered.slice(0, 5));
        }
      } catch (err) {
        console.error("Member search failed:", err);
      } finally {
        setMemberLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [memberSearchQuery, newChatModalTab, currentUser, isNewChatOpen]);

  // Clean form when modal closes/opens or tab changes
  useEffect(() => {
    if (!isNewChatOpen) {
      setSearchQuery('');
      setGroupName('');
      setChannelName('');
      setResults([]);
      setMemberSearchQuery('');
      setMemberResults([]);
      setSelectedMembers([]);
    }
  }, [isNewChatOpen, newChatModalTab]);

  if (!currentUser) return null;

  const handleSelectUser = async (user) => {
    setIsNewChatOpen(false);
    await createChat(user.username, 'personal');
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    
    setIsNewChatOpen(false);
    await createChat(groupName.trim(), 'group', selectedMembers);
  };

  const handleCreateChannelSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    
    setIsNewChatOpen(false);
    await createChat(channelName.trim(), 'channel', selectedMembers);
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

              {/* Invite Members section */}
              <div className="input-group">
                <label>Пригласить участников</label>
                {selectedMembers.length > 0 && (
                  <div className="selected-chips-container">
                    {selectedMembers.map(user => (
                      <div key={user.id} className="selected-chip">
                        <span className="chip-name">{user.display_name || user.username}</span>
                        <button
                          type="button"
                          className="chip-remove-btn"
                          onClick={() => setSelectedMembers(prev => prev.filter(u => u.id !== user.id))}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="search-container modal-search" style={{ marginBottom: '8px' }}>
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Поиск пользователей по имени..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                  />
                </div>

                {memberLoading ? (
                  <div className="search-status" style={{ padding: '8px 0' }}>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderColor: 'var(--text-secondary)', borderTopColor: 'var(--accent-color)' }} />
                    <span style={{ fontSize: '12px' }}>Поиск...</span>
                  </div>
                ) : memberSearchQuery.trim() !== '' && memberResults.length === 0 ? (
                  <div className="search-status" style={{ padding: '8px 0', fontSize: '12px' }}>
                    <span>Никто не найден</span>
                  </div>
                ) : memberResults.length > 0 ? (
                  <div className="search-results-list mini" style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {memberResults.map(user => {
                      const isSelected = selectedMembers.some(u => u.id === user.id);
                      return (
                        <div
                          key={user.id}
                          className={`search-user-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMembers(prev => prev.filter(u => u.id !== user.id));
                            } else {
                              setSelectedMembers(prev => [...prev, user]);
                            }
                            setMemberSearchQuery('');
                            setMemberResults([]);
                          }}
                          style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <div className="chat-avatar" style={{ background: user.avatar_color || 'var(--accent-gradient)', width: '28px', height: '28px', minWidth: '28px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                            {renderAvatar(user.avatar, '👤')}
                          </div>
                          <div className="search-user-info" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                            <span className="search-user-name" style={{ fontSize: '13px', fontWeight: '500' }}>{user.display_name || user.username}</span>
                            <span className="search-user-username" style={{ fontSize: '11px', opacity: 0.7 }}>@{user.username}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            style={{ cursor: 'pointer' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
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

              {/* Invite Subscribers section */}
              <div className="input-group">
                <label>Пригласить подписчиков</label>
                {selectedMembers.length > 0 && (
                  <div className="selected-chips-container">
                    {selectedMembers.map(user => (
                      <div key={user.id} className="selected-chip">
                        <span className="chip-name">{user.display_name || user.username}</span>
                        <button
                          type="button"
                          className="chip-remove-btn"
                          onClick={() => setSelectedMembers(prev => prev.filter(u => u.id !== user.id))}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="search-container modal-search" style={{ marginBottom: '8px' }}>
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Поиск пользователей по имени..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                  />
                </div>

                {memberLoading ? (
                  <div className="search-status" style={{ padding: '8px 0' }}>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderColor: 'var(--text-secondary)', borderTopColor: 'var(--accent-color)' }} />
                    <span style={{ fontSize: '12px' }}>Поиск...</span>
                  </div>
                ) : memberSearchQuery.trim() !== '' && memberResults.length === 0 ? (
                  <div className="search-status" style={{ padding: '8px 0', fontSize: '12px' }}>
                    <span>Никто не найден</span>
                  </div>
                ) : memberResults.length > 0 ? (
                  <div className="search-results-list mini" style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {memberResults.map(user => {
                      const isSelected = selectedMembers.some(u => u.id === user.id);
                      return (
                        <div
                          key={user.id}
                          className={`search-user-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMembers(prev => prev.filter(u => u.id !== user.id));
                            } else {
                              setSelectedMembers(prev => [...prev, user]);
                            }
                            setMemberSearchQuery('');
                            setMemberResults([]);
                          }}
                          style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <div className="chat-avatar" style={{ background: user.avatar_color || 'var(--accent-gradient)', width: '28px', height: '28px', minWidth: '28px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                            {renderAvatar(user.avatar, '👤')}
                          </div>
                          <div className="search-user-info" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                            <span className="search-user-name" style={{ fontSize: '13px', fontWeight: '500' }}>{user.display_name || user.username}</span>
                            <span className="search-user-username" style={{ fontSize: '11px', opacity: 0.7 }}>@{user.username}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            style={{ cursor: 'pointer' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
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
