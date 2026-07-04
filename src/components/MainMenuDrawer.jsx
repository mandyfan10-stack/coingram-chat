import React, { useRef, useEffect, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { isSupabaseConfigured, supabase } from '../supabaseClient';
import { 
  UserCircle, 
  Users, 
  Megaphone, 
  Bookmark, 
  Settings, 
  Moon, 
  MoreVertical, 
  ChevronDown,
  X 
} from 'lucide-react';

export default function MainMenuDrawer() {
  const {
    currentUser,
    isDrawerOpen,
    setIsDrawerOpen,
    setIsSettingsOpen,
    setIsNewChatOpen,
    isDarkMode,
    setIsDarkMode,
    chats,
    setChats,
    setActiveChatId,
    fetchChats,
    updateProfile,
    setSettingsTab,
    setNewChatModalTab,
    renderAvatar
  } = useChat();

  const drawerRef = useRef(null);

  // Close drawer on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, setIsDrawerOpen]);

  const [isUploading, setIsUploading] = useState(false);
  const [isOpeningSaved, setIsOpeningSaved] = useState(false);
  const avatarInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploading(true);
      try {
        if (isSupabaseConfigured) {
          const fileExt = file.name.split('.').pop() || 'jpg';
          const fileName = `${currentUser.id}/avatar_${Date.now()}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, file);

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(fileName);

          await updateProfile({ avatar: publicUrl });
        } else {
          const reader = new FileReader();
          reader.onload = async (event) => {
            await updateProfile({ avatar: event.target.result });
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error("Avatar upload failed", err);
        alert(`Ошибка при загрузке аватара: ${err.message || err}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  if (!currentUser) return null;

  const handleOpenSavedMessages = async () => {
    if (isOpeningSaved) return;
    setIsOpeningSaved(true);

    try {
      // Find if we already have a chat with name "Избранное"
      const existing = chats.find(c => c.name === 'Избранное' && c.type === 'personal' && c.members.length === 1);
      if (existing) {
        setActiveChatId(existing.id);
        setIsDrawerOpen(false);
        setIsOpeningSaved(false);
        return;
      }

      if (isSupabaseConfigured) {
        // Double check database to prevent race conditions / duplicates
        const { data: dbExisting, error: checkErr } = await supabase
          .from('chats')
          .select('id')
          .eq('name', 'Избранное')
          .eq('type', 'personal')
          .eq('created_by', currentUser.id)
          .limit(1);

        if (dbExisting && dbExisting.length > 0) {
          if (fetchChats) await fetchChats();
          setActiveChatId(dbExisting[0].id);
          setIsDrawerOpen(false);
          setIsOpeningSaved(false);
          return;
        }

        // Create a personal chat named "Избранное" with ourselves
        const { data: newChat, error: chatErr } = await supabase
          .from('chats')
          .insert({
            name: 'Избранное',
            type: 'personal',
            avatar: '🔖',
            avatar_color: 'linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%)',
            created_by: currentUser.id
          })
          .select()
          .single();

        if (chatErr) throw chatErr;

        const { error: membersErr } = await supabase
          .from('chat_members')
          .insert({ chat_id: newChat.id, profile_id: currentUser.id });

        if (membersErr) throw membersErr;

        if (fetchChats) await fetchChats();
        setActiveChatId(newChat.id);
        setIsDrawerOpen(false);
      } else {
        // Mock mode
        const newChat = {
          id: `chat-saved-${Date.now()}`,
          name: 'Избранное',
          type: 'personal',
          avatar: '🔖',
          avatarColor: 'linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%)',
          pinned: false,
          notifications: true,
          bio: 'Ваше личное хранилище для заметок и файлов',
          username: currentUser.username,
          members: [{ id: 'current', name: currentUser.name, avatar: '🪙' }],
          messages: []
        };
        if (setChats) setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setIsDrawerOpen(false);
      }
    } catch (e) {
      console.error("Failed to open/create Saved Messages chat", e);
    } finally {
      setIsOpeningSaved(false);
    }
  };

  const handleItemClick = (action) => {
    setIsDrawerOpen(false);
    setTimeout(() => {
      action();
    }, 150);
  };

  return (
    <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={() => setIsDrawerOpen(false)}>
      <div 
        className={`drawer-container ${isDrawerOpen ? 'open' : ''}`} 
        onClick={(e) => e.stopPropagation()}
        ref={drawerRef}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-top">
            <div 
              className="drawer-user-avatar" 
              style={{ background: currentUser.avatarColor, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
              onClick={() => avatarInputRef.current?.click()}
              title="Загрузить фото профиля"
            >
              {renderAvatar(currentUser.avatar, '🪙')}
              {isUploading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '10px' }}>
                  ...
                </div>
              )}
            </div>
            <button className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)}>
              <X size={18} />
            </button>
          </div>
          
          <div className="drawer-user-info-row">
            <div className="drawer-user-meta">
              <span className="drawer-user-name">{currentUser.name}</span>
              <button 
                className="drawer-status-btn"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Загрузка...' : 'Обновить фото'}
              </button>
              <input 
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </div>
            <div className="drawer-header-actions">
              <button 
                className="drawer-icon-btn" 
                onClick={() => handleItemClick(() => {
                  setSettingsTab('settings');
                  setIsSettingsOpen(true);
                })}
                title="Настройки"
              >
                <MoreVertical size={16} />
              </button>
              <button 
                className="drawer-icon-btn"
                onClick={() => handleItemClick(() => {
                  setSettingsTab('profile');
                  setIsSettingsOpen(true);
                })}
                title="Редактировать профиль"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Menu List */}
        <div className="drawer-menu-list">
          
          {/* My Profile */}
          <button 
            className="drawer-menu-item"
            onClick={() => handleItemClick(() => {
              setSettingsTab('profile');
              setIsSettingsOpen(true);
            })}
          >
            <UserCircle size={20} className="drawer-item-icon" />
            <span className="drawer-item-text">Мой профиль</span>
          </button>

          {/* Create Group */}
          <button 
            className="drawer-menu-item"
            onClick={() => handleItemClick(() => {
              setNewChatModalTab('group');
              setIsNewChatOpen(true);
            })}
          >
            <Users size={20} className="drawer-item-icon" />
            <span className="drawer-item-text">Создать группу</span>
          </button>

          {/* Create Channel */}
          <button 
            className="drawer-menu-item"
            onClick={() => handleItemClick(() => {
              setNewChatModalTab('channel');
              setIsNewChatOpen(true);
            })}
          >
            <Megaphone size={20} className="drawer-item-icon" />
            <span className="drawer-item-text">Создать канал</span>
          </button>

          {/* Saved Messages */}
          <button 
            className="drawer-menu-item"
            onClick={handleOpenSavedMessages}
          >
            <Bookmark size={20} className="drawer-item-icon" />
            <span className="drawer-item-text">Избранное</span>
          </button>

          {/* Settings */}
          <button 
            className="drawer-menu-item"
            onClick={() => handleItemClick(() => {
              setSettingsTab('settings');
              setIsSettingsOpen(true);
            })}
          >
            <Settings size={20} className="drawer-item-icon" />
            <span className="drawer-item-text">Настройки</span>
          </button>

          {/* Night Mode Toggle */}
          <div className="drawer-menu-item no-hover-toggle">
            <div className="drawer-toggle-left">
              <Moon size={20} className="drawer-item-icon" />
              <span className="drawer-item-text">Ночной режим</span>
            </div>
            <label className="switch-toggle">
              <input 
                type="checkbox" 
                checked={isDarkMode} 
                onChange={(e) => setIsDarkMode(e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <span className="drawer-app-title">CoinGram Desktop</span>
          <span className="drawer-version">Версия 1.0.0 — О программе</span>
        </div>
      </div>
    </div>
  );
}
