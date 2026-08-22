import { triggerHaptic } from '../hooks/useMessageTouch.js';

/**
 * Canonical 8 default quick reaction emojis matching Telegram mobile ergonomics.
 */
export const DEFAULT_QUICK_EMOJIS = [
  '❤️', '👍', '👎', '🔥', '😂', '👏', '🎉', '😢'
];

/**
 * Safely extracts human-authored copyable text from any chat message.
 * Returns empty string if the message has no copyable user text (e.g. pure media placeholder, voice note, sticker).
 *
 * @param {any} msg - Chat message object
 * @returns {string} Clean human text ready for clipboard copy
 */
export function extractMessageText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  const text = (typeof msg.text === 'string' && msg.text.trim()) ||
    (typeof msg.caption === 'string' && msg.caption.trim()) ||
    '';
  if (!text) return '';

  const MEDIA_PLACEHOLDERS = [
    '🖼️ [Изображение]',
    '[Изображение]',
    'Изображение',
    '🎬 [Видео]',
    '[Видео]',
    'Видео'
  ];
  if (MEDIA_PLACEHOLDERS.includes(text)) return '';

  if (
    text.startsWith('🎤 Голосовое сообщение') ||
    text.startsWith('Голосовое сообщение') ||
    text.startsWith('🎬 Видеосообщение') ||
    text.startsWith('Видеосообщение') ||
    text.startsWith('sticker:')
  ) {
    return '';
  }

  return text;
}

/**
 * Generates an intuitive human-readable description for reply previews and quotes.
 * Returns human text for text messages, or media descriptor (📷 Фото, 🎥 Видео, 🎤 Голосовое сообщение, 🎨 Стикер).
 *
 * @param {any} msg - Message object being replied to
 * @returns {string}
 */
export function getReplyPreviewText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  const text = (typeof msg.text === 'string' && msg.text.trim()) ||
    (typeof msg.caption === 'string' && msg.caption.trim()) ||
    '';

  const MEDIA_PLACEHOLDERS = [
    '🖼️ [Изображение]',
    '[Изображение]',
    'Изображение',
    '🎬 [Видео]',
    '[Видео]',
    'Видео'
  ];

  if (text && !MEDIA_PLACEHOLDERS.includes(text) && !text.startsWith('sticker:')) {
    return text;
  }

  if (msg.mediaType === 'voice') return '🎤 Голосовое сообщение';
  if (msg.mediaType === 'video_note' || msg.isRoundVideo) return '📹 Видеосообщение';
  if (msg.mediaType === 'video') return '🎥 Видео';
  if (msg.mediaType === 'sticker') return '🎨 Стикер';
  if (msg.mediaType === 'image' || msg.mediaType === 'photo') return '📷 Фото';

  const isVideoNote = Boolean(
    msg.isRoundVideo ||
    (msg.media && (String(msg.media).includes('video_note') || String(msg.media).includes('round_video'))) ||
    text.includes('Видеосообщение')
  );
  if (isVideoNote) return '📹 Видеосообщение';

  const isRegularVideo = Boolean(
    (msg.media && (String(msg.media).includes('.mp4') || String(msg.media).includes('.mov') || String(msg.media).includes('video/mp4'))) ||
    text.includes('Видео')
  );
  if (isRegularVideo) return '🎥 Видео';

  const isVoice = Boolean(
    (msg.media && (String(msg.media).includes('audio') || String(msg.media).includes('.ogg') || String(msg.media).includes('.mp3') || String(msg.media).includes('voice_'))) ||
    text.includes('Голосовое сообщение')
  );
  if (isVoice) return '🎤 Голосовое сообщение';

  const isSticker = Boolean(
    (msg.media && (String(msg.media).includes('sticker') || String(msg.media).includes('.tgs') || String(msg.media).includes('stickers/'))) ||
    text.startsWith('sticker:')
  );
  if (isSticker) return '🎨 Стикер';

  if (msg.media) {
    if (String(msg.media).includes('.webm')) return '📹 Видеосообщение';
    return '📷 Фото';
  }

  return text || 'Сообщение';
}

/**
 * Multi-tier resilient clipboard copy engine with fallback for WebViews, Safari, and restricted iframes.
 *
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if text was successfully written to clipboard
 */
export async function copyTextToClipboard(text) {
  if (!text) return false;

  // Tier 1: Modern Asynchronous Clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback to Tier 2 */
  }

  // Tier 2: document.execCommand('copy') with off-screen textarea
  try {
    if (typeof document !== 'undefined' && document.body) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) return true;
    }
  } catch {
    /* ignore fallback errors */
  }

  return false;
}

/**
 * Evaluates whether the user is permitted to delete the target message.
 *
 * @param {any} msg - Target message object
 * @param {any} [currentUser] - Authenticated user profile
 * @param {any} [activeChat] - Active chat room data
 * @param {boolean} [explicitCanDelete] - Explicit override prop
 * @param {boolean} [isOutgoing] - Explicit outgoing message flag
 * @returns {boolean} True if delete action is allowed
 */
export function canUserDeleteMessage(msg, currentUser, activeChat, explicitCanDelete, isOutgoing) {
  if (typeof explicitCanDelete === 'boolean') {
    return explicitCanDelete;
  }
  if (typeof isOutgoing === 'boolean') {
    return isOutgoing;
  }
  if (!msg || typeof msg !== 'object') return false;

  const isSenderMe = Boolean(
    currentUser?.id &&
    ((Boolean(msg.senderId) && msg.senderId === currentUser.id) ||
      (Boolean(msg.sender_id) && msg.sender_id === currentUser.id))
  );

  const isMe = Boolean(
    isSenderMe ||
    msg.senderId === 'current' ||
    msg.sender_id === 'current' ||
    msg.isOutgoing ||
    msg.isMe
  );
  if (isMe) return true;

  // Saved Messages: user has full control
  if (activeChat?.id === 'saved' || activeChat?.isSaved || activeChat?.type === 'saved') {
    return true;
  }

  // Group / Channel Admin check
  if (activeChat?.members && currentUser?.id) {
    const member = activeChat.members.find(
      (m) => m.id === currentUser.id || m.id === 'current'
    );
    if (member?.role === 'admin' || member?.role === 'owner') {
      return true;
    }
  }

  if (
    activeChat?.creatorId &&
    ((currentUser?.id && activeChat.creatorId === currentUser.id) ||
      activeChat.creatorId === 'current')
  ) {
    return true;
  }

  // Direct 1:1 chat deletion parity
  if (activeChat?.type === 'direct') {
    return true;
  }

  return false;
}

export { triggerHaptic };
