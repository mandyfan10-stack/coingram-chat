import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { dataService } from '../../services/dataLayer';
import { formatLastSeen } from '../../utils/formatLastSeen';

export function usePresence(currentUser) {
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const getChatStatus = useCallback((chat) => {
    if (!chat) return '';
    if (chat.type === 'personal') {
      const other = chat.members?.find((m) => m.id !== currentUser?.id);
      if (!other) return '';
      const isOnline = onlineUsers.has(other.id);
      return formatLastSeen(other.lastSeen, isOnline);
    }
    if (chat.type === 'group') {
      const total = chat.members?.length || 0;
      const onlineCount = chat.members?.filter((m) => m.id !== currentUser?.id && onlineUsers.has(m.id)).length || 0;
      const finalOnline = onlineCount + (currentUser ? 1 : 0);
      const getPluralMembers = (n) => {
        const lastDigit = n % 10;
        const lastTwoDigits = n % 100;
        if (lastDigit === 1 && lastTwoDigits !== 11) return 'участник';
        if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'участника';
        return 'участников';
      };
      return `${total} ${getPluralMembers(total)}, ${finalOnline} в сети`;
    }
    if (chat.type === 'channel') {
      const total = chat.members?.length || 0;
      const getPluralSubscribers = (n) => {
        const lastDigit = n % 10;
        const lastTwoDigits = n % 100;
        if (lastDigit === 1 && lastTwoDigits !== 11) return 'подписчик';
        if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'подписчика';
        return 'подписчиков';
      };
      return `${total} ${getPluralSubscribers(total)}`;
    }
    return '';
  }, [currentUser, onlineUsers]);

  // Periodically update current user presence status
  useEffect(() => {
    if (!dataService.isLive() || !currentUser) return;
    const updateLastSeen = async () => {
      try {
        await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
      } catch (e) {
        console.warn('Failed to update last_seen:', e);
      }
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000);

    const handleUnload = () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;
      const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${currentUser.id}`;
      navigator.sendBeacon(url, JSON.stringify({ last_seen: new Date().toISOString() }));
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      updateLastSeen();
    };
  }, [currentUser]);

  return { onlineUsers, setOnlineUsers, getChatStatus };
}
