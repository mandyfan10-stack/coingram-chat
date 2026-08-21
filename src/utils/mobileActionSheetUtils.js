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
