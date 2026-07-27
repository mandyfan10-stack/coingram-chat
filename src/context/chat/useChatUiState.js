import { useState, useEffect } from 'react';

/**
 * UI chrome state: folders, modals, theme, wallpaper, dark mode.
 */
export function useChatUiState() {
  const [activeChatId, setActiveChatId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isPulseOpen, setIsPulseOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('coingram-dark-mode') !== 'false');
  const [theme, setTheme] = useState('telegram-blue');
  const [wallpaper, setWallpaper] = useState('classic');
  const [settingsTab, setSettingsTab] = useState('profile');
  const [newChatModalTab, setNewChatModalTab] = useState('personal');

  useEffect(() => {
    if (isDarkMode || theme === 'rainbow-pearl') {
      document.documentElement.classList.remove('theme-light');
    } else {
      document.documentElement.classList.add('theme-light');
    }
    localStorage.setItem('coingram-dark-mode', isDarkMode ? 'true' : 'false');

    let classes = document.documentElement.className.split(' ').filter((c) => c === 'theme-light');
    if (theme === 'rainbow-pearl') classes = [];
    classes.push(`theme-${theme}`);
    document.documentElement.className = classes.join(' ').trim();
  }, [theme, isDarkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-wallpaper', wallpaper);
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
    isPulseOpen,
    setIsPulseOpen,
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
