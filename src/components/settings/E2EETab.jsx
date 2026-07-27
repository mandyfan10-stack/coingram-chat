import React from 'react';
import { Lock, Copy, Trash2, AlertCircle } from 'lucide-react';

export default function E2EETab({
  currentUser,
  e2eePrivateKey,
  setIsSettingsOpen,
  resetE2EE
}) {
  return (
            <div className="settings-e2ee-tab">
              <div className="settings-section e2ee-overview-section">
                <h5 className="section-title">
                  <Lock size={16} />
                  <span>Сквозное шифрование (E2EE)</span>
                </h5>
                <p className="section-desc">
                  Coiny защищает ваши личные переписки с помощью сквозного шифрования. Сообщения шифруются на вашем устройстве и расшифровываются только на устройстве получателя.
                </p>

                <div className="e2ee-status-card glass-panel">
                  <div className="status-row">
                    <span className="status-label">Статус E2EE:</span>
                    <span className={`status-badge ${currentUser.has_e2ee ? 'active' : 'inactive'}`}>
                      {currentUser.has_e2ee ? 'Активно' : 'Не настроено'}
                    </span>
                  </div>
                  {currentUser.has_e2ee && (
                    <>
                      <div className="status-row">
                        <span className="status-label">Ключи в RAM:</span>
                        <span className={`status-badge ${e2eePrivateKey ? 'active' : 'inactive'}`}>
                          {e2eePrivateKey ? 'Разблокированы' : 'Заблокированы'}
                        </span>
                      </div>
                      <div className="key-fingerprint-box">
                        <span className="fingerprint-label">Ваш публичный ключ (fingerprint):</span>
                        <div className="fingerprint-wrapper">
                          <code className="fingerprint-code">
                            {currentUser.public_key ? `${currentUser.public_key.substring(0, 32)}...${currentUser.public_key.substring(currentUser.public_key.length - 24)}` : 'Отсутствует'}
                          </code>
                          {currentUser.public_key && (
                            <button
                              type="button"
                              className="fingerprint-copy-btn"
                              onClick={() => {
                                navigator.clipboard.writeText(currentUser.public_key);
                                alert('Публичный ключ скопирован!');
                              }}
                              title="Копировать ключ"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="settings-section e2ee-info-card warning-accent">
                <h6 className="info-title">
                  <AlertCircle size={14} /> Важная информация по безопасности
                </h6>
                <p className="info-desc">
                  Ваш приватный ключ шифрования хранится на сервере в зашифрованном виде (защищен паролем и кодом восстановления). Сервер не знает ваших ключей и не имеет доступа к вашей переписке. **Обязательно сохраняйте код восстановления!**
                </p>
              </div>

              <div className="settings-section e2ee-reset-section">
                <h5 className="section-title danger-title">
                  <Trash2 size={16} /> Сброс шифрования
                </h5>
                <p className="section-desc">
                  Вы можете полностью сбросить настройки сквозного шифрования, если хотите сгенерировать новые ключи безопасности или утеряли свои данные.
                  <br />
                  <span className="warning-text">**Внимание:** Все прошлые зашифрованные сообщения в существующих диалогах станут недоступны для чтения.</span>
                </p>
                <button
                  type="button"
                  className="e2ee-reset-action-btn"
                  onClick={async () => {
                    if (window.confirm("Вы действительно хотите сбросить ключи шифрования? Это действие заблокирует чтение старых зашифрованных сообщений. Продолжить?")) {
                      setIsSettingsOpen(false);
                      const success = await resetE2EE();
                      if (success) {
                        alert("Настройки E2EE успешно сброшены. Вы сможете задать новый пароль шифрования при следующем входе в секретный чат.");
                      }
                    }
                  }}
                >
                  <Trash2 size={14} />
                  <span>Сбросить E2EE ключи</span>
                </button>
              </div>
            </div>
  );
}
