import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../supabaseClient';
import { Lock, User, UserPlus, LogIn, AlertCircle, Sparkles } from 'lucide-react';

export default function AuthScreen() {
  const { signInWithUsername, signUpWithUsername } = useAuth();
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
        <div className="auth-card">
          <div className="auth-logo-section">
            <div className="auth-logo-svg-wrapper">
              <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="auth-logo-svg">
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFE57F" />
                    <stop offset="50%" stopColor="#FFC107" />
                    <stop offset="100%" stopColor="#FF8F00" />
                  </linearGradient>
                  <linearGradient id="goldInner" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFF9C4" />
                    <stop offset="100%" stopColor="#FFA000" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="46" fill="url(#goldGrad)" />
                <circle cx="50" cy="50" r="40" fill="#17212b" />
                <circle cx="50" cy="50" r="35" fill="url(#goldInner)" />
                <path d="M57 44C56 38 48 37 45 40C41 43 41 51 45 54C49 57 56 55 57 50H50" stroke="#17212b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>CoinGram</h2>
            <p className="auth-subtitle">Премиальный Веб-Клиент</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="auth-warning-alert" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <AlertCircle size={18} className="warning-icon" />
                <div>
                  <strong>Режим Демонстрации</strong>
                  <p>База данных Supabase не подключена. Данные будут храниться локально в браузере.</p>
                </div>
              </div>
              <button 
                type="button" 
                style={{ marginTop: '12px', padding: '10px', backgroundColor: '#FFC107', color: '#17212b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', width: '100%', transition: 'opacity 0.2s' }}
                onMouseOver={(e) => e.target.style.opacity = '0.9'}
                onMouseOut={(e) => e.target.style.opacity = '1'}
                onClick={async () => {
                  setUsername('alex_dev');
                  setPassword('123456');
                  setIsLogin(true);
                  setLoading(true);
                  setErrorMsg('');
                  try {
                    const { error } = await signInWithUsername('alex_dev', '123456');
                    if (error) setErrorMsg(error.message);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                🚀 Быстрый вход в Демо-режим
              </button>
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
