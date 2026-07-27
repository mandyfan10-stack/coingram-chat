import { useState, useRef, useCallback } from 'react';
import { dataService } from '../../services/dataLayer';

export function useTyping(currentUser) {
  const [typingStatuses, setTypingStatuses] = useState({});
  const typingChannelRef = useRef(null);
  const typingTimeoutsRef = useRef({});

  const sendTypingStatus = useCallback((chatId, isTyping) => {
    if (!currentUser) return;
    if (dataService.isLive() && typingChannelRef.current) {
      typingChannelRef.current.send({
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
