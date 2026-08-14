import React from 'react';
import { UserCircle, Copy, Upload } from 'lucide-react';

export default function ProfileTab({
  currentUser,
  renderAvatar,
  name,
  setName,
  email,
  setEmail,
  emailStatus,
  emailLoading,
  emailEditable,
  bio,
  setBio,
  copied,
  handleCopyInviteLink,
  avatarInputRef,
  handleAvatarUpload,
  isUploadingAvatar
}) {
  return (
    <>
            <>
              {/* Avatar Section */}
              <div className="settings-avatar-section">
                <div 
                  className="currentUser-avatar" 
                  style={{ background: currentUser.avatarColor, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  onClick={() => avatarInputRef.current?.click()}
                  title="Загрузить новое фото"
                >
                  {renderAvatar(currentUser.avatar, <UserCircle size={44} color="#ffffff" />)}
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
              <label htmlFor="email-input">Email</label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={!emailEditable || emailLoading}
              />
              <span className="input-help-text">
                После изменения потребуется подтвердить новый адрес по ссылке из письма.
              </span>
              {emailStatus.text && (
                <span className="input-help-text" style={{ color: emailStatus.type === 'error' ? '#ff4d4f' : '#2ecc71' }}>
                  {emailStatus.text}
                </span>
              )}
            </div>

            <div className="input-group">
              <label>Ссылка для приглашения</label>
              <div className="invite-link-wrapper">
                <input
                  type="text"
                  value={`https://mandyfan10-stack.github.io/coingram-chat/?invite=${currentUser.username}`}
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
    </>
  );
}
