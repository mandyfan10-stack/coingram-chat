import React from 'react';
import {
  Check,
  Bell,
  Palette,
  Image as ImageIcon,
  LogOut,
  Info,
  Lock,
  Trash2,
  Upload,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { isSupabaseConfigured } from '../../supabaseClient';
import { SETTINGS_THEMES as themes, SETTINGS_WALLPAPERS as wallpapers } from './themesData';

export default function AppearanceTab({
  theme,
  setTheme,
  wallpaper,
  setWallpaper,
  customWallpaperUrl,
  setCustomWallpaperUrl,
  notif,
  setNotif,
  currentUser,
  wallpaperInputRef,
  handleWallpaperUpload,
  isUploadingWallpaper,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  passwordStatus,
  passwordLoading,
  handlePasswordChange,
  handleLogoutClick
}) {
  return (
    <>
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
                {passwordStatus.text && (
                  <div className="password-status-msg" style={{ marginTop: '8px', fontSize: '12.5px', fontWeight: '500', color: passwordStatus.type === 'error' ? '#ff4d4f' : '#2ecc71', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {passwordStatus.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                    <span>{passwordStatus.text}</span>
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
    </>
  );
}
