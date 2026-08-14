import React, { useState } from 'react';
import { useRewards } from '../../context/RewardContext';
import { 
  X, 
  Gift, 
  Sparkles, 
  Clock, 
  Check, 
  Lock, 
  Info, 
  Award
} from 'lucide-react';

export default function RewardsModal({ onClose }) {
  const {
    coins,
    progressPercent,
    minutesRemaining,
    unlockedIds,
    equipped,
    openBox,
    equip,
    unequip,
    catalog
  } = useRewards();

  const [activeTab, setActiveTab] = useState('box'); // 'box' | 'inventory' | 'rates'
  const [inventoryFilter, setInventoryFilter] = useState('all'); // 'all' | 'frame' | 'badge' | 'glow'
  const [isOpening, setIsOpening] = useState(false);
  const [wonResult, setWonResult] = useState(null); // { wonItem, isDuplicate, cashback }

  const handleStartOpening = () => {
    if (coins < 10 || isOpening) return;
    setIsOpening(true);
    setWonResult(null);

    // 2.2 second suspenseful unboxing animation sequence
    setTimeout(() => {
      const result = openBox();
      if (result.success) {
        setWonResult(result);
      }
      setIsOpening(false);
    }, 2200);
  };

  const handleEquipWon = () => {
    if (!wonResult?.wonItem) return;
    equip(wonResult.wonItem.type, wonResult.wonItem.id);
  };

  const filteredCatalog = catalog.filter((item) => {
    if (inventoryFilter === 'all') return true;
    return item.type === inventoryFilter;
  });

  return (
    <div className="rewards-modal-backdrop" onClick={onClose}>
      <div className="rewards-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rewards-modal-header">
          <div className="rewards-header-title">
            <Gift size={22} className="rewards-header-icon" />
            <div>
              <h2>Coiny Награды & Кейсы</h2>
              <p>Уникальные украшения для вашего профиля</p>
            </div>
          </div>
          <button type="button" className="rewards-modal-close" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>

        {/* Balance & Timer Ribbon */}
        <div className="rewards-balance-ribbon">
          <div className="rewards-balance-chip">
            <span className="balance-coin-symbol">🪙</span>
            <div className="balance-info">
              <span className="balance-label">Ваш баланс</span>
              <strong className="balance-val">{coins} Коинов</strong>
            </div>
          </div>

          <div className="rewards-timer-chip">
            <Clock size={16} className="timer-icon" />
            <div className="timer-info">
              <div className="timer-top-row">
                <span>До +10 🪙:</span>
                <strong>{minutesRemaining} мин</strong>
              </div>
              <div className="rewards-progress-mini">
                <div className="rewards-progress-bar" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="rewards-tabs-row">
          <button
            type="button"
            className={`rewards-tab-btn ${activeTab === 'box' ? 'active' : ''}`}
            onClick={() => { setActiveTab('box'); setWonResult(null); }}
          >
            <Gift size={16} />
            <span>Лутбокс</span>
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

        {/* Tab 1: Mystery Box Opening Stage */}
        {activeTab === 'box' && (
          <div className="rewards-box-stage">
            {!wonResult ? (
              <div className="box-unopened-view">
                <div className={`box-chest-wrap ${isOpening ? 'opening' : ''}`}>
                  {isOpening && <div className="box-light-rays" />}
                  <div className="box-chest-halo" />
                  <div className="box-chest-3d">
                    <span className="chest-emoji">🎁</span>
                  </div>
                </div>

                {isOpening ? (
                  <div className="box-opening-status">
                    <Sparkles size={20} className="sparkle-spin" />
                    <span>Открываем таинственный бокс...</span>
                  </div>
                ) : (
                  <div className="box-action-section">
                    <button
                      type="button"
                      className="box-open-btn"
                      onClick={handleStartOpening}
                      disabled={coins < 10}
                    >
                      <Gift size={18} />
                      <span>Открыть Бокс (10 🪙)</span>
                    </button>
                    {coins < 10 && (
                      <p className="box-need-coins-hint">
                        Не хватает {10 - coins} 🪙. Проведите ещё немного времени в мессенджере!
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Reward Reveal Card */
              <div className="box-won-view animate-fade-in">
                <div className="won-card" style={{ borderColor: wonResult.wonItem.rarityColor }}>
                  <div className="won-card-shine" style={{ background: `radial-gradient(circle, ${wonResult.wonItem.rarityColor}33 0%, transparent 70%)` }} />
                  
                  <div className="won-item-preview">
                    <span className="won-item-icon">{wonResult.wonItem.icon}</span>
                  </div>

                  <div className="won-rarity-tag" style={{ backgroundColor: `${wonResult.wonItem.rarityColor}22`, color: wonResult.wonItem.rarityColor }}>
                    {wonResult.wonItem.rarityLabel}
                  </div>

                  <h3 className="won-item-name">{wonResult.wonItem.name}</h3>
                  <p className="won-item-desc">{wonResult.wonItem.description}</p>

                  {wonResult.isDuplicate && (
                    <div className="won-duplicate-badge">
                      <span>Повторка! Возврат: +{wonResult.cashback} 🪙</span>
                    </div>
                  )}

                  <div className="won-actions-row">
                    <button
                      type="button"
                      className="won-equip-btn"
                      onClick={() => {
                        handleEquipWon();
                        setActiveTab('inventory');
                      }}
                    >
                      <Check size={16} />
                      <span>{equipped[wonResult.wonItem.type] === wonResult.wonItem.id ? 'Уже надето' : 'Экипировать'}</span>
                    </button>
                    <button
                      type="button"
                      className="won-again-btn"
                      onClick={() => setWonResult(null)}
                    >
                      <span>Открыть ещё</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Inventory */}
        {activeTab === 'inventory' && (
          <div className="rewards-inventory-view">
            <div className="inventory-filters-row">
              <button
                type="button"
                className={`inv-filter-chip ${inventoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setInventoryFilter('all')}
              >
                Все
              </button>
              <button
                type="button"
                className={`inv-filter-chip ${inventoryFilter === 'frame' ? 'active' : ''}`}
                onClick={() => setInventoryFilter('frame')}
              >
                Рамки
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
                Аура
              </button>
            </div>

            <div className="inventory-grid">
              {filteredCatalog.map((item) => {
                const isUnlocked = unlockedIds.includes(item.id);
                const isEquipped = equipped[item.type] === item.id;

                return (
                  <div 
                    key={item.id} 
                    className={`inventory-card ${isUnlocked ? 'unlocked' : 'locked'} ${isEquipped ? 'equipped' : ''}`}
                    style={{ borderColor: isUnlocked ? item.rarityColor : undefined }}
                  >
                    <div className="inv-card-header">
                      <span className="inv-rarity-dot" style={{ backgroundColor: item.rarityColor }} title={item.rarityLabel} />
                      {isEquipped && <span className="inv-equipped-badge">Надето</span>}
                    </div>

                    <div className="inv-card-preview">
                      <span className="inv-card-icon">{item.icon}</span>
                      {!isUnlocked && (
                        <div className="inv-locked-overlay">
                          <Lock size={18} />
                        </div>
                      )}
                    </div>

                    <h4 className="inv-card-name">{item.name}</h4>
                    <span className="inv-card-type">
                      {item.type === 'frame' ? 'Рамка' : item.type === 'badge' ? 'Значок' : 'Аура'} • {item.rarityLabel}
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

        {/* Tab 3: Drop Rates */}
        {activeTab === 'rates' && (
          <div className="rewards-rates-view animate-fade-in">
            <h3>Шансы выпадения из Coiny Бокса</h3>
            <p className="rates-subtitle">Каждый бокс гарантированно содержит 1 предмет:</p>

            <div className="rates-list">
              <div className="rate-item">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#94a3b8' }} />
                  <strong>⚪ Обычный (Common)</strong>
                </div>
                <span className="rate-percent">45%</span>
              </div>

              <div className="rate-item">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#38bdf8' }} />
                  <strong>🔵 Редкий (Rare)</strong>
                </div>
                <span className="rate-percent">35%</span>
              </div>

              <div className="rate-item">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#c084fc' }} />
                  <strong>🟣 Эпический (Epic)</strong>
                </div>
                <span className="rate-percent">15%</span>
              </div>

              <div className="rate-item legendary">
                <div className="rate-rarity">
                  <span className="rate-color-pill" style={{ backgroundColor: '#fbbf24' }} />
                  <strong>🟡 Легендарный (Legendary)</strong>
                </div>
                <span className="rate-percent">5%</span>
              </div>
            </div>

            <div className="rates-footer-info">
              <Sparkles size={16} />
              <span>При выпадении дубликата начисляется кэшбэк +5 🪙 обратно на баланс!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
