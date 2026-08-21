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
