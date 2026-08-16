const TOKEN_ALIASES = Object.freeze({
  '👥': 'group',
  group: 'group',
  Group: 'group',
  '📢': 'channel',
  channel: 'channel',
  Channel: 'channel',
  '🔖': 'saved',
  saved: 'saved',
  'Saved Messages': 'saved',
  'Избранное': 'saved',
  '👤': 'user',
  user: 'user',
  User: 'user',
  '🪙': 'coin',
  '🤖': 'bot',
  bot: 'bot',
  '🌤️': 'weather',
  weather: 'weather',
  '🧠': 'quiz',
  quiz: 'quiz',
  '🕵️': 'spy',
  '⚡': 'zap',
});

export function resolveAvatarToken(value) {
  if (typeof value !== 'string') return null;
  return TOKEN_ALIASES[value] || null;
}

export function firstAvatarLetter(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text) return '';
  const letter = [...text][0];
  return letter ? letter.toUpperCase() : '';
}

export function chatAvatarFallback(chat) {
  if (chat?.type === 'channel') return 'channel';
  if (chat?.type === 'group') return 'group';
  return chat?.name || chat?.username || 'user';
}

export function personAvatarFallback(person) {
  return person?.name || person?.display_name || person?.username || person?.userName || person?.senderName || 'user';
}
