import { useState, useEffect } from 'react';

/**
 * UI chrome state: folders, modals, theme, wallpaper, dark mode.
 */
export function useChatUiState(currentUser) {
  const [activeChatId, setActiveChatId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('coingram-dark-mode') !== 'false');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('coingram-theme') || 'telegram-blue';
  });
  const [wallpaper, setWallpaper] = useState(() => {
    return localStorage.getItem('coingram-wallpaper') || 'classic';
  });
  const [settingsTab, setSettingsTab] = useState('profile');
  const [newChatModalTab, setNewChatModalTab] = useState('personal');

  // Synchronize wallpaper and theme when currentUser profile updates/loads
  useEffect(() => {
    if (currentUser?.wallpaper) {
      setWallpaper(currentUser.wallpaper);
      localStorage.setItem('coingram-wallpaper', currentUser.wallpaper);
    }
    if (currentUser?.theme) {
      setTheme(currentUser.theme);
      localStorage.setItem('coingram-theme', currentUser.theme);
    }
  }, [currentUser?.wallpaper, currentUser?.theme]);

  useEffect(() => {
    if (isDarkMode || theme === 'rainbow-pearl') {
      document.documentElement.classList.remove('theme-light');
    } else {
      document.documentElement.classList.add('theme-light');
    }
    localStorage.setItem('coingram-dark-mode', isDarkMode ? 'true' : 'false');
    localStorage.setItem('coingram-theme', theme);

    let classes = document.documentElement.className.split(' ').filter((c) => c === 'theme-light');
    if (theme === 'rainbow-pearl') classes = [];
    classes.push(`theme-${theme}`);
    document.documentElement.className = classes.join(' ').trim();
  }, [theme, isDarkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-wallpaper', wallpaper);
    localStorage.setItem('coingram-wallpaper', wallpaper);
  }, [wallpaper]);

  // Global Android / Browser back gesture handler
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.handleAndroidBackButton = () => {
      // 1. Close open image preview / lightbox
      const activeImageViewerClose = document.querySelector('.image-viewer-close, .lightbox-close');
      if (activeImageViewerClose instanceof HTMLElement) {
        activeImageViewerClose.click();
        return true;
      }

      // 2. Close settings modal
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }

      // 3. Close side drawer / new chat / story modals
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return true;
      }
      if (isNewChatOpen) {
        setIsNewChatOpen(false);
        return true;
      }
      if (isCreateStoryOpen) {
        setIsCreateStoryOpen(false);
        return true;
      }

      // 4. Close chat info pane
      if (isInfoOpen) {
        setIsInfoOpen(false);
        return true;
      }

      // 5. Close mobile action sheet / reaction drawer if open
      const actionSheetBackdrop = document.querySelector('.msg-actions-backdrop, .reaction-drawer-backdrop');
      if (actionSheetBackdrop instanceof HTMLElement) {
        actionSheetBackdrop.click();
        return true;
      }

      // 6. Return from active chat to chat list
      if (activeChatId) {
        setActiveChatId(null);
        return true;
      }

      // 7. Already at root chat list -> let Android handle normal exit / minimize
      return false;
    };

    return () => {
      delete window.handleAndroidBackButton;
    };
  }, [
    isSettingsOpen,
    isDrawerOpen,
    isNewChatOpen,
    isCreateStoryOpen,
    isInfoOpen,
    activeChatId
  ]);

  return {
    activeChatId,
    setActiveChatId,
    searchQuery,
    setSearchQuery,
    activeFolder,
    setActiveFolder,
    isSettingsOpen,
    setIsSettingsOpen,
    isInfoOpen,
    setIsInfoOpen,
    isNewChatOpen,
    setIsNewChatOpen,
    isCreateStoryOpen,
    setIsCreateStoryOpen,
    isDrawerOpen,
    setIsDrawerOpen,
    isDarkMode,
    setIsDarkMode,
    theme,
    setTheme,
    wallpaper,
    setWallpaper,
    settingsTab,
    setSettingsTab,
    newChatModalTab,
    setNewChatModalTab
  };
}
