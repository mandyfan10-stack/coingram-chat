/** Canonical display name for notes-to-self (RU). */
export const SAVED_MESSAGES_DISPLAY_NAME = 'Избранное';

const SAVED_USERNAMES = new Set(['saved_messages', 'saved-messages']);

export type SavedMessagesChatLike = {
  type?: string | null;
  name?: string | null;
  username?: string | null;
  members?: Array<{ id?: string | null } | null> | null;
} | null | undefined;

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * True for the user's notes-to-self chat (Избранное / legacy Saved Messages).
 * Detection is name/username based so incomplete member lists never strip E2EE
 * from a real 1:1 personal chat.
 */
export function isSavedMessagesChat(chat: SavedMessagesChatLike): boolean {
  if (!chat || chat.type !== 'personal') return false;

  const username = String(chat.username || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
  if (username && SAVED_USERNAMES.has(username)) return true;

  const name = normalizeName(String(chat.name || ''));
  if (!name) return false;
  if (name === SAVED_MESSAGES_DISPLAY_NAME) return true;
  if (/^saved messages\b/i.test(name)) return true;

  return false;
}

/** Personal 1:1 chats require E2EE; notes-to-self do not. */
export function requiresPersonalE2EE(chat: SavedMessagesChatLike): boolean {
  if (!chat || chat.type !== 'personal') return false;
  return !isSavedMessagesChat(chat);
}

/** UI label: prefer canonical RU name for known saved chats. */
export function savedMessagesDisplayName(chat: SavedMessagesChatLike): string {
  if (isSavedMessagesChat(chat)) return SAVED_MESSAGES_DISPLAY_NAME;
  return String(chat?.name || SAVED_MESSAGES_DISPLAY_NAME);
}
