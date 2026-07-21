import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { E2EEProvider, useE2EE } from './context/E2EEContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CallProvider, useCalls } from './context/CallContext';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ChatInfo from './components/ChatInfo';
import SettingsModal from './components/SettingsModal';
import StoryViewer from './components/StoryViewer';
import AuthScreen from './components/AuthScreen';
import NewChatModal from './components/NewChatModal';
import CreateStoryModal from './components/CreateStoryModal';
import MainMenuDrawer from './components/MainMenuDrawer';
import CallOverlay from './components/CallOverlay';
import E2EESetupModal from './components/E2EESetupModal';
import { X } from 'lucide-react';

const CURRENT_VERSION = import.meta.env.APP_VERSION || '1.20.0';

function UpdateModal({ show, releaseInfo, onClose }) {
  if (!show || !releaseInfo) return null;

  return (
    <div className="settings-modal-overlay open" style={{ zIndex: 10000 }}>
      <div className="settings-container update-modal-container" style={{ maxWidth: '400px', width: '90%' }}>
        <div className="settings-header">
          <h3>Доступно обновление! 🚀</h3>
          <button className="settings-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="settings-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '600' }}>
              Версия {releaseInfo.tagName}
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Текущая версия: {CURRENT_VERSION}
            </span>
          </div>

          {releaseInfo.body && (
            <div className="update-changelog" style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '12px', 
              borderRadius: '8px', 
              maxHeight: '120px', 
              overflowY: 'auto',
              fontSize: '13px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}>
              <strong>Что нового:</strong><br />
              {releaseInfo.body}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <a 
              href={releaseInfo.downloadUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="add-member-btn" 
              style={{ 
                textAlign: 'center', 
                textDecoration: 'none', 
                display: 'block',
                padding: '10px'
              }}
            >
              Скачать обновление
            </a>
            <button 
              onClick={onClose} 
              className="picker-tab-btn" 
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: '1px solid var(--border-color)', 
                padding: '10px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Позже
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const isNewerVersion = (latest, current) => {
  const parse = (v) => v.split('.').map(Number);
  const latestParts = parse(latest);
  const currentParts = parse(current);
  
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
};

function MainLayout() {
  const { currentUser, authLoading } = useAuth();
  const { activeChatId, isDrawerOpen, setIsDrawerOpen } = useChat();
  const [showUpdate, setShowUpdate] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState(null);

  // Swipe from edge to open MainMenuDrawer
  const touchStartRef = React.useRef({ x: 0, y: 0 });
  const touchMoveRef = React.useRef({ x: 0, y: 0 });
  const isDrawerGestureRef = React.useRef(false);

  const handleGlobalTouchStart = (e) => {
    if (window.innerWidth >= 768 || e.touches.length !== 1 || isDrawerOpen || activeChatId) return;
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    if (startX > 30) {
      touchStartRef.current = { x: 0, y: 0 };
      return;
    }
    touchStartRef.current = { x: startX, y: startY };
    touchMoveRef.current = { x: startX, y: startY };
    isDrawerGestureRef.current = false;
  };

  const handleGlobalTouchMove = (e) => {
    if (window.innerWidth >= 768 || e.touches.length !== 1 || touchStartRef.current.x === 0) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;
    touchMoveRef.current = { x: currentX, y: currentY };
    if (!isDrawerGestureRef.current) {
      if (deltaX > 15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        isDrawerGestureRef.current = true;
      } else if (Math.abs(deltaY) > 15 || deltaX < -15) {
        touchStartRef.current = { x: 0, y: 0 };
      }
    }
    if (isDrawerGestureRef.current) {
      e.preventDefault();
    }
  };

  const handleGlobalTouchEnd = () => {
    if (window.innerWidth >= 768 || !isDrawerGestureRef.current || touchStartRef.current.x === 0) {
      isDrawerGestureRef.current = false;
      touchStartRef.current = { x: 0, y: 0 };
      return;
    }
    const deltaX = touchMoveRef.current.x - touchStartRef.current.x;
    if (deltaX > 50) {
      setIsDrawerOpen(true);
    }
    isDrawerGestureRef.current = false;
    touchStartRef.current = { x: 0, y: 0 };
  };

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const repo = import.meta.env.VITE_GITHUB_REPO || 'mandyfan10-stack/coingram-chat';
        const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
        if (!response.ok) return;

        const data = await response.json();
        const tagName = data.tag_name;
        const cleanTagName = tagName.replace(/^v/, '');

        if (isNewerVersion(cleanTagName, CURRENT_VERSION)) {
          // Open releases HTML URL in browser instead of direct .exe download for security
          const downloadUrl = data.html_url;

          setReleaseInfo({
            tagName,
            body: data.body,
            downloadUrl
          });
          setShowUpdate(true);
        }
      } catch (err) {
        console.warn("Failed to check for updates:", err);
      }
    };

    checkUpdates();
  }, []);

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="spinner-large"></div>
        <p>Инициализация CoinGram...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return (
    <div 
      className={`app-container ${activeChatId ? 'active-chat-selected' : ''}`}
      onTouchStart={handleGlobalTouchStart}
      onTouchMove={handleGlobalTouchMove}
      onTouchEnd={handleGlobalTouchEnd}
    >
      <h1 className="sr-only" style={{ display: 'none' }}>CoinGram</h1>
      <Sidebar />
      <ChatArea />
      <ChatInfo />
      <SettingsModal />
      <StoryViewer />
      <NewChatModal />
      <CreateStoryModal />
      <MainMenuDrawer />
      <CallOverlay />
      <E2EESetupModal />
      <UpdateModal show={showUpdate} releaseInfo={releaseInfo} onClose={() => setShowUpdate(false)} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <E2EEProvider>
        <ChatProvider>
          <CallProvider>
            <MainLayout />
          </CallProvider>
        </ChatProvider>
      </E2EEProvider>
    </AuthProvider>
  );
}

export default App;
