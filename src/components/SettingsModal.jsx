import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useE2EE } from '../context/E2EEContext';
import './SettingsModal.css';
import { isSupabaseConfigured, supabase } from '../supabaseClient';
import { X } from 'lucide-react';
import ProfileTab from './settings/ProfileTab';
import AppearanceTab from './settings/AppearanceTab';
import StickersTab from './settings/StickersTab';
import E2EETab from './settings/E2EETab';

const TAB_TITLES = {
  profile: 'Профиль',
  settings: 'Настройки',
  stickers: 'Стикеры',
  e2ee: 'Шифрование'
};

export default function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    theme,
    setTheme,
    wallpaper,
    setWallpaper,
    settingsTab,
    setSettingsTab,
    renderAvatar,
    installedStickers,
    importStickerPack
  } = useChat();

  const { currentUser, updateProfile, updateEmail, logOut } = useAuth();
  const { e2eePrivateKey, resetE2EE } = useE2EE();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState({ text: '', type: null });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [notif, setNotif] = useState(true);
  const [copied, setCopied] = useState(false);

  const [stickerPackInput, setStickerPackInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState({ text: '', type: null });

  const handleImportStickers = async () => {
    let packName = stickerPackInput.trim();
    if (!packName) return;

    if (packName.includes('addstickers/')) {
      packName = packName.split('addstickers/').pop().split('?')[0].split('#')[0];
    } else if (packName.includes('t.me/')) {
      packName = packName.split('t.me/').pop().split('?')[0].split('#')[0];
    }

    setImportLoading(true);
    setImportStatus({ text: '', type: null });
    try {
      const res = await importStickerPack(packName);
      if (res.error) {
        setImportStatus({ text: res.error, type: 'error' });
      } else {
        setImportStatus({ text: `Пак "${res.title}" успешно импортирован!`, type: 'success' });
        setStickerPackInput('');
      }
    } catch (e) {
      setImportStatus({ text: `Ошибка импорта: ${e.message}`, type: 'error' });
    } finally {
      setImportLoading(false);
    }
  };

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
          const { error } = await supabase.storage
            .from('public-media')
            .upload(fileName, file);

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('public-media')
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
        console.error('Avatar upload failed', err);
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
          const { error } = await supabase.storage
            .from('public-media')
            .upload(fileName, file);

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('public-media')
            .getPublicUrl(fileName);

          setWallpaper(publicUrl);
          setCustomWallpaperUrl(publicUrl);
        } else {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setWallpaper(ev.target.result);
            setCustomWallpaperUrl(ev.target.result);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error('Wallpaper upload failed', err);
        alert(`Ошибка при загрузке: ${err.message || err}`);
      } finally {
        setIsUploadingWallpaper(false);
      }
    }
  };

  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState({ text: '', type: null });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (currentUser && isSettingsOpen) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setEmailStatus({ text: '', type: null });
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
      setPasswordStatus({ text: '', type: null });
    }
  }, [currentUser, isSettingsOpen]);

  if (!currentUser) return null;

  const handleSave = async () => {
    setSettingsSaving(true);
    setEmailStatus({ text: '', type: null });
    try {
      const currentEmail = String(currentUser.email || '').trim().toLowerCase();
      const nextEmail = String(email || '').trim().toLowerCase();

      if (nextEmail !== currentEmail) {
        const result = await updateEmail(nextEmail);
        if (result.error) {
          setEmailStatus({ text: result.error.message, type: 'error' });
          return;
        }
        setEmailStatus({ text: 'Письмо для подтверждения нового email отправлено.', type: 'success' });
      }

      await updateProfile({
        name,
        bio,
        notificationsEnabled: notif,
        theme,
        wallpaper
      });
      setIsSettingsOpen(false);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `https://mandyfan10-stack.github.io/coingram-chat/?invite=${currentUser.username}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoutClick = async () => {
    if (window.confirm('Вы уверены, что хотите выйти из аккаунта?')) {
      setIsSettingsOpen(false);
      await logOut();
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ text: 'Пароли не совпадают!', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ text: 'Пароль должен быть не менее 6 символов!', type: 'error' });
      return;
    }

    setPasswordLoading(true);
    setPasswordStatus({ text: '', type: null });
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordStatus({ text: 'Пароль успешно изменен!', type: 'success' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordStatus({ text: `Ошибка: ${err.message}`, type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className={`settings-modal-overlay ${isSettingsOpen ? 'open' : ''}`}>
      <div className="settings-container">
        <div className="settings-header">
          <h3>{TAB_TITLES[settingsTab] || 'Настройки'}</h3>
          <button className="settings-close-btn" onClick={() => setIsSettingsOpen(false)}>
            <X size={20} />
          </button>
        </div>

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
          <button
            type="button"
            className={`settings-tab-btn ${settingsTab === 'stickers' ? 'active' : ''}`}
            onClick={() => setSettingsTab('stickers')}
          >
            Стикеры
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${settingsTab === 'e2ee' ? 'active' : ''}`}
            onClick={() => setSettingsTab('e2ee')}
          >
            Шифрование
          </button>
        </div>

        <div className="settings-body">
          {settingsTab === 'profile' && (
            <ProfileTab
              currentUser={currentUser}
              renderAvatar={renderAvatar}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              emailStatus={emailStatus}
              emailLoading={settingsSaving}
              emailEditable={isSupabaseConfigured}
              bio={bio}
              setBio={setBio}
              copied={copied}
              handleCopyInviteLink={handleCopyInviteLink}
              avatarInputRef={avatarInputRef}
              handleAvatarUpload={handleAvatarUpload}
              isUploadingAvatar={isUploadingAvatar}
            />
          )}

          {settingsTab === 'settings' && (
            <AppearanceTab
              theme={theme}
              setTheme={setTheme}
              wallpaper={wallpaper}
              setWallpaper={setWallpaper}
              customWallpaperUrl={customWallpaperUrl}
              setCustomWallpaperUrl={setCustomWallpaperUrl}
              notif={notif}
              setNotif={setNotif}
              currentUser={currentUser}
              email={email}
              setEmail={setEmail}
              emailStatus={emailStatus}
              emailLoading={settingsSaving}
              emailEditable={isSupabaseConfigured}
              wallpaperInputRef={wallpaperInputRef}
              handleWallpaperUpload={handleWallpaperUpload}
              isUploadingWallpaper={isUploadingWallpaper}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              passwordStatus={passwordStatus}
              passwordLoading={passwordLoading}
              handlePasswordChange={handlePasswordChange}
              handleLogoutClick={handleLogoutClick}
            />
          )}

          {settingsTab === 'stickers' && (
            <StickersTab
              stickerPackInput={stickerPackInput}
              setStickerPackInput={setStickerPackInput}
              importLoading={importLoading}
              importStatus={importStatus}
              handleImportStickers={handleImportStickers}
              installedStickers={installedStickers}
            />
          )}

          {settingsTab === 'e2ee' && (
            <E2EETab
              currentUser={currentUser}
              e2eePrivateKey={e2eePrivateKey}
              setIsSettingsOpen={setIsSettingsOpen}
              resetE2EE={resetE2EE}
            />
          )}
        </div>

        <div className="settings-footer">
          <button className="settings-btn cancel" onClick={() => setIsSettingsOpen(false)}>
            Отмена
          </button>
          <button className="settings-btn save" onClick={handleSave} disabled={settingsSaving}>
            {settingsSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
