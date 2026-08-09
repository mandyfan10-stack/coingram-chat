import { useState, useRef, useCallback } from 'react';
import { dataService } from '../../services/dataLayer';

export function useTyping(currentUser) {
  const [typingStatuses, setTypingStatuses] = useState({});
  const typingChannelRef = useRef(null);
  const typingTimeoutsRef = useRef({});

  const sendTypingStatus = useCallback((chatId, isTyping) => {
    if (!currentUser) return;
    const channel = typingChannelRef.current?.get(chatId);
    if (dataService.isLive() && channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: currentUser.id,
          chatId,
          isTyping,
          userName: currentUser.name || currentUser.username
        }
      });
    }
  }, [currentUser]);

  return {
    typingStatuses,
    setTypingStatuses,
    typingChannelRef,
    typingTimeoutsRef,
    sendTypingStatus
  };
}
