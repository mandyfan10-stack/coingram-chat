import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { LockKeyhole, ShieldAlert, Eye, EyeOff } from 'lucide-react';

export default function E2EESetupModal() {
  const { 
    currentUser, 
    authLoading, 
    isE2EESetupRequired, 
    e2eePrivateKey, 
    setupE2EE, 
    unlockE2EE 
  } = useChat();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading || !currentUser) return null;

  const needsSetup = isE2EESetupRequired;
  const needsUnlock = currentUser.encrypted_private_key && !e2eePrivateKey;

  if (!needsSetup && !needsUnlock) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!password) {
      setError('Пожалуйста, введите пароль.');
      return;
    }

    if (needsSetup) {
      if (password.length < 6) {
        setError('Пароль должен содержать не менее 6 символов.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Пароли не совпадают.');
        return;
      }

      setLoading(true);
      const success = await setupE2EE(password);
      setLoading(false);
      if (success) {
        setPassword('');
        setConfirmPassword('');
      } else {
        setError('Не удалось настроить шифрование. Попробуйте еще раз.');
      }
    } else if (needsUnlock) {
      setLoading(true);
      const success = await unlockE2EE(password);
      setLoading(false);
      if (success) {
        setPassword('');
      } else {
        setError('Неверный пароль. Пожалуйста, попробуйте снова.');
      }
    }
  };

  return (
    <div className="e2ee-modal-overlay">
      <div className="e2ee-modal-content">
        <div className="e2ee-modal-header">
          <div className="e2ee-icon-container">
            {needsSetup ? (
              <ShieldAlert className="e2ee-header-icon setup-icon" />
            ) : (
              <LockKeyhole className="e2ee-header-icon unlock-icon" />
            )}
          </div>
          <h2>
            {needsSetup ? 'Настройка шифрования (E2EE)' : 'Разблокировка E2EE'}
          </h2>
          <p className="e2ee-subtitle">
            {needsSetup 
              ? 'CoinGram защищает ваши личные переписки с помощью сквозного шифрования. Задайте секретный пароль для создания ваших ключей безопасности.' 
              : 'Введите ваш E2EE пароль для расшифровки истории сообщений на этом устройстве.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="e2ee-form">
          {error && <div className="e2ee-error-banner">{error}</div>}

          <div className="e2ee-input-group">
            <label htmlFor="e2ee-password">Пароль шифрования</label>
            <div className="password-input-wrapper">
              <input
                id="e2ee-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={needsSetup ? 'Придумайте надежный пароль' : 'Введите пароль'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {needsSetup && (
            <div className="e2ee-input-group">
              <label htmlFor="e2ee-confirm-password">Подтвердите пароль</label>
              <div className="password-input-wrapper">
                <input
                  id="e2ee-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {needsSetup && (
            <div className="e2ee-warning-notice">
              ⚠️ <strong>Внимание:</strong> Этот пароль не хранится на наших серверах. Если вы его забудете, мы не сможем восстановить ваши зашифрованные переписки на новых устройствах. Запишите его или сохраните в надежном менеджере паролей.
            </div>
          )}

          <button
            type="submit"
            className="e2ee-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner"></span>
            ) : needsSetup ? (
              'Активировать шифрование'
            ) : (
              'Разблокировать'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
