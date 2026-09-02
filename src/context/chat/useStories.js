import { useState, useCallback } from 'react';
import { dataService } from '../../services/dataLayer';
import { initialStories } from '../../mocks/stickerPacks';

export function useStories(currentUser) {
  const [stories, setStories] = useState(initialStories);
  const [activeStoryId, setActiveStoryId] = useState(null);

  const fetchStories = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await dataService.fetchStories();
      const viewedKey = `tg-viewed-stories-${currentUser.id}`;
      let viewedSaved = [];
      try {
        const stored = localStorage.getItem(viewedKey);
        if (stored) viewedSaved = JSON.parse(stored);
      } catch {
        /* ignore */
      }

      const formatted = (data || []).map((s) => ({
        id: s.id,
        userId: s.user_id,
        userName: s.profiles?.display_name || s.profiles?.username || 'Пользователь',
        userAvatar: s.profiles?.avatar || '🪙',
        media: s.media,
        caption: s.caption,
        viewed: viewedSaved.includes(s.id),
        timestamp: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setStories(formatted);
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const publishStory = useCallback(async (media, caption) => {
    if (!currentUser) return null;
    try {
      const data = await dataService.publishStory(currentUser.id, media, caption);
      await fetchStories();
      return data;
    } catch (e) {
      console.error(e);
      alert(e.message);
      return null;
    }
  }, [currentUser, fetchStories]);

  const viewStory = useCallback((storyId) => {
    if (currentUser) {
      const viewedKey = `tg-viewed-stories-${currentUser.id}`;
      try {
        const stored = localStorage.getItem(viewedKey);
        const viewedSaved = stored ? JSON.parse(stored) : [];
        if (!viewedSaved.includes(storyId)) {
          viewedSaved.push(storyId);
          localStorage.setItem(viewedKey, JSON.stringify(viewedSaved));
        }
      } catch {
        /* ignore */
      }
    }

    setStories((previous) => previous.map((story) => (
      story.id === storyId && !story.viewed ? { ...story, viewed: true } : story
    )));
    setActiveStoryId(storyId);
  }, [currentUser]);

  const deleteStory = useCallback(async (storyId) => {
    try {
      await dataService.deleteStory(storyId);
      await fetchStories();
      if (activeStoryId === storyId) {
        setActiveStoryId(null);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [fetchStories, activeStoryId]);

  return {
    stories,
    setStories,
    activeStoryId,
    setActiveStoryId,
    fetchStories,
    publishStory,
    deleteStory,
    viewStory
  };
}
