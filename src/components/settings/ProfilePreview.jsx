import React from 'react';
import styles from './ProfilePreview.module.css';

export default function ProfilePreview({
  currentUser,
  renderAvatar,
  avatarFallback,
  displayName,
  username,
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
        <span className={styles.bannerFallback} aria-hidden="true" />
        <span className={styles.bannerLight} aria-hidden="true" />
      </div>

      <div className={styles.body}>
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

        <div className={styles.identity}>
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
