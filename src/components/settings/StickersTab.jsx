import React from 'react';
import {
  Upload,
  Package,
  Sparkles,
  Film,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';

export default function StickersTab({
  stickerPackInput,
  setStickerPackInput,
  importLoading,
  importStatus,
  handleImportStickers,
  installedStickers
}) {
  return (
            <div className="settings-stickers-tab" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Import Section */}
              <div className="settings-section">
                <h5 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={16} /> Импортировать стикер-пак</h5>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Вставьте имя стикер-пака или ссылку на него из Telegram (например: <code>https://t.me/addstickers/set_name</code>)
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Имя или ссылка на пак..."
                    value={stickerPackInput}
                    onChange={(e) => setStickerPackInput(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    disabled={importLoading}
                  />
                  <button
                    type="button"
                    className="btn-primary auth-submit-btn"
                    onClick={handleImportStickers}
                    disabled={importLoading || !stickerPackInput.trim()}
                    style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', margin: 0 }}
                  >
                    {importLoading ? 'Импорт...' : 'Импорт'}
                  </button>
                </div>
                {importStatus.text && (
                  <div style={{ marginTop: '8px', fontSize: '12.5px', color: importStatus.type === 'error' ? '#ff4d4f' : '#2ecc71', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {importStatus.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                    <span>{importStatus.text}</span>
                  </div>
                )}
              </div>

              {/* List of installed packs */}
              <div className="settings-section">
                <h5 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={16} />
                  <span>Ваши стикер-паки ({installedStickers.length})</span>
                </h5>
                {installedStickers.length === 0 ? (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>
                    У вас пока нет установленных стикер-паков
                  </p>
                ) : (
                  <div className="installed-packs-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {installedStickers.map(pack => (
                      <div
                        key={pack.id}
                        className="installed-pack-item"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: 'var(--bg-input)',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                            {pack.is_animated ? <Sparkles size={18} /> : pack.is_video ? <Film size={18} /> : <ImageIcon size={18} />}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)' }}>
                              {pack.title}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {pack.stickers?.length || 0} стикеров ({pack.is_animated ? 'анимированный' : pack.is_video ? 'видео' : 'статический'})
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
  );
}
