import React from 'react';
import { Users, Megaphone, Bookmark, User, Bot, CloudSun, Brain, Zap } from 'lucide-react';
import PrivateStorageImage from '../../components/PrivateStorageImage';

/**
 * Render chat/list avatar (URL, emoji, or premium icon container).
 */
export function renderAvatar(avatar, fallback = '👤') {
  const isUrl = avatar && (
    avatar.startsWith('http') || avatar.startsWith('data:image') || avatar.startsWith('storage://')
  );
  if (isUrl) {
    return (
      <PrivateStorageImage
        src={avatar}
        alt="avatar"
        fallback={fallback}
        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    );
  }

  const val = avatar || fallback;
  let bg = '';
  let icon = null;

  if (val === '👥' || val === 'group' || val === 'Group') {
    bg = 'linear-gradient(135deg, #3498db, #2980b9)';
    icon = <Users className="premium-avatar-icon" />;
  } else if (val === '📢' || val === 'channel' || val === 'Channel') {
    bg = 'linear-gradient(135deg, #b534fa, #e056fd)';
    icon = <Megaphone className="premium-avatar-icon" />;
  } else if (val === '🔖' || val === 'saved' || val === 'Saved Messages' || val === 'Избранное') {
    bg = 'linear-gradient(135deg, #34d399, #059669)';
    icon = <Bookmark className="premium-avatar-icon" fill="currentColor" />;
  } else if (val === '👤' || val === 'user') {
    bg = 'linear-gradient(135deg, #74b9ff, #0984e3)';
    icon = <User className="premium-avatar-icon" />;
  } else if (val === '🪙') {
    bg = 'linear-gradient(135deg, #f6d365, #fda085)';
    icon = <User className="premium-avatar-icon" />;
  } else if (val === '🤖' || val === 'bot') {
    bg = 'linear-gradient(135deg, #ff7675, #d63031)';
    icon = <Bot className="premium-avatar-icon" />;
  } else if (val === '🌤️' || val === 'weather') {
    bg = 'linear-gradient(135deg, #fdeb82, #f39c12)';
    icon = <CloudSun className="premium-avatar-icon" />;
  } else if (val === '🧠' || val === 'quiz') {
    bg = 'linear-gradient(135deg, #ff9ff3, #f368e0)';
    icon = <Brain className="premium-avatar-icon" />;
  } else if (val === '🕵️') {
    bg = 'linear-gradient(135deg, #57606f, #2f3542)';
    icon = <User className="premium-avatar-icon" />;
  } else if (val === '⚡') {
    bg = 'linear-gradient(135deg, #ffeaa7, #fdcb6e)';
    icon = <Zap className="premium-avatar-icon" />;
  }

  if (icon) {
    return (
      <div className="premium-avatar-container" style={{ background: bg }}>
        {icon}
      </div>
    );
  }

  return (
    <div className="premium-avatar-container letter-avatar" style={{ background: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' }}>
      <span className="avatar-text">{val}</span>
    </div>
  );
}
