import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRewards } from '../../context/RewardContext';
import { ItemSvgIcon, SvgCardDeck, SvgCardBack } from './RewardIcons';
import { 
  playCardShuffleSound, 
  playCardDrawSound, 
  playCardFlipChime 
} from '../../services/caseSoundService';
import { 
  X, 
  Sparkles, 
  Clock, 
  Check, 
  Lock, 
  Info, 
  Volume2, 
  VolumeX,
  Zap,
  Layers,
  Palette
} from 'lucide-react';
import './RewardsModal.css';

export default function RewardsModal({ onClose }) {
  const { currentUser } = useAuth();
  const {
    coins,
    progressPercent,
    minutesRemaining,
    unlockedIds,
    equipped,
    openBox,
    claimBonus,
    equip,
    unequip,
    catalog
  } = useRewards();

  const [activeTab, setActiveTab] = useState('booster'); // 'booster' | 'customizer' | 'rates'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'frame' | 'badge' | 'glow'
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Booster Opening Stages: 'idle' -> 'shuffling' -> 'reveal'
  const [boosterStage, setBoosterStage] = useState('idle');
  const [wonItemResult, setWonItemResult] = useState(null); // { wonItem, isDuplicate, cashback }
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Live Try-on state for Discord Profile Customizer
  const [previewEquipped, setPreviewEquipped] = useState({
    frame: equipped.frame,
    badge: equipped.badge,
    glow: equipped.glow
  });

  // Sync preview when equipped items change
  useEffect(() => {
    setPreviewEquipped({
      frame: equipped.frame,
      badge: equipped.badge,
      glow: equipped.glow
    });
  }, [equipped]);

  const handleStartBooster = () => {
    if (coins < 10 || boosterStage !== 'idle') return;

    // 1. Roll winner from service
    const result = openBox();
    if (!result.success) return;

    setWonItemResult(result);
    setBoosterStage('shuffling');
    setIsCardFlipped(false);

    if (soundEnabled) {
      playCardShuffleSound();
    }

    // 2. After 1.6s shuffle, draw card to center
    setTimeout(() => {
      setBoosterStage('reveal');
      if (soundEnabled) {
        playCardDrawSound();
      }

      // 3. Flip card 180° after drawing
      setTimeout(() => {
        setIsCardFlipped(true);
        if (soundEnabled) {
          playCardFlipChime(result.wonItem.rarity);
        }
      }, 400);
    }, 1600);
  };

  const handleTryOn = (item) => {
    setPreviewEquipped((prev) => ({
      ...prev,
      [item.type]: prev[item.type] === item.id ? null : item.id
    }));
  };

  const filteredCatalog = catalog.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  // User display metadata for live preview
  const displayName = currentUser?.username || 'CoinyUser';
  const initialLetter = (displayName[0] || 'C').toUpperCase();

  // Find previewed item objects
  const activeFrameItem = catalog.find((i) => i.id === previewEquipped.frame);
  const activeBadgeItem = catalog.find((i) => i.id === previewEquipped.badge);
  const activeGlowClass = catalog.find((i) => i.id === previewEquipped.glow)?.className || '';

  return (
    <div className="rewards-modal-backdrop" onClick={onClose}>
      <div className="rewards-modal-container discord-theme" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="rewards-modal-header">
          <div className="rewards-header-title">
            <Sparkles size={22} className="rewards-header-icon" />
            <div>
              <h2>Coiny Украшения Профиля</h2>
              <p>Коллекционные рамки аватара, значки и эффекты профиля</p>
            </div>
          </div>
          <div className="rewards-header-controls">
            <button 
              type="button" 
              className="sound-toggle-btn"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button type="button" className="rewards-modal-close" onClick={onClose} aria-label="Закрыть">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Balance & Timer Ribbon */}
        <div className="rewards-balance-ribbon">
          <div className="rewards-balance-chip">
            <span className="balance-coin-symbol">🪙</span>
            <div className="balance-info">
              <span className="balance-label">Баланс коинов</span>
              <strong className="balance-val">{coins} 🪙</strong>
            </div>
            {coins < 10 && (
              <button 
                type="button" 
                className="free-bonus-btn"
                onClick={() => claimBonus(10)}
                title="Получить 10 коинов для открытия бустера прямо сейчас"
              >
                <Zap size={14} />
                <span>+10 🪙 Бонус</span>
              </button>
            )}
          </div>

          <div className="rewards-timer-chip">
            <Clock size={16} className="timer-icon" />
            <div className="timer-info">
              <div className="timer-top-row">
                <span>Дроп +10 🪙:</span>
                <strong>{minutesRemaining} мин</strong>
              </div>
              <div className="rewards-progress-mini">
                <div className="rewards-progress-bar" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="rewards-tabs-row">
          <button
            type="button"
            className={`rewards-tab-btn ${activeTab === 'booster' ? 'active' : ''}`}
            onClick={() => { setActiveTab('booster'); setBoosterStage('idle'); }}
          >
            <Layers size={16} />
            <span>Бустер Карт</span>
          </button>
          <button
            type="button"
            className={`rewards-tab-btn ${activeTab === 'customizer' ? 'active' : ''}`}
            onClick={() => setActiveTab('customizer')}
          >
            <Palette size={16} />
            <span>Инвентарь & Примерка ({unlockedIds.length}/{catalog.length})</span>
          </button>
          <button
            type="button"
            className={`rewards-tab-btn ${activeTab === 'rates' ? 'active' : ''}`}
            onClick={() => setActiveTab('rates')}
          >
            <Info size={16} />
            <span>Шансы</span>
          </button>
        </div>

        {/* TAB 1: CARD BOOSTER OPENING */}
        {activeTab === 'booster' && (
          <div className="booster-stage-view">
            {/* Stage 1: Idle Deck */}
            {boosterStage === 'idle' && (
              <>
                <div className="deck-idle-hero">
                  <div className="deck-halo-glow" />
                  <div className="deck-3d-wrapper">
                    <SvgCardDeck size={200} />
                  </div>
                  <div className="deck-info-meta">
                    <h3 className="deck-title">Коллекционный Бустер Coiny</h3>
                    <p className="deck-subtitle">Запечатанная колода с уникальными украшениями аватара и профиля</p>
                  </div>
                </div>

                {/* Possible Drops */}
                <div className="booster-contents-block">
                  <span className="booster-contents-label">Возможные украшения из колоды:</span>
                  <div className="booster-contents-scroll">
                    {catalog.map((item) => (
                      <div 
                        key={item.id} 
                        className="booster-mini-card"
                        style={{ borderBottomColor: item.rarityColor }}
                        title={`${item.name} (${item.rarityLabel})`}
                      >
                        <ItemSvgIcon item={item} size={36} />
                        <span className="booster-mini-card-name">{item.name}</span>
                        <span className="booster-mini-card-rarity" style={{ color: item.rarityColor }}>
                          {item.rarityLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Open Button */}
                <div className="booster-open-actions">
                  <button
                    type="button"
                    className="booster-open-btn"
                    onClick={handleStartBooster}
                    disabled={coins < 10}
                  >
                    <Layers size={18} />
                    <span>Открыть Бустер Карт (10 🪙)</span>
                  </button>
                  {coins < 10 && (
                    <button 
                      type="button" 
                      className="free-bonus-btn"
                      onClick={() => claimBonus(10)}
                    >
                      <Zap size={14} />
                      <span>Взять +10 🪙 бесплатно</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Stage 2: Riffle Card Shuffle */}
            {boosterStage === 'shuffling' && (
              <div className="card-shuffle-arena">
                <div className="riffle-shuffle-container">
                  <div className="shuffle-sparkles-burst" />
                  <div className="shuffle-card-left">
                    <SvgCardBack size={130} />
                  </div>
                  <div className="shuffle-card-right">
                    <SvgCardBack size={130} />
                  </div>
                </div>
                <span className="shuffle-status-label">
                  <Sparkles size={16} />
                  <span>Перемешиваем колоду карт...</span>
                </span>
              </div>
            )}

            {/* Stage 3: 3D Card Flip Reveal */}
            {boosterStage === 'reveal' && wonItemResult && (
              <div className="card-flip-reveal-stage">
                <div className={`card-flipper-3d ${isCardFlipped ? 'flipped' : ''}`}>
                  {/* Face Back (Face down before flip) */}
                  <div className="card-face card-face-back">
                    <SvgCardBack size={260} />
                  </div>

                  {/* Face Front (Holographic item revealed) */}
                  <div 
                    className="card-face card-face-front"
                    style={{ borderColor: wonItemResult.wonItem.rarityColor }}
                  >
                    <div className="card-holo-shine" />
                    
                    <div 
                      className="card-front-badge" 
                      style={{ backgroundColor: `${wonItemResult.wonItem.rarityColor}22`, color: wonItemResult.wonItem.rarityColor }}
                    >
                      <Sparkles size={13} />
                      <span>{wonItemResult.wonItem.rarityLabel}</span>
                    </div>

                    <div className="card-front-svg">
                      <ItemSvgIcon item={wonItemResult.wonItem} size={92} />
                    </div>

                    <div>
                      <h3 className="card-front-title">{wonItemResult.wonItem.name}</h3>
                      <p className="card-front-desc">{wonItemResult.wonItem.description}</p>
                    </div>

                    {wonItemResult.isDuplicate && (
                      <div className="rates-cashback-notice" style={{ padding: '6px 12px', fontSize: '11.5px', marginTop: '4px' }}>
                        <span>Повторка! Кэшбэк: +{wonItemResult.cashback} 🪙</span>
                      </div>
                    )}

                    <div className="card-front-actions">
                      <button
                        type="button"
                        className="btn-card-equip"
                        onClick={() => {
                          equip(wonItemResult.wonItem.type, wonItemResult.wonItem.id);
                          setActiveTab('customizer');
                        }}
                      >
                        <Check size={15} />
                        <span>{equipped[wonItemResult.wonItem.type] === wonItemResult.wonItem.id ? 'Надето' : 'Экипировать'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-card-next"
                        onClick={() => setBoosterStage('idle')}
                      >
                        <span>Ещё бустер</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISCORD LIVE CUSTOMIZER & INVENTORY */}
        {activeTab === 'customizer' && (
          <div className="customizer-view-container">
            
            {/* Live Discord-Style Profile Preview Card */}
            <div className="discord-profile-preview-card">
              <div className={`discord-profile-banner ${activeGlowClass}`} />
              <div className="discord-profile-body">
                <div className="discord-avatar-anchor">
                  <div className="discord-avatar-circle">
                    {currentUser?.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      initialLetter
                    )}
                  </div>
                  {/* Overlay Previewed/Equipped Decoration Frame */}
                  {activeFrameItem && (
                    <div className="discord-avatar-frame-overlay">
                      <ItemSvgIcon item={activeFrameItem} size={96} />
                    </div>
                  )}
                </div>

                <div className="discord-user-details">
                  <div className="discord-name-row">
                    <span className="discord-display-name">{displayName}</span>
                    {activeBadgeItem && (
                      <span className="discord-status-badge" title={activeBadgeItem.name}>
                        {activeBadgeItem.symbol}
                      </span>
                    )}
                  </div>
                  <span className="discord-username-tag">@{currentUser?.username || 'user'}</span>
                </div>

                <div className="discord-tryon-pill">
                  <span>Предпросмотр профиля</span>
                </div>
              </div>
            </div>

            {/* Category Filters */}
            <div className="customizer-filters-row">
              <button
                type="button"
                className={`cust-filter-chip ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                Все украшения
              </button>
              <button
                type="button"
                className={`cust-filter-chip ${filterType === 'frame' ? 'active' : ''}`}
                onClick={() => setFilterType('frame')}
              >
                Рамки аватара
              </button>
              <button
                type="button"
                className={`cust-filter-chip ${filterType === 'badge' ? 'active' : ''}`}
                onClick={() => setFilterType('badge')}
              >
                Значки профиля
              </button>
              <button
                type="button"
                className={`cust-filter-chip ${filterType === 'glow' ? 'active' : ''}`}
                onClick={() => setFilterType('glow')}
              >
                Эффекты профиля
              </button>
            </div>

            {/* Grid of Collectibles */}
            <div className="customizer-grid">
              {filteredCatalog.map((item) => {
                const isUnlocked = unlockedIds.includes(item.id);
                const isEquipped = equipped[item.type] === item.id;
                const isCurrentlyPreviewed = previewEquipped[item.type] === item.id;

                return (
                  <div 
                    key={item.id} 
                    className={`discord-item-card ${isUnlocked ? 'unlocked' : 'locked'} ${isEquipped ? 'equipped' : ''}`}
                    style={{ borderBottomColor: isUnlocked ? item.rarityColor : undefined }}
                    onClick={() => handleTryOn(item)}
                    title="Нажмите, чтобы примерить на профиле выше"
                  >
                    <div className="card-header-status">
                      <span className="card-rarity-dot" style={{ backgroundColor: item.rarityColor }} title={item.rarityLabel} />
                      {isEquipped && <span className="card-equipped-badge">Надето</span>}
                      {!isEquipped && isCurrentlyPreviewed && (
                        <span className="card-equipped-badge" style={{ background: '#5865f2' }}>Примерка</span>
                      )}
                    </div>

                    <div className="card-item-preview">
                      <ItemSvgIcon item={item} size={42} />
                      {!isUnlocked && (
                        <div className="card-locked-overlay">
                          <Lock size={16} />
                        </div>
                      )}
                    </div>

                    <h4 className="card-item-name">{item.name}</h4>
                    <span className="card-item-rarity-tag" style={{ color: isUnlocked ? item.rarityColor : undefined }}>
                      {item.rarityLabel}
                    </span>

                    {isUnlocked ? (
                      <button
                        type="button"
                        className={`card-action-btn ${isEquipped ? 'unequip' : 'equip'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEquipped) {
                            unequip(item.type);
                          } else {
                            equip(item.type, item.id);
                          }
                        }}
                      >
                        {isEquipped ? 'Снять' : 'Надеть'}
                      </button>
                    ) : (
                      <span className="card-locked-label">В бустерах</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: DROP RATES */}
        {activeTab === 'rates' && (
          <div className="rates-view-container">
            <h3>Шансы выпадения украшений</h3>
            <p className="rates-subtitle">Точное распределение вероятностей в коллекционном бустере карт:</p>

            <div className="rates-list-cards">
              <div className="rate-item-card special">
                <div className="rate-rarity-badge">
                  <span className="rate-rarity-dot" style={{ backgroundColor: '#ffd700' }} />
                  <strong>★ Легендарные украшения (Legendary)</strong>
                </div>
                <span className="rate-percentage-value">5%</span>
              </div>

              <div className="rate-item-card covert">
                <div className="rate-rarity-badge">
                  <span className="rate-rarity-dot" style={{ backgroundColor: '#eb4b4b' }} />
                  <strong>🔴 Мифические украшения (Mythic)</strong>
                </div>
                <span className="rate-percentage-value">12%</span>
              </div>

              <div className="rate-item-card classified">
                <div className="rate-rarity-badge">
                  <span className="rate-rarity-dot" style={{ backgroundColor: '#d32ce6' }} />
                  <strong>🌸 Эпические украшения (Epic)</strong>
                </div>
                <span className="rate-percentage-value">18%</span>
              </div>

              <div className="rate-item-card restricted">
                <div className="rate-rarity-badge">
                  <span className="rate-rarity-dot" style={{ backgroundColor: '#8847ff' }} />
                  <strong>🟣 Редкие украшения (Rare)</strong>
                </div>
                <span className="rate-percentage-value">28%</span>
              </div>

              <div className="rate-item-card milspec">
                <div className="rate-rarity-badge">
                  <span className="rate-rarity-dot" style={{ backgroundColor: '#4b69ff' }} />
                  <strong>🔵 Базовые украшения (Standard)</strong>
                </div>
                <span className="rate-percentage-value">37%</span>
              </div>
            </div>

            <div className="rates-cashback-notice">
              <Sparkles size={18} />
              <span>При выпадении повторного украшения вам моментально начисляется кэшбэк <strong>+5 🪙</strong>!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
