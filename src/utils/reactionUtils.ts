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
