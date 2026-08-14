import React, { useState, useRef, useEffect } from 'react';
import { useRewards } from '../../context/RewardContext';
import { ItemSvgIcon, SvgWeaponCase } from './RewardIcons';
import { 
  playCaseTickSound, 
  playCaseWhoosh, 
  playCaseWinFanfare 
} from '../../services/caseSoundService';
import { 
  X, 
  Gift, 
  Clock, 
  Check, 
  Lock, 
  Info, 
  Award, 
  Sparkles, 
  Volume2, 
  VolumeX,
  Zap
} from 'lucide-react';
import './RewardsModal.css';

const CARD_WIDTH = 150;
const CARD_GAP = 8;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const TARGET_INDEX = 48; // Index of the won item in the 60-card tape

export default function RewardsModal({ onClose }) {
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

  const [activeTab, setActiveTab] = useState('box'); // 'box' | 'inventory' | 'rates'
  const [inventoryFilter, setInventoryFilter] = useState('all'); // 'all' | 'frame' | 'badge' | 'glow'
  const [soundEnabled, setSoundEnabled] = useState(true);

  // CS2 Case Stage: 'preview' (3D Case) -> 'roulette' (Spinning Reel) -> 'inspect' (Won Item Reveal)
  const [stage, setStage] = useState('preview');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rouletteItems, setRouletteItems] = useState([]);
  const [translateX, setTranslateX] = useState(0);
  const [inspectItem, setInspectItem] = useState(null); // { wonItem, isDuplicate, cashback }
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const reelContainerRef = useRef(null);
  const audioIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, []);

  const handleStartUnlock = () => {
    if (coins < 10 || isSpinning) return;

    // 1. Roll winner from service
    const result = openBox();
    if (!result.success) return;

    // 2. Generate 60 randomized items for the horizontal tape with winner at TARGET_INDEX
    const generated = [];
    for (let i = 0; i < 60; i++) {
      if (i === TARGET_INDEX) {
        generated.push(result.wonItem);
      } else {
        const randomItem = catalog[Math.floor(Math.random() * catalog.length)];
        generated.push(randomItem);
      }
    }

    setRouletteItems(generated);
    setInspectItem(null);
    setStage('roulette');
    setIsSpinning(true);
    setTranslateX(0);

    if (soundEnabled) {
      playCaseWhoosh();
    }

    // 3. Compute target scroll offset with random sub-card jitter (-35px to +35px)
    setTimeout(() => {
      const containerWidth = reelContainerRef.current?.offsetWidth || 700;
      const jitter = (Math.random() * 70) - 35;
      const finalOffset = (TARGET_INDEX * CARD_STEP) + (CARD_WIDTH / 2) - (containerWidth / 2) + jitter;
      setTranslateX(finalOffset);

      // Procedural audio ticker simulation that slows down with the cubic bezier
      if (soundEnabled) {
        let elapsed = 0;
        let tickDelay = 30; // Starts fast (30ms)
        
        const scheduleNextTick = () => {
          if (elapsed >= 5400) return;
          playCaseTickSound(650 + Math.random() * 150, 0.14);
          elapsed += tickDelay;
          tickDelay = 30 + Math.pow(elapsed / 5400, 3) * 450;
          audioIntervalRef.current = setTimeout(scheduleNextTick, tickDelay);
        };
        scheduleNextTick();
      }
    }, 60);

    // 4. Reveal & Inspect Winner when roulette comes to a complete halt (5.5s)
    setTimeout(() => {
      setIsSpinning(false);
      setInspectItem(result);
      setStage('inspect');
      if (soundEnabled) {
        playCaseWinFanfare(result.wonItem.rarity);
      }
    }, 5600);
  };

  const handleMouseMoveInspect = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 18, y: -y * 18 });
  };

  const handleMouseLeaveInspect = () => {
    setTilt({ x: 0, y: 0 });
  };

  const filteredCatalog = catalog.filter((item) => {
    if (inventoryFilter === 'all') return true;
    return item.type === inventoryFilter;
  });

  return (
    <div className="rewards-modal-backdrop" onClick={onClose}>
      <div className="rewards-modal-container cs2-theme" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="rewards-modal-header">
          <div className="rewards-header-title">
            <Gift size={22} className="rewards-header-icon" />
            <div>
              <h2>Coiny Кейсы & Оружейная</h2>
              <p>Официальные контейнеры со скинами и украшениями профиля</p>
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
                title="Получить 10 коинов для открытия кейса прямо сейчас"
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
            className={`rewards-tab-btn ${activeTab === 'box' ? 'active' : ''}`}
            onClick={() => { setActiveTab('box'); setStage('preview'); setInspectItem(null); }}
          >
            <Gift size={16} />
            <span>Кейс CS2</span>
          </button>
          <button
            type="button"
            className={`rewards-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Award size={16} />
            <span>Инвентарь ({unlockedIds.length}/{catalog.length})</span>
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

        {/* TAB 1: CS2 CASE OPENING STAGES */}
        {activeTab === 'box' && (
          <>
            {/* STAGE 1: 3D Case Preview & Contents List */}
            {stage === 'preview' && (
              <div className="cs2-preview-stage">
                <div className="cs2-case-hero">
                  <div className="cs2-case-halo" />
                  <div className="cs2-case-3d-box">
                    <SvgWeaponCase size={210} className="case-svg-container" />
                  </div>
                  <div className="cs2-case-info-meta">
                    <h3 className="cs2-case-title">Coiny // Bravo Container</h3>
                    <p className="cs2-case-subtitle">Коллекция эксклюзивных рамок, значков и аур</p>
                  </div>
                </div>

                {/* Contents Gallery */}
                <div className="cs2-case-contents-block">
                  <span className="cs2-contents-label">Возможный дроп из контейнера:</span>
                  <div className="cs2-contents-scroll">
                    {catalog.map((item) => (
                      <div 
                        key={item.id} 
                        className="cs2-mini-card"
                        style={{ borderBottomColor: item.rarityColor }}
                        title={`${item.name} (${item.rarityLabel})`}
                      >
                        <ItemSvgIcon item={item} size={36} />
                        <span className="cs2-mini-card-name">{item.name}</span>
                        <span className="cs2-mini-card-rarity" style={{ color: item.rarityColor }}>
                          {item.rarityLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <div className="cs2-preview-actions">
                  <button
                    type="button"
                    className="cs2-unlock-container-btn"
                    onClick={handleStartUnlock}
                    disabled={coins < 10}
                  >
                    <Gift size={18} />
                    <span>Разблокировать контейнер (10 🪙)</span>
                  </button>
                  {coins < 10 && (
                    <p className="box-need-coins-hint">
                      <span>Не хватает {10 - coins} 🪙.</span>
                      <button 
                        type="button" 
                        className="free-bonus-btn"
                        onClick={() => claimBonus(10)}
                        style={{ margin: 0 }}
                      >
                        <Zap size={13} />
                        <span>Взять +10 🪙 бесплатно</span>
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 2: High-Speed Roulette Reel */}
            {stage === 'roulette' && (
              <div className="rewards-box-stage cs2-roulette-stage">
                <div className="cs2-unboxing-view">
                  <div className="cs2-roulette-wrapper" ref={reelContainerRef}>
                    {/* Central Gold Indicator Needle */}
                    <div className="cs2-center-needle">
                      <div className="needle-triangle-top" />
                      <div className="needle-line" />
                      <div className="needle-triangle-bottom" />
                    </div>

                    {/* Tape */}
                    <div 
                      className="cs2-roulette-tape"
                      style={{
                        transform: isSpinning || translateX > 0 ? `translateX(-${translateX}px)` : 'none',
                        transition: isSpinning ? 'transform 5.5s cubic-bezier(0.08, 0.82, 0.17, 1)' : 'none'
                      }}
                    >
                      {rouletteItems.map((item, idx) => (
                        <div 
                          key={`${item.id}-${idx}`} 
                          className="cs2-card"
                          style={{ borderColor: item.rarityColor }}
                        >
                          <div className="cs2-card-rarity-stripe" style={{ backgroundColor: item.rarityColor }} />
                          <div className="cs2-card-svg-wrap">
                            <ItemSvgIcon item={item} size={64} />
                          </div>
                          <div className="cs2-card-info">
                            <span className="cs2-card-name">{item.name}</span>
                            <span className="cs2-card-type" style={{ color: item.rarityColor }}>
                              {item.rarityLabel}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="cs2-action-bar">
                    <button type="button" className="cs2-unlock-container-btn" disabled>
                      <Sparkles size={18} className="sparkle-spin" />
                      <span>Открываем контейнер...</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 3: 3D Inspect Reveal Card */}
            {stage === 'inspect' && inspectItem && (
              <div className="rewards-box-stage">
                <div className="cs2-inspect-container">
                  <div 
                    className="cs2-inspect-card"
                    style={{
                      borderColor: inspectItem.wonItem.rarityColor,
                      transform: `perspective(800px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`
                    }}
                    onMouseMove={handleMouseMoveInspect}
                    onMouseLeave={handleMouseLeaveInspect}
                  >
                    <div 
                      className="cs2-inspect-rays" 
                      style={{ background: `radial-gradient(circle, ${inspectItem.wonItem.rarityColor}55 0%, transparent 70%)` }} 
                    />

                    <div className="cs2-inspect-badge" style={{ backgroundColor: `${inspectItem.wonItem.rarityColor}22`, color: inspectItem.wonItem.rarityColor }}>
                      <Sparkles size={13} />
                      <span>{inspectItem.wonItem.rarityLabel}</span>
                    </div>

                    <div className="cs2-inspect-svg">
                      <ItemSvgIcon item={inspectItem.wonItem} size={105} />
                    </div>

                    <h3 className="cs2-inspect-title">{inspectItem.wonItem.name}</h3>
                    <p className="cs2-inspect-desc">{inspectItem.wonItem.description}</p>

                    {inspectItem.isDuplicate && (
                      <div className="won-duplicate-badge">
                        <span>Повторный предмет! Начислен кэшбэк: +{inspectItem.cashback} 🪙</span>
                      </div>
                    )}

                    <div className="cs2-inspect-actions">
                      <button
                        type="button"
                        className="cs2-btn-equip"
                        onClick={() => {
                          equip(inspectItem.wonItem.type, inspectItem.wonItem.id);
                          setActiveTab('inventory');
                        }}
                      >
                        <Check size={16} />
                        <span>{equipped[inspectItem.wonItem.type] === inspectItem.wonItem.id ? 'Уже надето' : 'Экипировать в профиль'}</span>
                      </button>
                      <button
                        type="button"
                        className="cs2-btn-next"
                        onClick={() => setStage('preview')}
                      >
                        <span>Открыть ещё</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="rewards-inventory-view">
            <div className="inventory-filters-row">
              <button
                type="button"
                className={`inv-filter-chip ${inventoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setInventoryFilter('all')}
              >
                Все скины
              </button>
              <button
                type="button"
                className={`inv-filter-chip ${inventoryFilter === 'frame' ? 'active' : ''}`}
                onClick={() => setInventoryFilter('frame')}
              >
                Рамки аватара
              </button>
              <button
                type="button"
                className={`inv-filter-chip ${inventoryFilter === 'badge' ? 'active' : ''}`}
                onClick={() => setInventoryFilter('badge')}
              >
                Значки
              </button>
              <button
                type="button"
                className={`inv-filter-chip ${inventoryFilter === 'glow' ? 'active' : ''}`}
                onClick={() => setInventoryFilter('glow')}
              >
                Ауры
              </button>
            </div>

            <div className="inventory-grid">
              {filteredCatalog.map((item) => {
                const isUnlocked = unlockedIds.includes(item.id);
                const isEquipped = equipped[item.type] === item.id;

                return (
                  <div 
                    key={item.id} 
                    className={`cs2-inv-card ${isUnlocked ? 'unlocked' : 'locked'} ${isEquipped ? 'equipped' : ''}`}
                    style={{ borderBottomColor: isUnlocked ? item.rarityColor : undefined }}
                  >
                    <div className="inv-card-header">
                      <span className="inv-rarity-dot" style={{ backgroundColor: item.rarityColor }} title={item.rarityLabel} />
                      {isEquipped && <span className="inv-equipped-badge">Надето</span>}
                    </div>

                    <div className="inv-card-preview">
                      <ItemSvgIcon item={item} size={42} />
                      {!isUnlocked && (
                        <div className="inv-locked-overlay">
                          <Lock size={16} />
                        </div>
                      )}
                    </div>

                    <h4 className="inv-card-name">{item.name}</h4>
                    <span className="inv-card-type" style={{ color: isUnlocked ? item.rarityColor : undefined }}>
                      {item.rarityLabel}
                    </span>

                    {isUnlocked ? (
                      <button
                        type="button"
                        className={`inv-card-action-btn ${isEquipped ? 'unequip' : 'equip'}`}
                        onClick={() => {
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
                      <span className="inv-locked-label">В кейсах</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: CS2 DROP RATES */}
        {activeTab === 'rates' && (
          <div className="rewards-rates-view">
            <h3>Шансы выпадения предметов CS2</h3>
            <p className="rates-subtitle">Точное распределение вероятностей контейнера Coiny // Bravo:</p>

            <div className="rates-list">
              <div className="rate-item milspec">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#4b69ff' }} />
                  <strong>🔵 Армейское качество (Mil-Spec)</strong>
                </div>
                <span className="rate-percent">37%</span>
              </div>

              <div className="rate-item restricted">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#8847ff' }} />
                  <strong>🟣 Запрещенное (Restricted)</strong>
                </div>
                <span className="rate-percent">28%</span>
              </div>

              <div className="rate-item classified">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#d32ce6' }} />
                  <strong>🌸 Засекриченное (Classified)</strong>
                </div>
                <span className="rate-percent">18%</span>
              </div>

              <div className="rate-item covert">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#eb4b4b' }} />
                  <strong>🔴 Тайное (Covert)</strong>
                </div>
                <span className="rate-percent">12%</span>
              </div>

              <div className="rate-item special">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#ffd700' }} />
                  <strong>🟡 Особо редкое ★ (Gold Special)</strong>
                </div>
                <span className="rate-percent">5%</span>
              </div>
            </div>

            <div className="rates-footer-info">
              <Sparkles size={18} />
              <span>При выпадении повторного предмета вам моментально возвращается кэшбэк <strong>+5 🪙</strong>!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
