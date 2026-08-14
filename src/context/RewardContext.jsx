import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  getUserRewardData, 
  addActiveSeconds, 
  openMysteryBox, 
  equipItem, 
  unequipItem, 
  SECONDS_FOR_REWARD,
  REWARD_ITEMS
} from '../services/rewardService';

const RewardContext = createContext(null);

export function RewardProvider({ children }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  const [rewardData, setRewardData] = useState(() => getUserRewardData(userId));
  const [claimToast, setClaimToast] = useState(null); // { message, coins }
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);

  // Sync state whenever currentUser changes
  useEffect(() => {
    if (userId) {
      setRewardData(getUserRewardData(userId));
    }
  }, [userId]);

  // Active time heartbeat tracker: runs every 10 seconds when tab is active and user is logged in
  useEffect(() => {
    if (!userId) return undefined;

    const interval = setInterval(() => {
      // Only count active time when window document is visible
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      const result = addActiveSeconds(userId, 10);
      setRewardData(result.data);

      if (result.awarded) {
        setClaimToast({
          message: '🎉 Вы провели 60 минут в мессенджере!',
          coins: 10
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [userId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!claimToast) return undefined;
    const timer = setTimeout(() => setClaimToast(null), 6000);
    return () => clearTimeout(timer);
  }, [claimToast]);

  const handleOpenBox = useCallback(() => {
    if (!userId) return { success: false, error: 'Требуется авторизация' };
    const res = openMysteryBox(userId);
    if (res.success) {
      setRewardData(res.data);
    }
    return res;
  }, [userId]);

  const handleEquip = useCallback((itemType, itemId) => {
    if (!userId) return;
    const updated = equipItem(userId, itemType, itemId);
    setRewardData(updated);
  }, [userId]);

  const handleUnequip = useCallback((itemType) => {
    if (!userId) return;
    const updated = unequipItem(userId, itemType);
    setRewardData(updated);
  }, [userId]);

  // Computed properties
  const progressSeconds = rewardData.progressSeconds || 0;
  const progressPercent = Math.min(100, Math.round((progressSeconds / SECONDS_FOR_REWARD) * 100));
  const secondsRemaining = Math.max(0, SECONDS_FOR_REWARD - progressSeconds);
  const minutesRemaining = Math.ceil(secondsRemaining / 60);

  // Resolve equipped item objects
  const equippedFrameItem = REWARD_ITEMS.find((i) => i.id === rewardData.equipped?.frame) || null;
  const equippedBadgeItem = REWARD_ITEMS.find((i) => i.id === rewardData.equipped?.badge) || null;
  const equippedGlowItem = REWARD_ITEMS.find((i) => i.id === rewardData.equipped?.glow) || null;

  const value = {
    coins: rewardData.coins || 0,
    progressSeconds,
    progressPercent,
    minutesRemaining,
    secondsRemaining,
    unlockedIds: rewardData.unlockedIds || [],
    equipped: rewardData.equipped || { frame: null, badge: null, glow: null },
    equippedFrameItem,
    equippedBadgeItem,
    equippedGlowItem,
    openBox: handleOpenBox,
    equip: handleEquip,
    unequip: handleUnequip,
    isRewardsModalOpen,
    setIsRewardsModalOpen,
    claimToast,
    dismissClaimToast: () => setClaimToast(null),
    catalog: REWARD_ITEMS
  };

  return (
    <RewardContext.Provider value={value}>
      {children}
    </RewardContext.Provider>
  );
}

export function useRewards() {
  const context = useContext(RewardContext);
  if (!context) {
    throw new Error('useRewards must be used within a RewardProvider');
  }
  return context;
}
