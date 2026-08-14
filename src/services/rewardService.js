/**
 * Coiny Rewards & Mystery Box Service
 * Manages user coin balances, 60-minute time tracking, lootbox drop mechanics,
 * and collectible profile decorations (frames, badges, glows).
 */

export const REWARD_ITEMS = [
  // --- Avatar Frames ---
  {
    id: 'frame_neon_cyan',
    type: 'frame',
    name: 'Неоновый Кибер',
    rarity: 'rare',
    rarityLabel: 'Редкий',
    rarityColor: '#38bdf8',
    icon: '💠',
    description: 'Пульсирующий неоновый контур вокруг аватара',
    className: 'frame-neon-cyan'
  },
  {
    id: 'frame_emerald_shield',
    type: 'frame',
    name: 'Изумрудный Щит',
    rarity: 'rare',
    rarityLabel: 'Редкий',
    rarityColor: '#34d399',
    icon: '🛡️',
    description: 'Сияющая изумрудная матрица защиты',
    className: 'frame-emerald-shield'
  },
  {
    id: 'frame_cyber_wave',
    type: 'frame',
    name: 'Голографическая Волна',
    rarity: 'epic',
    rarityLabel: 'Эпический',
    rarityColor: '#c084fc',
    icon: '🌌',
    description: 'Анимированный радужно-космический градиент',
    className: 'frame-cyber-wave'
  },
  {
    id: 'frame_amethyst_crystal',
    type: 'frame',
    name: 'Кристальный Аметист',
    rarity: 'epic',
    rarityLabel: 'Эпический',
    rarityColor: '#a855f7',
    icon: '🔮',
    description: 'Сверкающие кристаллы с мягким переливом',
    className: 'frame-amethyst-crystal'
  },
  {
    id: 'frame_royal_gold',
    type: 'frame',
    name: 'Королевское Золото',
    rarity: 'legendary',
    rarityLabel: 'Легендарный',
    rarityColor: '#fbbf24',
    icon: '👑',
    description: 'Роскошная корона с частицами золотого сияния',
    className: 'frame-royal-gold'
  },
  {
    id: 'frame_inferno_flame',
    type: 'frame',
    name: 'Адское Пламя',
    rarity: 'legendary',
    rarityLabel: 'Легендарный',
    rarityColor: '#f87171',
    icon: '🔥',
    description: 'Анимированные языки пылающего огня',
    className: 'frame-inferno-flame'
  },

  // --- Status Badges ---
  {
    id: 'badge_coin',
    type: 'badge',
    name: 'Coiny Pioneer',
    symbol: '🪙',
    rarity: 'common',
    rarityLabel: 'Обычный',
    rarityColor: '#94a3b8',
    icon: '🪙',
    description: 'Фирменный значок первопроходца Coingram'
  },
  {
    id: 'badge_lightning',
    type: 'badge',
    name: 'Молния',
    symbol: '⚡',
    rarity: 'rare',
    rarityLabel: 'Редкий',
    rarityColor: '#38bdf8',
    icon: '⚡',
    description: 'Символ невероятной скорости и энергии'
  },
  {
    id: 'badge_rocket',
    type: 'badge',
    name: 'Ракета',
    symbol: '🚀',
    rarity: 'rare',
    rarityLabel: 'Редкий',
    rarityColor: '#38bdf8',
    icon: '🚀',
    description: 'Статус космического полёта'
  },
  {
    id: 'badge_diamond',
    type: 'badge',
    name: 'Бриллиант',
    symbol: '💎',
    rarity: 'epic',
    rarityLabel: 'Эпический',
    rarityColor: '#c084fc',
    icon: '💎',
    description: 'Драгоценный значок высшей пробы'
  },
  {
    id: 'badge_crown',
    type: 'badge',
    name: 'Владыка',
    symbol: '👑',
    rarity: 'legendary',
    rarityLabel: 'Легендарный',
    rarityColor: '#fbbf24',
    icon: '👑',
    description: 'Королевский статус лидера'
  },
  {
    id: 'badge_fire',
    type: 'badge',
    name: 'Легенда',
    symbol: '🔥',
    rarity: 'legendary',
    rarityLabel: 'Легендарный',
    rarityColor: '#f87171',
    icon: '🔥',
    description: 'Статус огненной активности'
  },

  // --- Profile Ambient Glows ---
  {
    id: 'glow_sapphire',
    type: 'glow',
    name: 'Сапфировое Сияние',
    rarity: 'rare',
    rarityLabel: 'Редкий',
    rarityColor: '#38bdf8',
    icon: '💙',
    description: 'Глубокая синяя аура вокруг карточки профиля',
    className: 'glow-sapphire'
  },
  {
    id: 'glow_amethyst',
    type: 'glow',
    name: 'Аметистовая Аура',
    rarity: 'epic',
    rarityLabel: 'Эпический',
    rarityColor: '#c084fc',
    icon: '💜',
    description: 'Завораживающее фиолетовое неоновое свечение',
    className: 'glow-amethyst'
  },
  {
    id: 'glow_solar',
    type: 'glow',
    name: 'Солнечная Вспышка',
    rarity: 'legendary',
    rarityLabel: 'Легендарный',
    rarityColor: '#fbbf24',
    icon: '💛',
    description: 'Золотой ореол с мерцающими лучами света',
    className: 'glow-solar'
  }
];

const STORAGE_KEY_PREFIX = 'coingram_rewards_';
export const SECONDS_FOR_REWARD = 3600; // 60 minutes
export const REWARD_COIN_AMOUNT = 10;
export const BOX_COST = 10;
export const DUPLICATE_CASHBACK = 5;

/**
 * Loads reward state from storage for a user, or initializes new default state.
 */
export function getUserRewardData(userId) {
  if (!userId) {
    return {
      coins: 10,
      progressSeconds: 0,
      unlockedIds: ['badge_coin'],
      equipped: { frame: null, badge: 'badge_coin', glow: null }
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        coins: typeof parsed.coins === 'number' ? parsed.coins : 10,
        progressSeconds: typeof parsed.progressSeconds === 'number' ? parsed.progressSeconds : 0,
        unlockedIds: Array.isArray(parsed.unlockedIds) ? parsed.unlockedIds : ['badge_coin'],
        equipped: parsed.equipped || { frame: null, badge: 'badge_coin', glow: null }
      };
    }
  } catch (e) {
    console.warn('Failed to parse rewards from localStorage', e);
  }

  // Initial starter data with 10 welcome coins!
  const defaultData = {
    coins: 10,
    progressSeconds: 0,
    unlockedIds: ['badge_coin'],
    equipped: { frame: null, badge: 'badge_coin', glow: null }
  };
  saveUserRewardData(userId, defaultData);
  return defaultData;
}

export function saveUserRewardData(userId, data) {
  if (!userId) return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save rewards to localStorage', e);
  }
}

/**
 * Increments active time spent in app.
 * If 3600 seconds are reached, awards +10 coins and resets the countdown.
 */
export function addActiveSeconds(userId, deltaSec = 10) {
  const current = getUserRewardData(userId);
  let newSeconds = current.progressSeconds + deltaSec;
  let awarded = false;
  let newCoins = current.coins;

  if (newSeconds >= SECONDS_FOR_REWARD) {
    newCoins += REWARD_COIN_AMOUNT;
    newSeconds = newSeconds % SECONDS_FOR_REWARD;
    awarded = true;
  }

  const updated = {
    ...current,
    coins: newCoins,
    progressSeconds: newSeconds
  };
  saveUserRewardData(userId, updated);

  return {
    awarded,
    coins: newCoins,
    progressSeconds: newSeconds,
    data: updated
  };
}

/**
 * Opens a mystery box (costs 10 coins).
 * Uses weighted probability: Common 45%, Rare 35%, Epic 15%, Legendary 5%.
 */
export function openMysteryBox(userId) {
  const current = getUserRewardData(userId);
  if (current.coins < BOX_COST) {
    return { success: false, error: 'Недостаточно коинов (требуется 10 🪙)' };
  }

  // Deduct cost
  let newCoins = current.coins - BOX_COST;

  // Roll rarity
  const rand = Math.random() * 100;
  let targetRarity = 'common';
  if (rand < 5) {
    targetRarity = 'legendary';
  } else if (rand < 20) {
    targetRarity = 'epic';
  } else if (rand < 55) {
    targetRarity = 'rare';
  } else {
    targetRarity = 'common';
  }

  // Filter items of target rarity
  let candidates = REWARD_ITEMS.filter((item) => item.rarity === targetRarity);
  if (candidates.length === 0) {
    candidates = REWARD_ITEMS;
  }

  const wonItem = candidates[Math.floor(Math.random() * candidates.length)];
  const isDuplicate = current.unlockedIds.includes(wonItem.id);

  let newUnlockedIds = [...current.unlockedIds];
  if (!isDuplicate) {
    newUnlockedIds.push(wonItem.id);
  } else {
    // Duplicate compensation
    newCoins += DUPLICATE_CASHBACK;
  }

  const updated = {
    ...current,
    coins: newCoins,
    unlockedIds: newUnlockedIds
  };
  saveUserRewardData(userId, updated);

  return {
    success: true,
    wonItem,
    isDuplicate,
    cashback: isDuplicate ? DUPLICATE_CASHBACK : 0,
    totalCoins: newCoins,
    data: updated
  };
}

/**
 * Equips an item of given type ('frame', 'badge', 'glow')
 */
export function equipItem(userId, itemType, itemId) {
  const current = getUserRewardData(userId);
  const updated = {
    ...current,
    equipped: {
      ...current.equipped,
      [itemType]: itemId
    }
  };
  saveUserRewardData(userId, updated);
  return updated;
}

/**
 * Unequips an item of given type ('frame', 'badge', 'glow')
 */
export function unequipItem(userId, itemType) {
  const current = getUserRewardData(userId);
  const updated = {
    ...current,
    equipped: {
      ...current.equipped,
      [itemType]: null
    }
  };
  saveUserRewardData(userId, updated);
  return updated;
}
