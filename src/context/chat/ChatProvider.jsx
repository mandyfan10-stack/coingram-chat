import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { useE2EE } from '../E2EEContext';
import { dataService } from '../../services/dataLayer';
import { formatLastSeen } from '../../utils/formatLastSeen';
import { renderAvatar as renderAvatarView } from './renderAvatar';
import { useChatUiState } from './useChatUiState';
import { useOfflineSync } from './useOfflineSync';
import { useStickers } from './useStickers';
import { useStories } from './useStories';
import { usePresence } from './usePresence';
import { useTyping } from './useTyping';
import { useChatLoader } from './useChatLoader';
import { useChatActions } from './useChatActions';
import { useChatRealtime } from './useChatRealtime';

const ChatContext = createContext();

export { formatLastSeen };
export { ChatContext };

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { e2eePrivateKey, sharedKeysCache, setSharedKeysCache } = useE2EE();

  const [chats, setChats] = useState([]);
  const ui = useChatUiState();
  const { activeChatId, setActiveChatId } = ui;
  const activeChat = chats.find((c) => c.id === activeChatId);

  const chatsRef = useRef(chats);
  const sharedKeysCacheRef = useRef(sharedKeysCache);
  const e2eePrivateKeyRef = useRef(e2eePrivateKey);
  const activeChatIdRef = useRef(activeChatId);

  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { sharedKeysCacheRef.current = sharedKeysCache; }, [sharedKeysCache]);
  useEffect(() => { e2eePrivateKeyRef.current = e2eePrivateKey; }, [e2eePrivateKey]);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

  const offline = useOfflineSync({
    currentUser,
    chats,
    setChats,
    e2eePrivateKeyRef,
    sharedKeysCacheRef,
    setSharedKeysCache
  });

  const stickers = useStickers(currentUser);
  const stories = useStories(currentUser);
  const presence = usePresence(currentUser);
  const typing = useTyping(currentUser);

  const loader = useChatLoader({
    currentUser,
    setChats,
    chatsRef,
    e2eePrivateKeyRef,
    sharedKeysCacheRef,
    setSharedKeysCache,
    activeChatId,
    e2eePrivateKey
  });

  const actions = useChatActions({
    currentUser,
    chats,
    setChats,
    activeChatId,
    setActiveChatId,
    activeChat,
    fetchChats: loader.fetchChats,
    setOfflineQueue: offline.setOfflineQueue,
    e2eePrivateKeyRef,
    sharedKeysCacheRef,
    setSharedKeysCache
  });

  useChatRealtime({
    currentUser,
    setChats,
    fetchChats: loader.fetchChats,
    fetchStories: stories.fetchStories,
    markMessagesAsRead: actions.markMessagesAsRead,
    setSharedKeysCache,
    e2eePrivateKeyRef,
    sharedKeysCacheRef,
    activeChatIdRef,
    setOnlineUsers: presence.setOnlineUsers,
    setTypingStatuses: typing.setTypingStatuses,
    typingChannelRef: typing.typingChannelRef,
    typingTimeoutsRef: typing.typingTimeoutsRef
  });

  // Persist mock chats
  useEffect(() => {
    if (!dataService.isLive() && currentUser && chats.length > 0) {
      localStorage.setItem('tg-chats-mock', JSON.stringify(chats));
    }
  }, [chats, currentUser]);

  // Mark read when active chat / message count changes
  const activeChatMessagesLength = activeChat?.messages?.length || 0;
  useEffect(() => {
    if (activeChatId) {
      actions.markMessagesAsRead(activeChatId);
    }
  }, [activeChatId, activeChatMessagesLength, actions.markMessagesAsRead]);

  const renderAvatar = useCallback((avatar, fallback = '👤') => renderAvatarView(avatar, fallback), []);

  return (
    <ChatContext.Provider value={{
      getChatStatus: presence.getChatStatus,
      onlineUsers: presence.onlineUsers,
      currentUser,
      chats,
      setChats,
      fetchChats: loader.fetchChats,
      activeChatId,
      setActiveChatId,
      activeChat,
      sendMessage: actions.sendMessage,
      createChat: actions.createChat,
      deleteMessage: actions.deleteMessage,
      toggleReaction: actions.toggleReaction,
      stories: stories.stories,
      activeStoryId: stories.activeStoryId,
      setActiveStoryId: stories.setActiveStoryId,
      viewStory: stories.viewStory,
      publishStory: stories.publishStory,
      searchQuery: ui.searchQuery,
      setSearchQuery: ui.setSearchQuery,
      activeFolder: ui.activeFolder,
      setActiveFolder: ui.setActiveFolder,
      isSettingsOpen: ui.isSettingsOpen,
      setIsSettingsOpen: ui.setIsSettingsOpen,
      isInfoOpen: ui.isInfoOpen,
      setIsInfoOpen: ui.setIsInfoOpen,
      isPulseOpen: ui.isPulseOpen,
      setIsPulseOpen: ui.setIsPulseOpen,
      isNewChatOpen: ui.isNewChatOpen,
      setIsNewChatOpen: ui.setIsNewChatOpen,
      isCreateStoryOpen: ui.isCreateStoryOpen,
      setIsCreateStoryOpen: ui.setIsCreateStoryOpen,
      isDrawerOpen: ui.isDrawerOpen,
      setIsDrawerOpen: ui.setIsDrawerOpen,
      isDarkMode: ui.isDarkMode,
      setIsDarkMode: ui.setIsDarkMode,
      settingsTab: ui.settingsTab,
      setSettingsTab: ui.setSettingsTab,
      newChatModalTab: ui.newChatModalTab,
      setNewChatModalTab: ui.setNewChatModalTab,
      renderAvatar,
      theme: ui.theme,
      setTheme: ui.setTheme,
      wallpaper: ui.wallpaper,
      setWallpaper: ui.setWallpaper,
      updateChatAvatar: actions.updateChatAvatar,
      updateChatSettings: actions.updateChatSettings,
      typingStatuses: typing.typingStatuses,
      sendTypingStatus: typing.sendTypingStatus,
      markMessagesAsRead: actions.markMessagesAsRead,
      deleteChat: actions.deleteChat,
      clearChatMessages: actions.clearChatMessages,
      installedStickers: stickers.installedStickers,
      importStickerPack: stickers.importStickerPack,
      addMemberToChat: actions.addMemberToChat,
      toggleMemberRole: actions.toggleMemberRole,
      isOnline: offline.isOnline,
      retrySendMessage: offline.retrySendMessage,
      deleteFailedMessage: offline.deleteFailedMessage,
      loadActiveChatMessages: loader.loadActiveChatMessages,
      loadOlderMessages: loader.loadOlderMessages,
      messagePagination: loader.messagePagination
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
