import React from 'react';
import { ChatProvider, useChat } from './context/ChatContext';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ChatInfo from './components/ChatInfo';
import SettingsModal from './components/SettingsModal';
import StoryViewer from './components/StoryViewer';
import AuthScreen from './components/AuthScreen';
import NewChatModal from './components/NewChatModal';
import CreateStoryModal from './components/CreateStoryModal';
import MainMenuDrawer from './components/MainMenuDrawer';

function MainLayout() {
  const { currentUser, authLoading } = useChat();

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
    <div className="app-container">
      <h1 className="sr-only" style={{ display: 'none' }}>CoinGram — Премиальный Веб-Клиент</h1>
      <Sidebar />
      <ChatArea />
      <ChatInfo />
      <SettingsModal />
      <StoryViewer />
      <NewChatModal />
      <CreateStoryModal />
      <MainMenuDrawer />
    </div>
  );
}

function App() {
  return (
    <ChatProvider>
      <MainLayout />
    </ChatProvider>
  );
}

export default App;
