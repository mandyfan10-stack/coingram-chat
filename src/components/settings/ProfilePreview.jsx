import React from 'react';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import useResolvedMedia from '../../hooks/useResolvedMedia';
import styles from './ProfilePreview.module.css';

export default function ProfilePreview({
  currentUser,
  renderAvatar,
  avatarFallback,
  displayName,
  username,
  banner,
  onBannerClick,
  onBannerRemove,
  isUploadingBanner = false,
  variant = 'studio',
  status,
  action,
  onAvatarClick,
  avatarActionLabel = 'Изменить фото профиля',
  avatarActionDisabled = false,
  avatarOverlay,
  className = '',
}) {
  const resolvedName = displayName || currentUser?.name || currentUser?.username || 'Coiny User';
  const resolvedUsername = username || currentUser?.username || 'user';
  const rawBanner = banner !== undefined ? banner : currentUser?.banner;
  const { url: bannerUrl } = useResolvedMedia(rawBanner);
  const avatar = renderAvatar
    ? renderAvatar(currentUser?.avatar, avatarFallback)
    : avatarFallback;
  const avatarNode = (
    <div className={styles.avatar} style={{ background: currentUser?.avatarColor }}>
      {avatar}
    </div>
  );

  return (
    <article
      className={`${styles.preview} ${styles[variant]} ${className}`}
      data-testid="live-profile-preview"
      data-variant={variant}
    >
      <div className={styles.banner} data-testid="profile-preview-banner">
        {bannerUrl ? (
          <img src={bannerUrl} alt="Обложка профиля" className={styles.bannerImage} />
        ) : (
          <span className={styles.bannerFallback} aria-hidden="true" />
        )}
        <span className={styles.bannerLight} aria-hidden="true" />

        {(onBannerClick || onBannerRemove) && (
          <div className={styles.bannerActions}>
            {onBannerClick && (
              <button
                type="button"
                className={styles.bannerActionBtn}
                title={rawBanner ? 'Изменить обложку' : 'Загрузить обложку'}
                aria-label={rawBanner ? 'Изменить обложку' : 'Загрузить обложку'}
                onClick={(e) => {
                  e.stopPropagation();
                  onBannerClick();
                }}
                disabled={isUploadingBanner}
              >
                {isUploadingBanner ? (
                  <Loader2 size={15} className={styles.spinning} />
                ) : (
                  <Camera size={15} />
                )}
                <span>{rawBanner ? 'Изменить обложку' : 'Загрузить обложку'}</span>
              </button>
            )}
            {onBannerRemove && rawBanner && (
              <button
                type="button"
                className={`${styles.bannerActionBtn} ${styles.bannerDeleteBtn}`}
                title="Удалить обложку"
                aria-label="Удалить обложку"
                onClick={(e) => {
                  e.stopPropagation();
                  onBannerRemove();
                }}
                disabled={isUploadingBanner}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.body} data-testid="profile-preview-body">
        <div className={styles.avatarAnchor} data-testid="profile-preview-avatar">
          {onAvatarClick ? (
            <button
              type="button"
              className={styles.avatarButton}
              aria-label={avatarActionLabel}
              disabled={avatarActionDisabled}
              onClick={onAvatarClick}
            >
              {avatarNode}
              {avatarOverlay && <span className={styles.avatarOverlay}>{avatarOverlay}</span>}
            </button>
          ) : avatarNode}
        </div>

        <div className={styles.identity} data-testid="profile-preview-identity">
          <div className={styles.nameRow}>
            <strong title={resolvedName}>{resolvedName}</strong>
          </div>
          <span>@{resolvedUsername}</span>
        </div>

        {variant === 'full' && (
          <div className={styles.details}>
            <span>Обо мне</span>
            <p>{currentUser?.bio || 'Добавьте описание в настройках, чтобы рассказать о себе.'}</p>
          </div>
        )}

        {(status || action) && (
          <div className={styles.controls}>
            {status && <div className={styles.status}>{status}</div>}
            {action && <div className={styles.action}>{action}</div>}
          </div>
        )}
      </div>
    </article>
  );
}
