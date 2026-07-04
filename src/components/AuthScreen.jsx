import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { isSupabaseConfigured } from '../supabaseClient';
import { Lock, User, UserPlus, LogIn, AlertCircle, Sparkles } from 'lucide-react';

export default function AuthScreen() {
  const { signInWithUsername, signUpWithUsername } = useChat();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Пожалуйста, заполните все обязательные поля.');
      return;
    }

    if (username.trim().length < 3) {
      setErrorMsg('Имя пользователя должно быть не менее 3 символов.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Пароль должен быть не менее 6 символов.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signInWithUsername(username.trim().toLowerCase(), password);
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
          // Автоматически переключаем на вход или информируем
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
      <div className="auth-card-wrapper">
        {/* Glow effect decorative elements */}
        <div className="auth-glow glow-1"></div>
        <div className="auth-glow glow-2"></div>

        <div className="auth-card">
          <div className="auth-logo-section">
            <span className="auth-logo">🪙</span>
            <h2>CoinGram</h2>
            <p className="auth-subtitle">Премиальный Веб-Клиент</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="auth-warning-alert">
              <AlertCircle size={18} className="warning-icon" />
              <div>
                <strong>Режим Демонстрации</strong>
                <p>База данных Supabase не подключена. Данные будут храниться локально в браузере.</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className={`auth-error-alert ${errorMsg.includes('успешна') ? 'success' : ''}`}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Tabs */}
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
            {/* Username Input */}
            <div className="auth-input-group">
              <label htmlFor="username">Имя пользователя (никнейм) *</label>
              <div className="auth-input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="username"
                  type="text"
                  placeholder="alex_dev"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Display Name Input (only for Registration) */}
            {!isLogin && (
              <div className="auth-input-group animate-fade-in">
                <label htmlFor="displayName">Отображаемое имя (например, Александр)</label>
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

            {/* Password Input */}
            <div className="auth-input-group">
              <label htmlFor="password">Пароль *</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

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
                  <span>Зарегистрироваться</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
