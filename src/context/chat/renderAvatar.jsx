import React from 'react';
import { Users, Megaphone, Bookmark, User, Bot, CloudSun, Brain, Zap } from 'lucide-react';
import PrivateStorageImage from '../../components/PrivateStorageImage';
import { firstAvatarLetter, resolveAvatarToken } from './avatarFallback';

export {
  chatAvatarFallback,
  firstAvatarLetter,
  personAvatarFallback,
  resolveAvatarToken,
} from './avatarFallback';

const TOKEN_VISUALS = Object.freeze({
  group: { bg: 'linear-gradient(135deg, #3498db, #2980b9)', Icon: Users },
  channel: { bg: 'linear-gradient(135deg, #b534fa, #e056fd)', Icon: Megaphone },
  saved: { bg: 'linear-gradient(135deg, #34d399, #059669)', Icon: Bookmark, iconProps: { fill: 'currentColor' } },
  user: { bg: 'linear-gradient(135deg, #74b9ff, #0984e3)', Icon: User },
  coin: { bg: 'linear-gradient(135deg, #f6d365, #fda085)', Icon: User },
  bot: { bg: 'linear-gradient(135deg, #ff7675, #d63031)', Icon: Bot },
  weather: { bg: 'linear-gradient(135deg, #fdeb82, #f39c12)', Icon: CloudSun },
  quiz: { bg: 'linear-gradient(135deg, #ff9ff3, #f368e0)', Icon: Brain },
  spy: { bg: 'linear-gradient(135deg, #57606f, #2f3542)', Icon: User },
  zap: { bg: 'linear-gradient(135deg, #ffeaa7, #fdcb6e)', Icon: Zap },
});

function tokenVisual(token) {
  const visual = TOKEN_VISUALS[token];
  if (!visual) return null;
  const { bg, Icon, iconProps } = visual;
  return (
    <div className="premium-avatar-container" style={{ background: bg }}>
      <Icon className="premium-avatar-icon" {...iconProps} />
    </div>
  );
}

function letterAvatar(letter) {
  return (
    <div className="premium-avatar-container letter-avatar" style={{ background: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' }}>
      <span className="avatar-text">{letter}</span>
    </div>
  );
}

function visualFor(value) {
  if (value == null || value === '') return tokenVisual('user');
  if (typeof value !== 'string') return value;
  return tokenVisual(resolveAvatarToken(value)) || letterAvatar(firstAvatarLetter(value) || '•');
}

/**
 * Render chat/list avatar (URL, emoji, or premium icon container).
 * String fallbacks are tokens (`user`, `group`, `channel`) or a name (first letter).
 */
export function renderAvatar(avatar, fallback = '👤') {
  const avatarStr = typeof avatar === 'string' ? avatar : (typeof avatar?.avatar === 'string' ? avatar.avatar : '');
  const fallbackVisual = visualFor(fallback);
  const isUrl = Boolean(avatarStr && (
    avatarStr.startsWith('http') || avatarStr.startsWith('data:image') || avatarStr.startsWith('storage://')
  ));
  if (isUrl) {
    return (
      <PrivateStorageImage
        src={avatarStr}
        alt=""
        fallback={fallbackVisual}
        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    );
  }

  if (avatarStr) return visualFor(avatarStr);
  return fallbackVisual;
}
