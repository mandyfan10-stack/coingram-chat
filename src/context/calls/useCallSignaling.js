import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { dataService } from '../../services/dataLayer';

const BUSY_CALL_STATUSES = new Set(['calling', 'incoming', 'connected']);

/**
 * Private chat-scoped call signaling (incoming / accepted / rejected) + queue flush.
 * @param {{ onRemoteEnd?: () => void }} options onRemoteEnd tears down media when peer rejects.
 */
export function useCallSignaling({
  currentUser,
  chats,
  signalingChatIds,
  setCallState,
  currentUserRef,
  onRemoteEnd
}) {
  const globalSignalingChannelRef = useRef(null);
  const pendingSignalingMessagesRef = useRef(new Map());
  const onRemoteEndRef = useRef(onRemoteEnd);
  onRemoteEndRef.current = onRemoteEnd;

  useEffect(() => {
    const previousChannels = Array.isArray(globalSignalingChannelRef.current)
      ? globalSignalingChannelRef.current
      : globalSignalingChannelRef.current ? [globalSignalingChannelRef.current] : [];
    previousChannels.forEach((channel) => channel.unsubscribe());
    globalSignalingChannelRef.current = [];

    if (!dataService.isLive() || !currentUser) return;

    const channels = chats.map((chat) => {
      const signalingChannel = supabase.channel(`call:chat:${chat.id}`, { config: { private: true } });
      signalingChannel
        .on('broadcast', { event: 'incoming-call' }, (payload) => {
          const { callerId, callerName, callerAvatar, callerAvatarColor, chatId } = payload.payload;
          if (callerId === currentUserRef.current?.id) return;
          // Busy guard: never clobber an active call (C2).
          setCallState((prev) => {
            if (BUSY_CALL_STATUSES.has(prev.status)) return prev;
            return {
              status: 'incoming',
              chatId,
              duration: 0,
              muted: false,
              isOutgoing: false,
              callerInfo: { name: callerName, avatar: callerAvatar, avatarColor: callerAvatarColor },
              otherUserId: callerId,
              webrtcState: 'disconnected',
              isRemoteScreenSharing: false,
              isLocalSpeaking: false,
              isRemoteSpeaking: false
            };
          });
        })
        .on('broadcast', { event: 'call-accepted' }, (payload) => {
          const { responderId } = payload.payload || {};
          if (responderId === currentUserRef.current?.id) return;
          setCallState((prev) => (prev.status === 'calling'
            ? { ...prev, status: 'connected', otherUserId: responderId || prev.otherUserId }
            : prev));
        })
        .on('broadcast', { event: 'call-rejected' }, () => {
          // Full teardown via shared end path (C4), not status-only reset.
          if (typeof onRemoteEndRef.current === 'function') {
            onRemoteEndRef.current();
          } else {
            setCallState((prev) => ((prev.status === 'calling' || prev.status === 'connected')
              ? { ...prev, status: 'ended' }
              : prev));
          }
        })
        .subscribe((status) => {
          signalingChannel.callSubscriptionStatus = status;
          if (status !== 'SUBSCRIBED') return;

          const pendingMessages = pendingSignalingMessagesRef.current.get(chat.id) || [];
          pendingSignalingMessagesRef.current.delete(chat.id);
          pendingMessages.forEach(({ event, payload }) => {
            signalingChannel.send({ type: 'broadcast', event, payload })
              .catch((error) => console.error('Failed to flush call signaling message:', error));
          });
        });
      return signalingChannel;
    });

    globalSignalingChannelRef.current = channels;
    return () => {
      channels.forEach((channel) => channel.unsubscribe());
      if (globalSignalingChannelRef.current === channels) globalSignalingChannelRef.current = [];
    };
  }, [currentUser?.id, signalingChatIds, currentUser, chats, setCallState, currentUserRef]);

  const sendSignalingMessage = useCallback((chatId, event, payload) => {
    if (!dataService.isLive() || !chatId) return;
    const topic = `realtime:call:chat:${chatId}`;
    const subscribedChannels = Array.isArray(globalSignalingChannelRef.current)
      ? globalSignalingChannelRef.current
      : [];
    const channel = subscribedChannels.find((item) => item.topic === topic);

    if (channel?.callSubscriptionStatus === 'SUBSCRIBED') {
      channel.send({ type: 'broadcast', event, payload })
        .catch((error) => console.error('Failed to send call signaling message:', error));
      return;
    }

    const pendingMessages = pendingSignalingMessagesRef.current.get(chatId) || [];
    pendingMessages.push({ event, payload });
    pendingSignalingMessagesRef.current.set(chatId, pendingMessages);
  }, []);

  return { sendSignalingMessage, globalSignalingChannelRef, pendingSignalingMessagesRef };
}
