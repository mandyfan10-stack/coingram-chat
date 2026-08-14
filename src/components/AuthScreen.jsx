import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../supabaseClient';
import { 
  Lock, 
  User, 
  UserPlus, 
  LogIn, 
  AlertCircle, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Check, 
  ShieldCheck, 
  Zap,
  CheckCircle2
} from 'lucide-react';

export default function AuthScreen() {
  const { signInWithIdentifier, signUpWithUsername } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Real-time password requirement analysis for registration
  const passwordCriteria = useMemo(() => {
    const minLength = password.length >= 10;
    const upperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    
    let score = 0;
    if (minLength) score++;
    if (upperLower) score++;
    if (hasDigit) score++;
    if (hasSpecial) score++;

    let strengthLabel = 'Слабый';
    let strengthColor = '#ef4444';
    if (score === 4) {
      strengthLabel = 'Надёжный';
      strengthColor = '#10b981';
    } else if (score >= 2) {
      strengthLabel = 'Средний';
      strengthColor = '#f59e0b';
    }

    return {
      minLength,
      upperLower,
      hasDigit,
      hasSpecial,
      score,
      strengthLabel,
      strengthColor
    };
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const identifier = (isLogin ? loginIdentifier : username).trim();

    if (!identifier || !password.trim()) {
      setErrorMsg('Пожалуйста, заполните все обязательные поля.');
      return;
    }

    if (!isLogin || !identifier.includes('@')) {
      if (identifier.length < 3) {
        setErrorMsg('Имя пользователя должно быть не менее 3 символов.');
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
        setErrorMsg('Имя пользователя: только латиница, цифры и _.');
        return;
      }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      setErrorMsg('Укажите корректный email или никнейм.');
      return;
    }

    if (!isLogin) {
      if (!passwordCriteria.minLength) {
        setErrorMsg('Пароль должен быть не менее 10 символов.');
        return;
      }

      if (!passwordCriteria.upperLower || !passwordCriteria.hasDigit || !passwordCriteria.hasSpecial) {
        setErrorMsg('Пароль должен содержать строчную и заглавную буквы, цифру и специальный символ.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signInWithIdentifier(identifier.toLowerCase(), password);
        if (error) {
          setErrorMsg(error.message || 'Ошибка при входе. Проверьте логин и пароль.');
        }
      } else {
        const { error } = await signUpWithUsername(
          username.trim().toLowerCase(),
          password,
          displayName.trim() || username.trim()
        );
        if (error) {
          setErrorMsg(error.message || 'Ошибка при регистрации. Возможно, имя пользователя уже занято.');
        } else {
          setIsLogin(true);
          setPassword('');
          setErrorMsg('Регистрация успешна! Теперь вы можете войти в систему.');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Произошла непредвиденная ошибка. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen-container">
      {/* Subtle animated background glow orbs */}
      <div className="auth-glow-orb auth-glow-1" aria-hidden="true" />
      <div className="auth-glow-orb auth-glow-2" aria-hidden="true" />

      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* Logo Branding Section */}
          <div className="auth-logo-section">
            <div className="auth-logo-svg-wrapper">
              <div className="auth-logo-halo" />
              <svg width="78" height="78" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="auth-logo-svg">
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFE57F" />
                    <stop offset="45%" stopColor="#FFC107" />
                    <stop offset="100%" stopColor="#FF8F00" />
                  </linearGradient>
                  <linearGradient id="goldInner" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFF9C4" />
                    <stop offset="100%" stopColor="#FFA000" />
                  </linearGradient>
                  <radialGradient id="coinShine" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
                    <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="46" fill="url(#goldGrad)" />
                <circle cx="50" cy="50" r="40" fill="#17212b" />
                <circle cx="50" cy="50" r="35" fill="url(#goldInner)" />
                <circle cx="50" cy="50" r="35" fill="url(#coinShine)" />
                <path 
                  d="M57 44C56 38 48 37 45 40C41 43 41 51 45 54C49 57 56 55 57 50H50" 
                  stroke="#17212b" 
                  strokeWidth="4.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
            </div>
            <h2>Coiny</h2>
            <p className="auth-subtitle">Быстрый и защищённый мессенджер нового поколения</p>
          </div>

          {/* Demo Mode Notice Banner */}
          {!isSupabaseConfigured && (
            <div className="auth-warning-alert">
              <div className="auth-warning-header">
                <AlertCircle size={17} className="warning-icon" />
                <div>
                  <strong>Демонстрационный режим</strong>
                  <p>Supabase не настроен. Сессия и чаты сохраняются локально.</p>
                </div>
              </div>
              <button 
                type="button" 
                className="auth-demo-quick-btn"
                onClick={async () => {
                  setLoginIdentifier('alex_dev');
                  setPassword('123456');
                  setIsLogin(true);
                  setLoading(true);
                  setErrorMsg('');
                  try {
                    const { error } = await signInWithIdentifier('alex_dev', '123456');
                    if (error) setErrorMsg(error.message);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Zap size={14} />
                <span>Быстрый вход (Demo)</span>
              </button>
            </div>
          )}

          {/* Feedback message banner */}
          {errorMsg && (
            <div className={`auth-error-alert ${errorMsg.includes('успешна') ? 'success' : ''}`}>
              {errorMsg.includes('успешна') ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Tabs Switcher */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(true);
                setErrorMsg('');
              }}
            >
              <LogIn size={16} />
              <span>Вход</span>
            </button>
            <button
              type="button"
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(false);
                setErrorMsg('');
              }}
            >
              <UserPlus size={16} />
              <span>Регистрация</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Identifier input (login: email/username, register: username) */}
            <div className="auth-input-group">
              <label htmlFor={isLogin ? 'loginIdentifier' : 'username'}>
                {isLogin ? 'Email или никнейм' : 'Никнейм (username)'}
              </label>
              <div className="auth-input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id={isLogin ? 'loginIdentifier' : 'username'}
                  type="text"
                  placeholder={isLogin ? 'alex_dev или user@mail.com' : 'alex_dev'}
                  value={isLogin ? loginIdentifier : username}
                  onChange={(e) => (isLogin ? setLoginIdentifier(e.target.value) : setUsername(e.target.value))}
                  disabled={loading}
                  autoComplete={isLogin ? 'username' : 'new-username'}
                  required
                />
              </div>
            </div>

            {/* Display Name Input (Registration only) */}
            {!isLogin && (
              <div className="auth-input-group animate-fade-in">
                <label htmlFor="displayName">Отображаемое имя (необязательно)</label>
                <div className="auth-input-wrapper">
                  <Sparkles size={18} className="input-icon" />
                  <input
                    id="displayName"
                    type="text"
                    placeholder="Александр ⚡"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Password Input with Show/Hide Eye Toggle */}
            <div className="auth-input-group">
              <div className="auth-label-row">
                <label htmlFor="password">Пароль</label>
              </div>
              <div className="auth-input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isLogin ? '••••••' : 'Введите надёжный пароль'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  aria-describedby={!isLogin ? 'password-requirements' : undefined}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Strength Meter & Interactive Checklist (Registration only) */}
              {!isLogin && password && (
                <div className="auth-password-strength-box animate-fade-in">
                  <div className="auth-strength-bar-track">
                    <div 
                      className="auth-strength-bar-fill"
                      style={{ 
                        width: `${(passwordCriteria.score / 4) * 100}%`,
                        backgroundColor: passwordCriteria.strengthColor
                      }}
                    />
                  </div>
                  <div className="auth-strength-meta">
                    <span>Сложность:</span>
                    <strong style={{ color: passwordCriteria.strengthColor }}>
                      {passwordCriteria.strengthLabel}
                    </strong>
                  </div>

                  <div className="auth-requirements-list" id="password-requirements">
                    <div className={`auth-req-item ${passwordCriteria.minLength ? 'valid' : ''}`}>
                      <Check size={12} />
                      <span>От 10 символов</span>
                    </div>
                    <div className={`auth-req-item ${passwordCriteria.upperLower ? 'valid' : ''}`}>
                      <Check size={12} />
                      <span>Строчные и заглавные (a-z, A-Z)</span>
                    </div>
                    <div className={`auth-req-item ${passwordCriteria.hasDigit ? 'valid' : ''}`}>
                      <Check size={12} />
                      <span>Минимум одна цифра (0-9)</span>
                    </div>
                    <div className={`auth-req-item ${passwordCriteria.hasSpecial ? 'valid' : ''}`}>
                      <Check size={12} />
                      <span>Спецсимвол (!@#$%^&*)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Remember Me Toggle */}
            {isLogin && (
              <div className="auth-extra-row">
                <label className="auth-remember-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Запомнить меня</span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : isLogin ? (
                <>
                  <LogIn size={18} />
                  <span>Войти в аккаунт</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Создать аккаунт</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div className="auth-footer-security">
            <ShieldCheck size={14} />
            <span>Сквозное E2EE шифрование сообщений и звонков</span>
          </div>
        </div>
      </div>
    </div>
  );
}
