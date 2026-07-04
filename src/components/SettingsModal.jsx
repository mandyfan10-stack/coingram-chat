import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { isSupabaseConfigured, supabase } from '../supabaseClient';
import { X, Check, Bell, Palette, Image as ImageIcon, UserCircle, LogOut, Copy, Info, Lock, Trash2, Upload } from 'lucide-react';

export default function SettingsModal() {
  const {
    currentUser,
    isSettingsOpen,
    setIsSettingsOpen,
    theme,
    setTheme,
    wallpaper,
    setWallpaper,
    updateProfile,
    logOut,
    settingsTab,
    setSettingsTab,
    renderAvatar
  } = useChat();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [notif, setNotif] = useState(true);
  const [copied, setCopied] = useState(false);

  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false);
  const wallpaperInputRef = React.useRef(null);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef(null);

  const handleAvatarUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploadingAvatar(true);
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
        setIsUploadingAvatar(false);
      }
    }
  };

  const handleWallpaperUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploadingWallpaper(true);
      try {
        if (isSupabaseConfigured) {
          const fileExt = file.name.split('.').pop() || 'jpg';
          const fileName = `${currentUser.id}/wallpaper_${Date.now()}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, file);

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(fileName);

          setWallpaper(publicUrl);
          setCustomWallpaperUrl(publicUrl);
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            setWallpaper(e.target.result);
            setCustomWallpaperUrl(e.target.result);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error("Wallpaper upload failed", err);
        alert(`Ошибка при загрузке: ${err.message || err}`);
      } finally {
        setIsUploadingWallpaper(false);
      }
    }
  };
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Sync state with currentUser when modal opens
  useEffect(() => {
    if (currentUser && isSettingsOpen) {
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
      setNotif(currentUser.notificationsEnabled !== false);
      setCopied(false);
      
      const presets = ['classic', 'sunset', 'space', 'mint'];
      if (currentUser.wallpaper && !presets.includes(currentUser.wallpaper)) {
        setCustomWallpaperUrl(currentUser.wallpaper);
      } else {
        setCustomWallpaperUrl('');
      }
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('');
    }
  }, [currentUser, isSettingsOpen]);

  if (!currentUser) return null;

  const handleSave = () => {
    updateProfile({
      name,
      bio,
      notificationsEnabled: notif,
      theme,
      wallpaper
    });
    setIsSettingsOpen(false);
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/?invite=${currentUser.username}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoutClick = async () => {
    if (window.confirm("Вы уверены, что хотите выйти из аккаунта?")) {
      setIsSettingsOpen(false);
      await logOut();
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus('❌ Пароли не совпадают!');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus('❌ Пароль должен быть не менее 6 символов!');
      return;
    }
    
    setPasswordLoading(true);
    setPasswordStatus('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordStatus('✅ Пароль успешно изменен!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordStatus(`❌ Ошибка: ${err.message}`);
    } finally {
      setPasswordLoading(false);
    }
  };

  const themes = [
    { id: 'telegram-blue', name: 'Синий', color: '#2481cc' },
    { id: 'emerald-green', name: 'Изумруд', color: '#0f9d58' },
    { id: 'sakura-pink', name: 'Сакура', color: '#e07a5f' },
    { id: 'electric-purple', name: 'Фиолет', color: '#8a2be2' },
    { id: 'sunset-amber', name: 'Янтарь', color: '#d97706' },
    { id: 'rainbow-pearl', name: 'Радуга', color: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #00ccff, #8a2be2, #ff00ff)' }
  ];

  const wallpapers = [
    { id: 'classic', name: 'Классик', style: 'radial-gradient(circle, #f3f4f6 0%, #e5e7eb 100%)' },
    { id: 'sunset', name: 'Закат', style: 'linear-gradient(135deg, #fce38a 0%, #f38181 100%)' },
    { id: 'space', name: 'Космос', style: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
    { id: 'mint', name: 'Мята', style: 'linear-gradient(135deg, #a8ff78 0%, #78ffd6 100%)' }
  ];

  return (
    <div className={`settings-modal-overlay ${isSettingsOpen ? 'open' : ''}`}>
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          <h3>{settingsTab === 'profile' ? 'Профиль' : 'Настройки'}</h3>
          <button className="settings-close-btn" onClick={() => setIsSettingsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs navigation */}
        <div className="settings-tabs">
          <button 
            type="button" 
            className={`settings-tab-btn ${settingsTab === 'profile' ? 'active' : ''}`}
            onClick={() => setSettingsTab('profile')}
          >
            Профиль
          </button>
          <button 
            type="button" 
            className={`settings-tab-btn ${settingsTab === 'settings' ? 'active' : ''}`}
            onClick={() => setSettingsTab('settings')}
          >
            Настройки
          </button>
        </div>

        {/* Modal Body */}
        <div className="settings-body">
          {settingsTab === 'profile' ? (
            <>
              {/* Avatar Section */}
              <div className="settings-avatar-section">
                <div 
                  className="currentUser-avatar" 
                  style={{ background: currentUser.avatarColor, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  onClick={() => avatarInputRef.current?.click()}
                  title="Загрузить новое фото"
                >
                  {renderAvatar(currentUser.avatar, '🪙', currentUser.avatarColor || currentUser.avatar_color)}
                  <div className="avatar-upload-overlay" style={{ display: 'flex' }}>
                    <Upload size={18} />
                  </div>
                </div>
                <h4>{currentUser.name}</h4>
                <span>@{currentUser.username}</span>
                <input 
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
                {isUploadingAvatar && (
                  <span style={{ fontSize: '11px', color: 'var(--accent-color)' }}>Загрузка фото...</span>
                )}
              </div>

          {/* Profile Settings */}
          <div className="settings-section">
            <h5 className="section-title"><UserCircle size={16} /> Профиль</h5>
            
            <div className="input-group">
              <label htmlFor="name-input">Имя</label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
              />
            </div>

            <div className="input-group">
              <label htmlFor="username-input">Имя пользователя (@)</label>
              <input
                id="username-input"
                type="text"
                value={`@${currentUser.username}`}
                disabled
                className="disabled-input"
              />
            </div>

            <div className="input-group">
              <label>Ссылка для приглашения</label>
              <div className="invite-link-wrapper">
                <input
                  type="text"
                  value={`${window.location.origin}/?invite=${currentUser.username}`}
                  readOnly
                  className="invite-link-input"
                />
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className={`invite-copy-btn ${copied ? 'copied' : ''}`}
                >
                  <Copy size={14} />
                  <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </div>
              <span className="input-help-text">Отправьте эту ссылку друзьям, чтобы они могли начать чат с вами.</span>
            </div>

            <div className="input-group">
              <label htmlFor="bio-input">О себе</label>
              <textarea
                id="bio-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Напишите что-нибудь о себе..."
                rows={2}
              />
            </div>
          </div>
          </>
          ) : (
            <>

          {/* Theme Customizer */}
          <div className="settings-section">
            <h5 className="section-title"><Palette size={16} /> Цветовая тема</h5>
            <div className="themes-grid">
              {themes.map(t => (
                <button
                  key={t.id}
                  className={`theme-selection-btn ${theme === t.id ? 'active' : ''}`}
                  onClick={() => setTheme(t.id)}
                  style={{ '--theme-color': t.color }}
                  type="button"
                >
                  <span className="theme-color-dot" />
                  <span className="theme-color-name">{t.name}</span>
                  {theme === t.id && <Check size={14} className="theme-check-icon" />}
                </button>
              ))}
            </div>
          </div>

          {/* Wallpapers Customizer */}
          <div className="settings-section">
            <h5 className="section-title"><ImageIcon size={16} /> Обои чата</h5>
            <div className="wallpapers-grid">
              {wallpapers.map(w => {
                const isActive = wallpaper === w.id && customWallpaperUrl.trim() === '';
                return (
                  <button
                    key={w.id}
                    className={`wallpaper-selection-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setWallpaper(w.id);
                      setCustomWallpaperUrl('');
                    }}
                    style={{ background: w.style }}
                    type="button"
                  >
                    <span className="wallpaper-label">{w.name}</span>
                    {isActive && (
                      <div className="wallpaper-check-badge">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Custom Wallpaper File Upload */}
            <div className="input-group" style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Или загрузите свой файл обоев
              </label>
              
              <input
                ref={wallpaperInputRef}
                type="file"
                accept="image/*"
                onChange={handleWallpaperUpload}
                style={{ display: 'none' }}
              />
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-primary auth-submit-btn"
                  onClick={() => wallpaperInputRef.current.click()}
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  disabled={isUploadingWallpaper}
                >
                  <Upload size={14} />
                  <span>{isUploadingWallpaper ? 'Загрузка...' : 'Выбрать файл'}</span>
                </button>

                {customWallpaperUrl && (
                  <button
                    type="button"
                    className="logout-btn"
                    onClick={() => {
                      setWallpaper('classic');
                      setCustomWallpaperUrl('');
                    }}
                    style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', margin: 0 }}
                  >
                    Сбросить
                  </button>
                )}
              </div>
              
              {customWallpaperUrl && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Выбран кастомный фон чата
                </div>
              )}
            </div>
          </div>

          {/* Notifications Toggle */}
          <div className="settings-section">
            <h5 className="section-title"><Bell size={16} /> Уведомления</h5>
            <div className="notif-toggle-row">
              <label htmlFor="notif-toggle">Звуковые уведомления</label>
              <input
                type="checkbox"
                id="notif-toggle"
                checked={notif}
                onChange={(e) => setNotif(e.target.checked)}
              />
            </div>
          </div>

          {/* Change Password (Supabase only) */}
          {isSupabaseConfigured && (
            <div className="settings-section">
              <h5 className="section-title"><Lock size={16} /> Смена пароля</h5>
              <form onSubmit={handlePasswordChange} className="password-change-form">
                <div className="input-group">
                  <label htmlFor="new-password">Новый пароль</label>
                  <input
                    id="new-password"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group" style={{ marginTop: '10px' }}>
                  <label htmlFor="confirm-password">Подтвердите пароль</label>
                  <input
                    id="confirm-password"
                    type="password"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {passwordStatus && (
                  <div className="password-status-msg" style={{ marginTop: '8px', fontSize: '12.5px', fontWeight: '500' }}>
                    {passwordStatus}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={passwordLoading || !newPassword || !confirmPassword}
                  className="btn-primary auth-submit-btn"
                  style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px', width: 'auto' }}
                >
                  {passwordLoading ? 'Обновление...' : 'Обновить пароль'}
                </button>
              </form>
            </div>
          )}

          {/* Session Info */}
          <div className="settings-section">
            <h5 className="section-title"><Info size={16} /> Системная информация</h5>
            <div className="session-info-details" style={{ backgroundColor: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ваш UUID:</span>
                <span className="select-all-text" style={{ fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{currentUser.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Режим подключения:</span>
                <span style={{ fontWeight: '600', color: isSupabaseConfigured ? '#0f9d58' : '#d97706' }}>
                  {isSupabaseConfigured ? '🟢 Supabase (Live)' : '🟡 Локальный демо-режим'}
                </span>
              </div>
            </div>
          </div>

          {/* Reset Cache & Data Utility */}
          <div className="settings-section">
            <h5 className="section-title"><Trash2 size={16} style={{ color: '#ff4d4f' }} /> Сброс данных</h5>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Сбросит все локальные данные, удалит сохраненные учетные записи демонстрационного режима и выполнит выход.
            </p>
            <button
              type="button"
              className="logout-btn"
              onClick={() => {
                if (window.confirm("Вы уверены, что хотите сбросить кэш и данные приложения? Это действие необратимо.")) {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }
              }}
              style={{ borderColor: '#ff4d4f', color: '#ff4d4f', background: 'none' }}
            >
              <Trash2 size={16} />
              <span>Очистить кэш приложения</span>
            </button>
          </div>

          {/* Logout Section */}
          <div className="settings-section">
            <button type="button" className="logout-btn" onClick={handleLogoutClick}>
              <LogOut size={16} />
              <span>Выйти из аккаунта</span>
            </button>
          </div>
          </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="settings-footer">
          <button className="settings-btn cancel" onClick={() => setIsSettingsOpen(false)}>
            Отмена
          </button>
          <button className="settings-btn save" onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
