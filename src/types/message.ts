import type { ProfileId } from './profile';

export type MessageId = string;

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  userId?: string;
}

export interface ChatMessage {
  id: MessageId;
  senderId: ProfileId;
  senderName?: string;
  text: string;
  media?: string | null;
  replyTo?: MessageId | null;
  read?: boolean;
  reads?: ProfileId[];
  reactions?: MessageReaction[];
  timestamp: Date | string;
  isOptimistic?: boolean;
  isPending?: boolean;
  isFailed?: boolean;
  isLocked?: boolean;
}

export interface OfflineQueueItem {
  queueId: string;
  chatId: string;
  senderId: ProfileId;
  text: string;
  replyToId?: MessageId | null;
  media?: string | null;
  optimisticId: MessageId;
  hasOfflineMedia?: boolean;
  mediaType?: string | null;
  isPending?: boolean;
  isFailed?: boolean;
}
