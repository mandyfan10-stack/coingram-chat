import React from 'react';
import {
  Check,
  Bell,
  Palette,
  Image as ImageIcon,
  Upload,
  Smartphone
} from 'lucide-react';
import { requestNotificationPermission } from '../../services/notificationService';
import { SETTINGS_THEMES as themes, SETTINGS_WALLPAPERS as wallpapers } from './themesData';
import {
  isHapticsEnabled,
  setHapticsEnabled,
  triggerHaptic,
  HAPTIC_SUCCESS
} from '../../hooks/useMessageTouch';

export default function AppearanceTab({
  theme,
  setTheme,
  wallpaper,
  setWallpaper,
  customWallpaperUrl,
  setCustomWallpaperUrl,
  notif,
  setNotif,
  wallpaperInputRef,
  handleWallpaperUpload,
  isUploadingWallpaper
}) {
  return (
    <div className="settings-appearance-tab" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Theme Customizer */}
      <div className="settings-section">
        <h5 className="section-title">
          <Palette size={16} />
          <span>Цветовая тема</span>
        </h5>
        <div className="themes-grid">
          {themes.map((t) => (
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
        <h5 className="section-title">
          <ImageIcon size={16} />
          <span>Обои чата</span>
        </h5>
        <div className="wallpapers-grid">
          {wallpapers.map((w) => {
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

          <div className="wallpaper-upload-actions" style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn-primary auth-submit-btn"
              onClick={() => wallpaperInputRef.current?.click()}
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
        <h5 className="section-title">
          <Bell size={16} />
          <span>Уведомления</span>
        </h5>
        <div className="notif-toggle-row">
          <label htmlFor="notif-toggle">Звуковые и push-уведомления</label>
          <input
            type="checkbox"
            id="notif-toggle"
            checked={notif}
            onChange={async (e) => {
              const nextVal = e.target.checked;
              setNotif(nextVal);
              if (nextVal) {
                await requestNotificationPermission();
              }
            }}
          />
        </div>
      </div>

      {/* Haptics & Tactility Toggle */}
      <div className="settings-section">
        <h5 className="section-title">
          <Smartphone size={16} />
          <span>Тактильный отклик</span>
        </h5>
        <div className="notif-toggle-row">
          <label htmlFor="haptics-toggle">Вибрация и тактильная отдача на нажатия</label>
          <input
            type="checkbox"
            id="haptics-toggle"
            checked={isHapticsEnabled()}
            onChange={(e) => {
              const nextVal = e.target.checked;
              setHapticsEnabled(nextVal);
              if (nextVal) {
                triggerHaptic(HAPTIC_SUCCESS);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
