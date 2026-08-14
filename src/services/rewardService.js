/**
 * Coiny Rewards & Mystery Box Service
 * Manages user coin balances, 60-minute time tracking, lootbox drop mechanics,
 * and collectible profile decorations (frames, badges, glows).
 */

export const REWARD_ITEMS = [
  // --- ★ Легендарные украшения (5%) ---
  {
    id: 'frame_royal_gold',
    type: 'frame',
    name: 'Crown Sovereign ★',
    rarity: 'special',
    rarityLabel: '★ Легендарное',
    rarityColor: '#ffd700',
    description: 'Золотая корона монарха с парящими рубинами',
    className: 'frame-royal-gold'
  },
  {
    id: 'badge_crown',
    type: 'badge',
    name: 'Императорский Орел ★',
    symbol: '👑',
    rarity: 'special',
    rarityLabel: '★ Легендарное',
    rarityColor: '#ffd700',
    description: 'Золотой гербовый значок правителя'
  },
  {
    id: 'glow_solar',
    type: 'glow',
    name: 'Solar Supernova ★',
    rarity: 'special',
    rarityLabel: '★ Легендарное',
    rarityColor: '#ffd700',
    description: 'Ослепительный солнечный ореол вокруг карточки',
    className: 'glow-solar'
  },

  // --- 🔴 Мифические украшения (12%) ---
  {
    id: 'frame_inferno_flame',
    type: 'frame',
    name: "Dragon's Breath",
    rarity: 'covert',
    rarityLabel: 'Мифическое',
    rarityColor: '#eb4b4b',
    description: 'Пылающее драконье пламя с искрами',
    className: 'frame-inferno-flame'
  },
  {
    id: 'badge_fire',
    type: 'badge',
    name: 'Inferno Core',
    symbol: '🔥',
    rarity: 'covert',
    rarityLabel: 'Мифическое',
    rarityColor: '#eb4b4b',
    description: 'Раскаленное лавовое ядро активности'
  },

  // --- 🌸 Эпические украшения (18%) ---
  {
    id: 'frame_cyber_wave',
    type: 'frame',
    name: 'Hyperdrive Matrix',
    rarity: 'classified',
    rarityLabel: 'Эпическое',
    rarityColor: '#d32ce6',
    description: 'Голографический неоновый контур аватара',
    className: 'frame-cyber-wave'
  },
  {
    id: 'badge_diamond',
    type: 'badge',
    name: 'Prism Diamond',
    symbol: '💎',
    rarity: 'classified',
    rarityLabel: 'Эпическое',
    rarityColor: '#d32ce6',
    description: 'Сверкающий драгоценный кристалл'
  },
  {
    id: 'glow_amethyst',
    type: 'glow',
    name: 'Nebula Void',
    rarity: 'classified',
    rarityLabel: 'Эпическое',
    rarityColor: '#d32ce6',
    description: 'Глубокий космический фиолетовый туман',
    className: 'glow-amethyst'
  },

  // --- 🟣 Редкие украшения (28%) ---
  {
    id: 'frame_amethyst_crystal',
    type: 'frame',
    name: 'Obsidian Shard',
    rarity: 'restricted',
    rarityLabel: 'Редкое',
    rarityColor: '#8847ff',
    description: 'Ограненные осколки аметистового кристалла',
    className: 'frame-amethyst-crystal'
  },
  {
    id: 'badge_lightning',
    type: 'badge',
    name: 'Plasma Volt',
    symbol: '⚡',
    rarity: 'restricted',
    rarityLabel: 'Редкое',
    rarityColor: '#8847ff',
    description: 'Высоковольтный плазменный разряд'
  },
  {
    id: 'glow_sapphire',
    type: 'glow',
    name: 'Cryo Aurora',
    rarity: 'restricted',
    rarityLabel: 'Редкое',
    rarityColor: '#8847ff',
    description: 'Ледяное сапфировое северное сияние',
    className: 'glow-sapphire'
  },

  // --- 🔵 Базовые украшения (37%) ---
  {
    id: 'frame_neon_cyan',
    type: 'frame',
    name: 'Cyan Laser Ring',
    rarity: 'milspec',
    rarityLabel: 'Базовое',
    rarityColor: '#4b69ff',
    description: 'Кибернетическое неоновое кольцо аватара',
    className: 'frame-neon-cyan'
  },
  {
    id: 'frame_emerald_shield',
    type: 'frame',
    name: 'Aegis Matrix',
    rarity: 'milspec',
    rarityLabel: 'Базовое',
    rarityColor: '#4b69ff',
    description: 'Защитная изумрудная матрица',
    className: 'frame-emerald-shield'
  },
  {
    id: 'badge_rocket',
    type: 'badge',
    name: 'Orbital Thruster',
    symbol: '🚀',
    rarity: 'milspec',
    rarityLabel: 'Базовое',
    rarityColor: '#4b69ff',
    description: 'Значок космического полета'
  },
  {
    id: 'badge_coin',
    type: 'badge',
    name: 'Coiny Pioneer',
    symbol: '🪙',
    rarity: 'milspec',
    rarityLabel: 'Базовое',
    rarityColor: '#4b69ff',
    description: 'Официальный золотой жетон участника'
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
 * Grants instant bonus coins (e.g. starter/daily bonus)
 */
export function addBonusCoins(userId, amount = 10) {
  const current = getUserRewardData(userId);
  const updated = {
    ...current,
    coins: (current.coins || 0) + amount
  };
  saveUserRewardData(userId, updated);
  return updated;
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
    targetRarity = 'special';
  } else if (rand < 17) {
    targetRarity = 'covert';
  } else if (rand < 35) {
    targetRarity = 'classified';
  } else if (rand < 63) {
    targetRarity = 'restricted';
  } else {
    targetRarity = 'milspec';
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
