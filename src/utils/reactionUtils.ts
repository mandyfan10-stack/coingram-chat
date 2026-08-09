export interface MessageReactionLike {
  emoji?: string;
  count?: number;
  users?: string[];
  userId?: string;
  [key: string]: unknown;
}

export interface NormalizedReaction {
  emoji?: string;
  count: number;
  users: string[];
  [key: string]: unknown;
}

export const normalizeReaction = (reaction: MessageReactionLike | null | undefined): NormalizedReaction => {
  const users = Array.isArray(reaction?.users)
    ? [...reaction.users]
    : (reaction?.userId ? [reaction.userId] : []);

  return {
    ...reaction,
    count: Number.isFinite(reaction?.count) ? Number(reaction?.count) : users.length,
    users
  };
};

export const normalizeReactions = (
  reactions: MessageReactionLike[] | null | undefined
): NormalizedReaction[] => (
  Array.isArray(reactions) ? reactions.map(normalizeReaction) : []
);

export const cloneReactions = (
  reactions: MessageReactionLike[] | null | undefined,
): NormalizedReaction[] => (
  normalizeReactions(reactions).map((r) => ({
    ...r,
    users: [...r.users],
  }))
);

export const isAllowedReactionEmoji = (emoji: unknown): emoji is string => {
  if (typeof emoji !== 'string') return false;
  const t = emoji.trim();
  if (!t || t.length > 16) return false;
  // Reject C0 controls and DEL without embedding control ranges in a regex.
  if ([...t].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  })) return false;
  return true;
};

/** Pure toggle: add or remove userKey for emoji; drop empty reaction rows. */
export const toggleUserReaction = (
  reactions: MessageReactionLike[] | null | undefined,
  emoji: string,
  userKey: string,
): NormalizedReaction[] => {
  const list = cloneReactions(reactions);
  const idx = list.findIndex((r) => r.emoji === emoji);
  if (idx >= 0) {
    const row = list[idx];
    if (row.users.includes(userKey)) {
      row.users = row.users.filter((u) => u !== userKey);
      row.count = row.users.length;
      if (row.count === 0) list.splice(idx, 1);
    } else {
      row.users = [...row.users, userKey];
      row.count = row.users.length;
    }
  } else {
    list.push({ emoji, count: 1, users: [userKey] });
  }
  return list;
};
