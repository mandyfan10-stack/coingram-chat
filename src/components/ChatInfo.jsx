import React, { useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { X, Phone, AlertCircle, FileText, ExternalLink, Image as ImageIcon, Check, Copy, Trash2, LogOut, Camera } from 'lucide-react';

export default function ChatInfo() {
  const {
    activeChat,
    isInfoOpen,
    setIsInfoOpen,
    setActiveChatId,
    renderAvatar,
    currentUser,
    deleteChat,
    clearChatMessages,
    updateChatAvatar,
    updateChatSettings,
    startCall,
    addMemberToChat,
    toggleMemberRole
  } = useChat();

  const [activeTab, setActiveTab] = useState('media');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeActionMemberId, setActiveActionMemberId] = useState(null);

  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!newMemberUsername.trim()) return;

    setAddingMember(true);
    setAddMemberError('');

    const targetUsername = newMemberUsername.startsWith('@') 
      ? newMemberUsername.substring(1) 
      : newMemberUsername;

    const res = await addMemberToChat(activeChat.id, targetUsername);
    setAddingMember(false);

    if (res.error) {
      setAddMemberError(res.error);
    } else {
      setNewMemberUsername('');
      alert("Участник успешно добавлен!");
    }
  };

  const isOwner = activeChat && currentUser && (
    activeChat.createdBy === currentUser.id ||
    (activeChat.createdBy === 'current') ||
    (!activeChat.createdBy && activeChat.type === 'group')
  );

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result;
        await updateChatAvatar(activeChat.id, base64data);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  const handleCopyShareLink = () => {
    const inviteLink = `https://mandyfan10-stack.github.io/coingram-chat/?invite=${activeChat.username || activeChat.id}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeChat) return null;

  // Extract files, media, and links dynamically from messages
  const mediaFiles = [];
  const docFiles = [];
  const linksList = [];

  if (activeChat && activeChat.messages) {
    activeChat.messages.forEach(m => {
      if (m.media) {
        // Simple check if it's an image
        const isImage = /\.(jpeg|jpg|gif|png|webp|svg)/i.test(m.media) || m.media.startsWith('data:image');
        if (isImage) {
          mediaFiles.push(m.media);
        } else {
          // Document file
          const filename = m.media.split('/').pop().split('_').slice(1).join('_') || 'Вложенный файл';
          docFiles.push({
            name: filename,
            size: 'Вложение',
            date: new Date(m.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })
          });
        }
      }

      // Extract URLs from text
      if (m.text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = m.text.match(urlRegex);
        if (matches) {
          matches.forEach(url => {
            try {
              const parsed = new URL(url);
              linksList.push({
                title: url,
                url: url,
                host: parsed.hostname
              });
            } catch (e) {
              // ignore
            }
          });
        }
      }
    });
  }

  // Preseeded mock data fallback only for demo chats to keep initial UI engaging
  const isPreseededMock = activeChat && ['chat-1', 'chat-2', 'chat-6'].includes(activeChat.id);
  if (isPreseededMock && mediaFiles.length === 0 && docFiles.length === 0 && linksList.length === 0) {
    mediaFiles.push(
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=300&q=80'
    );
    docFiles.push(
      { name: 'Архитектурный_план.pdf', size: '2.4 MB', date: 'Вчера, 12:44' },
      { name: 'Техническая_спецификация.docx', size: '840 KB', date: '28 июня, 17:02' },
      { name: 'Бюджет_проекта_2026.xlsx', size: '1.2 MB', date: '15 июня, 11:15' }
    );
    linksList.push(
      { title: 'Официальный сайт React', url: 'https://react.dev', host: 'react.dev' },
      { title: 'Документация Vite 6', url: 'https://vite.dev', host: 'vite.dev' },
      { title: 'DeepMind Advanced Coding', url: 'https://deepmind.google', host: 'deepmind.google' }
    );
  }

  const handleMemberClick = (member) => {
    const isMemberMe = member.id === 'current' || member.id === currentUser?.id;
    if (isOwner && !isMemberMe) {
      setActiveActionMemberId(prev => prev === member.id ? null : member.id);
    } else {
      if (member.id === 'current') return;
      if (member.id === 'alice') {
        setActiveChatId('chat-1'); // Alice's personal chat
      }
    }
  };

  return (
    <aside className={`chat-info ${isInfoOpen ? 'open' : ''}`}>
      <div className="chat-info-inner">
      {/* Top Header */}
      <div className="info-header">
        <h3>Информация</h3>
        <button className="info-close-btn" onClick={() => setIsInfoOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <div className="chat-info-scrollable">

      {/* Main Profile Info */}
      <div className="info-profile-section">
        {isOwner && (activeChat.type === 'group' || activeChat.type === 'channel') ? (
          <div 
            className="info-avatar-wrapper"
            onClick={() => fileInputRef.current?.click()}
            title="Сменить аватарку группы/канала"
          >
            <div className="chat-avatar info-avatar" style={{ background: activeChat.avatarColor }}>
              {renderAvatar(activeChat.avatar, activeChat.type === 'channel' ? '📢' : '👥')}
            </div>
            <div className="avatar-edit-overlay">
              <Camera size={18} />
              <span>Сменить фото</span>
            </div>
            {isUploading && (
              <div className="avatar-upload-loading">
                <span>...</span>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleAvatarChange}
            />
          </div>
        ) : (
          <div className="chat-avatar info-avatar" style={{ background: activeChat.avatarColor }}>
            {renderAvatar(activeChat.avatar, activeChat.type === 'channel' ? '📢' : '👥')}
          </div>
        )}
        <h3 className="info-name">{activeChat.name}</h3>
        <span className="info-status">{activeChat.lastSeen}</span>

        {/* Action icons */}
        {(activeChat.type === 'personal' || activeChat.type === 'group') && activeChat.name !== 'Избранное' && (
          <div className="info-actions">
            <button 
              className="info-action-btn" 
              title="Звонок" 
              onClick={() => startCall(activeChat.id)}
            >
              <Phone size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Bio / Meta Information */}
      <div className="info-metadata-section">
        {activeChat.username && (
          <div className="meta-row">
            <span className="meta-label">Имя пользователя</span>
            <span className="meta-value">@{activeChat.username}</span>
          </div>
        )}
        {(activeChat.type === 'group' || activeChat.type === 'channel') && (
          <div className="meta-row">
            <span className="meta-label">Ссылка для приглашения</span>
            <div className="meta-value-share">
              <span className="meta-value-link">{`https://mandyfan10-stack.github.io/coingram-chat/?invite=${activeChat.username || activeChat.id}`}</span>
              <button
                className={`info-share-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopyShareLink}
                title="Копировать ссылку"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
        {activeChat.bio && (
          <div className="meta-row">
            <span className="meta-label">О себе / Описание</span>
            <span className="meta-value">{activeChat.bio}</span>
          </div>
        )}
        {activeChat.type === 'group' && (
          <div className="meta-row">
            <span className="meta-label">Участники</span>
            <span className="meta-value">{activeChat.members.length} человек</span>
          </div>
        )}
      </div>

      {/* Media & Docs Tabs */}
      <div className="info-tabs">
        <button
          className={`info-tab ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
        >
          Медиа
        </button>
        <button
          className={`info-tab ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => setActiveTab('docs')}
        >
          Файлы
        </button>
        <button
          className={`info-tab ${activeTab === 'links' ? 'active' : ''}`}
          onClick={() => setActiveTab('links')}
        >
          Ссылки
        </button>
        {(activeChat.type === 'group' || (activeChat.type === 'channel' && activeChat.createdBy === currentUser?.id)) && (
          <button
            className={`info-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            {activeChat.type === 'channel' ? 'Подписчики' : 'Люди'}
          </button>
        )}
        {isOwner && (activeChat.type === 'group' || activeChat.type === 'channel') && (
          <button
            className={`info-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Настройки
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="info-tab-content">
        {activeTab === 'media' && (
          <div className="media-grid">
            {mediaFiles.map((url, idx) => (
              <a href={url} target="_blank" rel="noreferrer" key={idx} className="media-grid-item">
                <img src={url} alt={`Вложение ${idx + 1}`} />
              </a>
            ))}
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="docs-list">
            {docFiles.map((doc, idx) => (
              <div key={idx} className="doc-item">
                <div className="doc-icon-wrapper">
                  <FileText size={20} />
                </div>
                <div className="doc-details">
                  <span className="doc-name">{doc.name}</span>
                  <div className="doc-meta">
                    <span>{doc.size}</span>
                    <span className="dot">•</span>
                    <span>{doc.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'links' && (
          <div className="links-list">
            {linksList.map((link, idx) => (
              <a href={link.url} target="_blank" rel="noreferrer" key={idx} className="link-item">
                <div className="link-icon-wrapper">
                  <ExternalLink size={18} />
                </div>
                <div className="link-details">
                  <span className="link-title">{link.title}</span>
                  <span className="link-host">{link.host}</span>
                </div>
              </a>
            ))}
          </div>
        )}

        {activeTab === 'members' && (activeChat.type === 'group' || (activeChat.type === 'channel' && activeChat.createdBy === currentUser?.id)) && (
          <div className="members-list">
            {(isOwner || activeChat.settings?.allow_add_members !== false) && (activeChat.type === 'group' || (activeChat.type === 'channel' && activeChat.createdBy === currentUser?.id)) && (
              <div className="add-member-section">
                <form onSubmit={handleAddMemberSubmit} className="add-member-form">
                  <input
                    type="text"
                    placeholder="Добавить по @username..."
                    value={newMemberUsername}
                    onChange={(e) => setNewMemberUsername(e.target.value)}
                    className="add-member-input"
                  />
                  <button type="submit" className="add-member-btn" disabled={addingMember}>
                    {addingMember ? '...' : 'Добавить'}
                  </button>
                </form>
                {addMemberError && <span className="add-member-error">{addMemberError}</span>}
              </div>
            )}
            {activeChat.members && activeChat.members.map(member => {
              const isMemberOwner = member.id === activeChat.createdBy || 
                                    (member.id === 'current' && activeChat.createdBy === currentUser?.id) ||
                                    (member.id === currentUser?.id && activeChat.createdBy === 'current');
              
              const isMe = member.id === 'current' || member.id === currentUser?.id;
              
              let roleLabel = '';
              if (isMemberOwner) {
                roleLabel = isMe ? 'Владелец (Вы)' : 'Владелец';
              } else if (member.role === 'admin') {
                roleLabel = isMe ? 'Администратор (Вы)' : 'Администратор';
              } else if (isMe) {
                roleLabel = 'Вы';
              } else {
                roleLabel = activeChat.type === 'channel' ? 'Подписчик' : 'Участник';
              }

              const showMenu = activeActionMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className="member-row-item"
                  onClick={(e) => handleMemberClick(member)}
                  style={{ cursor: isOwner && !isMe ? 'pointer' : (member.id !== 'current' && member.id !== currentUser?.id ? 'pointer' : 'default') }}
                >
                  <div className="member-avatar">
                    {renderAvatar(member.avatar, '👤')}
                  </div>
                  <div className="member-info">
                    <span className="member-name">{member.name}</span>
                    <span className="member-role">{roleLabel}</span>
                  </div>

                  {showMenu && (
                    <div className="member-role-dropdown" onClick={(e) => e.stopPropagation()}>
                      <button 
                        type="button" 
                        className="member-dropdown-item"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setActiveActionMemberId(null);
                          await toggleMemberRole(activeChat.id, member.id, member.role);
                        }}
                      >
                        {member.role === 'admin' ? 'Снять права' : 'Сделать админом'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {activeTab === 'settings' && isOwner && (activeChat.type === 'group' || activeChat.type === 'channel') && (
          <div className="chat-settings-panel">
            <h4 className="settings-section-title">Разрешения для участников</h4>
            <div className="settings-list">
              {activeChat.type === 'group' && (
                <label className="settings-row">
                  <span className="settings-label-text">Только администраторы могут писать</span>
                  <div className="switch-wrapper">
                    <input
                      type="checkbox"
                      checked={!!activeChat.settings?.only_admins_can_post}
                      onChange={(e) => {
                        const newSettings = { ...activeChat.settings, only_admins_can_post: e.target.checked };
                        updateChatSettings(activeChat.id, newSettings);
                      }}
                    />
                    <span className="switch-slider"></span>
                  </div>
                </label>
              )}

              <label className="settings-row">
                <span className="settings-label-text">Разрешить отправку медиа (фото/аудио)</span>
                <div className="switch-wrapper">
                  <input
                    type="checkbox"
                    checked={activeChat.settings?.allow_media !== false}
                    onChange={(e) => {
                      const newSettings = { ...activeChat.settings, allow_media: e.target.checked };
                      updateChatSettings(activeChat.id, newSettings);
                    }}
                  />
                  <span className="switch-slider"></span>
                </div>
              </label>

              <label className="settings-row">
                <span className="settings-label-text">Разрешить добавление других участников</span>
                <div className="switch-wrapper">
                  <input
                    type="checkbox"
                    checked={activeChat.settings?.allow_add_members !== false}
                    onChange={(e) => {
                      const newSettings = { ...activeChat.settings, allow_add_members: e.target.checked };
                      updateChatSettings(activeChat.id, newSettings);
                    }}
                  />
                  <span className="switch-slider"></span>
                </div>
              </label>

              <label className="settings-row">
                <span className="settings-label-text">Разрешить закрепление сообщений</span>
                <div className="switch-wrapper">
                  <input
                    type="checkbox"
                    checked={activeChat.settings?.allow_pin_messages !== false}
                    onChange={(e) => {
                      const newSettings = { ...activeChat.settings, allow_pin_messages: e.target.checked };
                      updateChatSettings(activeChat.id, newSettings);
                    }}
                  />
                  <span className="switch-slider"></span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
      
      {/* Delete / Leave Chat Button */}
      {(() => {
        const isPersonal = activeChat.type === 'personal';
        const isCreator = activeChat.createdBy === currentUser?.id;
        const isSavedMessages = activeChat.name === 'Избранное';
        
        let buttonIcon = null;
        let buttonLabel = '';
        let confirmPrompt = '';

        if (isSavedMessages) {
          buttonLabel = 'Очистить историю';
          buttonIcon = <Trash2 size={18} />;
          confirmPrompt = 'Вы уверены, что хотите полностью очистить всю историю сообщений в Избранном? Сама папка Избранного сохранится.';
        } else if (isPersonal) {
          buttonLabel = 'Удалить чат';
          buttonIcon = <Trash2 size={18} />;
          confirmPrompt = 'Вы уверены, что хотите полностью удалить этот чат и всю историю сообщений? Это действие необратимо.';
        } else if (isCreator) {
          buttonLabel = activeChat.type === 'channel' ? 'Удалить канал' : 'Удалить группу';
          buttonIcon = <Trash2 size={18} />;
          confirmPrompt = activeChat.type === 'channel' 
            ? 'Вы уверены, что хотите удалить этот канал для всех участников? Вся история будет очищена.'
            : 'Вы уверены, что хотите удалить эту группу для всех участников? Вся история будет очищена.';
        } else {
          buttonLabel = activeChat.type === 'channel' ? 'Покинуть канал' : 'Выйти из группы';
          buttonIcon = <LogOut size={18} />;
          confirmPrompt = activeChat.type === 'channel'
            ? 'Вы уверены, что хотите покинуть этот канал?'
            : 'Вы уверены, что хотите выйти из этой группы?';
        }

        return (
          <div className="info-delete-section">
            <button 
              type="button"
              className="info-delete-row"
              onClick={async () => {
                if (window.confirm(confirmPrompt)) {
                  let success = false;
                  if (isSavedMessages) {
                    success = await clearChatMessages(activeChat.id);
                  } else {
                    success = await deleteChat(activeChat.id);
                  }
                  if (success) {
                    setIsInfoOpen(false);
                  }
                }
              }}
            >
              <span className="delete-row-icon">{buttonIcon}</span>
              <span className="delete-row-text">{buttonLabel}</span>
            </button>
          </div>
        );
      })()}
      </div>
      </div>
    </aside>
  );
}
