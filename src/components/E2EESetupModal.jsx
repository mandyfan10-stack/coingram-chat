import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { LockKeyhole, ShieldAlert, Eye, EyeOff, Copy, Check, AlertTriangle, KeyRound, Info } from 'lucide-react';

export default function E2EESetupModal() {
  const { 
    currentUser, 
    authLoading, 
    isE2EESetupRequired, 
    e2eePrivateKey, 
    setupE2EE, 
    unlockE2EE,
    changePasswordAfterRecovery,
    resetE2EE
  } = useChat();

  // Setup states
  const [setupStep, setSetupStep] = useState(1); // 1: Enter password, 2: Show recovery code
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  // Unlock/Recover states
  const [viewMode, setViewMode] = useState('password'); // 'password', 'recovery_code', 'new_password'
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');

  // Common inputs
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (authLoading || !currentUser) return null;

  const needsSetup = isE2EESetupRequired;
  const needsUnlock = currentUser.encrypted_private_key && !e2eePrivateKey;

  if (!needsSetup && !needsUnlock) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSetupPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Пожалуйста, введите пароль.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setLoading(true);
    const result = await setupE2EE(password);
    setLoading(false);

    if (result && result.success) {
      setGeneratedCode(result.recoveryCode);
      setSetupStep(2);
      setPassword('');
      setConfirmPassword('');
    } else {
      setError('Не удалось настроить шифрование. Попробуйте еще раз.');
    }
  };

  const handleFinishSetup = () => {
    // Reset local wizard states
    setSetupStep(1);
    setGeneratedCode('');
    setConfirmCheckbox(false);
  };

  const handleUnlockPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Введите пароль.');
      return;
    }

    setLoading(true);
    const success = await unlockE2EE(password, false);
    setLoading(false);

    if (success) {
      setPassword('');
    } else {
      setError('Неверный пароль. Пожалуйста, попробуйте снова.');
    }
  };

  const handleRecoverCodeSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const formattedCode = recoveryCodeInput.trim().toUpperCase();
    if (formattedCode.replace(/-/g, '').length !== 24) {
      setError('Код восстановления должен состоять из 24 символов.');
      return;
    }

    setLoading(true);
    const success = await unlockE2EE(formattedCode, true);
    setLoading(false);

    if (success) {
      setViewMode('new_password');
    } else {
      setError('Неверный код восстановления. Пожалуйста, проверьте правильность ввода.');
    }
  };

  const handleNewPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Пожалуйста, введите новый пароль.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setLoading(true);
    const codeToUse = recoveryCodeInput.trim().toUpperCase();
    const success = await changePasswordAfterRecovery(codeToUse, password);
    setLoading(false);

    if (success) {
      setPassword('');
      setConfirmPassword('');
      setRecoveryCodeInput('');
      setViewMode('password'); // Reset to default view
    } else {
      setError('Не удалось обновить пароль. Пожалуйста, попробуйте еще раз.');
    }
  };

  const handleFullReset = async () => {
    setLoading(true);
    await resetE2EE();
    setLoading(false);
    setShowResetConfirm(false);
    setViewMode('password');
    setPassword('');
    setConfirmPassword('');
    setRecoveryCodeInput('');
    setError('');
  };

  return (
    <div className="e2ee-modal-overlay">
      <div className="e2ee-modal-content glass-card">
        {showResetConfirm ? (
          <div className="e2ee-reset-confirm-view animate-fade-in">
            <div className="e2ee-icon-container warning-glow">
              <AlertTriangle className="e2ee-header-icon reset-warn-icon" />
            </div>
            <h2>Сброс шифрования</h2>
            <p className="e2ee-subtitle danger-text">
              Внимание! Это действие безвозвратно удалит доступ к вашей истории зашифрованных сообщений. Ни вы, ни собеседники не сможете расшифровать старые переписки.
            </p>
            <div className="e2ee-notice-box">
              Вы сможете продолжить общение, но старые сообщения будут помечены значком 🔒 и останутся заблокированными.
            </div>
            <div className="e2ee-actions-row">
              <button 
                type="button" 
                className="e2ee-cancel-btn" 
                onClick={() => setShowResetConfirm(false)}
                disabled={loading}
              >
                Отмена
              </button>
              <button 
                type="button" 
                className="e2ee-danger-confirm-btn" 
                onClick={handleFullReset}
                disabled={loading}
              >
                {loading ? <span className="spinner"></span> : 'Да, сбросить ключи'}
              </button>
            </div>
          </div>
        ) : needsSetup ? (
          /* ========================================================
             1. SETUP FLOW
             ======================================================== */
          setupStep === 1 ? (
            <div className="e2ee-setup-step-1 animate-scale-up">
              <div className="e2ee-modal-header">
                <div className="e2ee-icon-container setup-glow">
                  <ShieldAlert className="e2ee-header-icon setup-icon" />
                </div>
                <h2>Активация сквозного шифрования</h2>
                <p className="e2ee-subtitle">
                  CoinGram защищает ваши личные переписки с помощью надежного E2EE-шифрования. Задайте секретный пароль для создания ключей безопасности.
                </p>
              </div>

              <form onSubmit={handleSetupPasswordSubmit} className="e2ee-form">
                {error && <div className="e2ee-error-banner">{error}</div>}

                <div className="e2ee-input-group">
                  <label htmlFor="setup-password">Пароль шифрования</label>
                  <div className="password-input-wrapper">
                    <input
                      id="setup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Придумайте надежный пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
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

                <div className="e2ee-input-group">
                  <label htmlFor="setup-confirm-password">Подтвердите пароль</label>
                  <input
                    id="setup-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Повторите ваш пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    className="styled-input"
                  />
                </div>

                <div className="e2ee-warning-notice">
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <span>
                    Этот пароль никогда не отправляется на сервер. Он используется исключительно локально на ваших устройствах.
                  </span>
                </div>

                <button type="submit" className="e2ee-submit-btn" disabled={loading}>
                  {loading ? <span className="spinner"></span> : 'Создать ключи шифрования'}
                </button>
              </form>
            </div>
          ) : (
            <div className="e2ee-setup-step-2 animate-scale-up">
              <div className="e2ee-modal-header">
                <div className="e2ee-icon-container success-glow">
                  <KeyRound className="e2ee-header-icon success-icon" />
                </div>
                <h2>Код восстановления</h2>
                <p className="e2ee-subtitle">
                  Этот код понадобится вам для восстановления переписки, если вы забудете пароль или захотите войти на другом устройстве.
                </p>
              </div>

              <div className="e2ee-code-box-container">
                <div className="e2ee-code-label">Ваш код восстановления (24 символа):</div>
                <div className="e2ee-recovery-code-card">
                  <span className="recovery-code-text">{generatedCode}</span>
                  <button type="button" className="e2ee-copy-icon-btn" onClick={handleCopyCode}>
                    {copied ? <Check size={18} className="success-icon" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div className="e2ee-warning-notice critical">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  Запишите этот код или сохраните его в менеджере паролей. **Если вы потеряете и пароль, и код восстановления, вы потеряете доступ к старым чатам навсегда!**
                </span>
              </div>

              <div className="e2ee-checkbox-group">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox}
                    onChange={(e) => setConfirmCheckbox(e.target.checked)}
                  />
                  <span className="checkbox-checkmark"></span>
                  <span className="checkbox-label">Я сохранил код восстановления в надежном месте</span>
                </label>
              </div>

              <button 
                type="button" 
                className="e2ee-submit-btn" 
                disabled={!confirmCheckbox} 
                onClick={handleFinishSetup}
              >
                Активировать шифрование
              </button>
            </div>
          )
        ) : (
          /* ========================================================
             2. UNLOCK & RECOVERY FLOW
             ======================================================== */
          viewMode === 'password' ? (
            <div className="e2ee-unlock-password animate-scale-up">
              <div className="e2ee-modal-header">
                <div className="e2ee-icon-container unlock-glow">
                  <LockKeyhole className="e2ee-header-icon unlock-icon" />
                </div>
                <h2>Разблокировка шифрования</h2>
                <p className="e2ee-subtitle">
                  Введите ваш пароль сквозного шифрования (E2EE) для дешифрования сообщений на этом устройстве.
                </p>
              </div>

              <form onSubmit={handleUnlockPasswordSubmit} className="e2ee-form">
                {error && <div className="e2ee-error-banner">{error}</div>}

                <div className="e2ee-input-group">
                  <label htmlFor="unlock-password">Пароль шифрования</label>
                  <div className="password-input-wrapper">
                    <input
                      id="unlock-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Введите ваш E2EE пароль"
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

                <button type="submit" className="e2ee-submit-btn" disabled={loading}>
                  {loading ? <span className="spinner"></span> : 'Разблокировать историю'}
                </button>

                <div className="e2ee-alt-actions">
                  <button 
                    type="button" 
                    className="e2ee-link-btn" 
                    onClick={() => { setViewMode('recovery_code'); setError(''); }}
                  >
                    Забыли пароль? Восстановить по коду
                  </button>
                  
                  <button 
                    type="button" 
                    className="e2ee-link-btn danger" 
                    onClick={() => setShowResetConfirm(true)}
                  >
                    Сбросить шифрование аккаунта
                  </button>
                </div>
              </form>
            </div>
          ) : viewMode === 'recovery_code' ? (
            <div className="e2ee-unlock-recovery animate-scale-up">
              <div className="e2ee-modal-header">
                <div className="e2ee-icon-container recovery-glow">
                  <KeyRound className="e2ee-header-icon recovery-icon" />
                </div>
                <h2>Восстановление доступа</h2>
                <p className="e2ee-subtitle">
                  Введите ваш 24-значный код восстановления для расшифровки приватного ключа.
                </p>
              </div>

              <form onSubmit={handleRecoverCodeSubmit} className="e2ee-form">
                {error && <div className="e2ee-error-banner">{error}</div>}

                <div className="e2ee-input-group">
                  <label htmlFor="recovery-code">Код восстановления</label>
                  <input
                    id="recovery-code"
                    type="text"
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    value={recoveryCodeInput}
                    onChange={(e) => setRecoveryCodeInput(e.target.value)}
                    disabled={loading}
                    className="recovery-code-input-fieldstyled"
                    autoComplete="off"
                    maxLength={29} // 24 chars + 5 dashes
                  />
                </div>

                <button type="submit" className="e2ee-submit-btn" disabled={loading}>
                  {loading ? <span className="spinner"></span> : 'Проверить код'}
                </button>

                <div className="e2ee-alt-actions">
                  <button 
                    type="button" 
                    className="e2ee-link-btn" 
                    onClick={() => { setViewMode('password'); setError(''); }}
                  >
                    Вернуться к вводу пароля
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* viewMode === 'new_password' */
            <div className="e2ee-unlock-new-password animate-scale-up">
              <div className="e2ee-modal-header">
                <div className="e2ee-icon-container success-glow">
                  <Check className="e2ee-header-icon success-icon" />
                </div>
                <h2>Установка нового пароля</h2>
                <p className="e2ee-subtitle">
                  Код принят! Приватный ключ успешно расшифрован. Пожалуйста, задайте новый пароль шифрования для будущих входов.
                </p>
              </div>

              <form onSubmit={handleNewPasswordSubmit} className="e2ee-form">
                {error && <div className="e2ee-error-banner">{error}</div>}

                <div className="e2ee-input-group">
                  <label htmlFor="new-password">Новый пароль</label>
                  <div className="password-input-wrapper">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Введите новый пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
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

                <div className="e2ee-input-group">
                  <label htmlFor="new-confirm-password">Подтвердите пароль</label>
                  <input
                    id="new-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Повторите новый пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    className="styled-input"
                  />
                </div>

                <button type="submit" className="e2ee-submit-btn" disabled={loading}>
                  {loading ? <span className="spinner"></span> : 'Сохранить пароль и войти'}
                </button>
              </form>
            </div>
          )
        )}
      </div>
    </div>
  );
}
