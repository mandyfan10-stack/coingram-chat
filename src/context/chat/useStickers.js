import { useState, useEffect, useCallback } from 'react';
import { dataService } from '../../services/dataLayer';
import { defaultMockPacks } from '../../mocks/stickerPacks';

export function useStickers(currentUser) {
  const [installedStickers, setInstalledStickers] = useState([]);

  const fetchStickers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const packs = await dataService.fetchStickers(currentUser.id);
      if (packs) {
        setInstalledStickers(packs.filter(Boolean));
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const importStickerPack = useCallback(async (packName) => {
    if (!currentUser) return { error: 'Вы не авторизованы!' };
    try {
      if (dataService.isLive()) {
        const data = await dataService.importStickerPack(currentUser.id, packName);
        await fetchStickers();
        return { success: true, title: data.title };
      }

      const normalized = packName.toLowerCase().trim();
      let matchedDefault = defaultMockPacks.find((p) => p.name.toLowerCase() === normalized);
      if (!matchedDefault) {
        matchedDefault = {
          id: `pack-${Date.now()}`,
          name: packName,
          title: `${packName} Pack 🌟`,
          is_animated: false,
          is_video: false,
          stickers: [
            { id: `st-c1-${Date.now()}`, emoji: '⭐', filePath: 'https://img.icons8.com/color/180/star--v1.png' },
            { id: `st-c2-${Date.now()}`, emoji: '✨', filePath: 'https://img.icons8.com/color/180/sparkling-light-.png' },
            { id: `st-c3-${Date.now()}`, emoji: '🔥', filePath: 'https://img.icons8.com/color/180/fire.png' }
          ]
        };
      }
      setInstalledStickers((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === normalized)) return prev;
        const updated = [...prev, matchedDefault];
        localStorage.setItem('tg-stickers-mock', JSON.stringify(updated));
        return updated;
      });
      return { success: true, title: matchedDefault.title };
    } catch (e) {
      return { error: e.message };
    }
  }, [currentUser, fetchStickers]);

  useEffect(() => {
    if (currentUser) {
      if (dataService.isLive()) {
        fetchStickers();
      } else {
        const saved = localStorage.getItem('tg-stickers-mock');
        if (saved) {
          try {
            setInstalledStickers(JSON.parse(saved));
          } catch {
            setInstalledStickers(defaultMockPacks);
          }
        } else {
          setInstalledStickers(defaultMockPacks);
          localStorage.setItem('tg-stickers-mock', JSON.stringify(defaultMockPacks));
        }
      }
    } else {
      setInstalledStickers([]);
    }
  }, [currentUser, fetchStickers]);

  return { installedStickers, fetchStickers, importStickerPack };
}
