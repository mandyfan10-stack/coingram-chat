export const normalizeReaction = (reaction) => {
  const users = Array.isArray(reaction?.users)
    ? [...reaction.users]
    : (reaction?.userId ? [reaction.userId] : []);

  return {
    ...reaction,
    count: Number.isFinite(reaction?.count) ? reaction.count : users.length,
    users
  };
};

export const normalizeReactions = (reactions) => (
  Array.isArray(reactions) ? reactions.map(normalizeReaction) : []
);