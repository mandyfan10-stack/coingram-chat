import React, { useEffect, useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useCalls } from '../../context/CallContext';
import './CallOverlay.css';
import {
  Mic,
  MicOff,
  PhoneOff,
  Phone,
  Video,
  VideoOff,
  Monitor,
  Minimize2,
  Maximize2,
  RefreshCw,
  SlidersHorizontal,
  X
} from 'lucide-react';
import {
  playCallConnect,
  playCallDisconnect,
  startCallRingback,
  startIncomingRingtone
} from '../../utils/callSounds';
import { useCallCardChrome } from './useCallCardChrome';
import { useCallLocalPreviewDrag } from './useCallLocalPreviewDrag';

function getIsCompactViewport() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 480 || window.innerHeight <= 560;
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function CallOverlay() {
  const {
    callState,
    endCall,
    toggleCallMute,
    acceptCall,
    rejectCall,
    retryCallConnection,
    localVideoStream,
    remoteVideoStream,
    toggleCallVideo,
    isScreenSharing,
    toggleCallScreenShare,
    groupCallParticipants,
    mediaError,
    clearMediaError,
    voiceEnhancementEnabled,
    toggleVoiceEnhancement
  } = useCalls();

  const { chats, renderAvatar } = useChat();

  const [pulseScale, setPulseScale] = useState(1);
  const [isCompact, setIsCompact] = useState(getIsCompactViewport);
  const [elapsed, setElapsed] = useState(0);
  const [isVideoContain, setIsVideoContain] = useState(false);
  const ringRef = useRef(null);
  const connectSoundPlayedRef = useRef(false);
  const acceptBtnRef = useRef(null);
  const rejectBtnRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const containerRef = useRef(null);

  const {
    cardPos,
    cardSize,
    isMinimized,
    setIsMinimized,
    bubblePos,
    isDraggingCard,
    isResizing,
    handleResizeMouseDown,
    handleResizeTouchStart,
    handleCardMouseDown,
    handleCardTouchStart,
    handleBubbleMouseDown,
    handleBubbleTouchStart,
    handleBubbleClick
  } = useCallCardChrome(callState.status);

  const { dragPos, dragRef, handleMouseDown, handleTouchStart } = useCallLocalPreviewDrag({
    containerRef,
    localVideoStream,
    cardSize
  });

  useEffect(() => {
    const onResize = () => setIsCompact(getIsCompactViewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // V6: Escape ends/rejects; ignore when typing in inputs under non-blocking overlay.
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      e.preventDefault();
      if (callState.status === 'incoming') rejectCall();
      else endCall();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [callState.status, rejectCall, endCall]);

  // V6: focus Accept on incoming; light Tab trap between accept/reject.
  useEffect(() => {
    if (callState.status !== 'incoming') return undefined;
    acceptBtnRef.current?.focus?.();
    const onTab = (e) => {
      if (e.key !== 'Tab') return;
      const accept = acceptBtnRef.current;
      const reject = rejectBtnRef.current;
      if (!accept || !reject) return;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === accept) {
          e.preventDefault();
          reject.focus();
        }
      } else if (active === reject) {
        e.preventDefault();
        accept.focus();
      }
    };
    window.addEventListener('keydown', onTab);
    return () => window.removeEventListener('keydown', onTab);
  }, [callState.status]);

  // Sounds + local duration tick (C9: no setCallState duration++)
  useEffect(() => {
    if (callState.status !== 'connected') {
      connectSoundPlayedRef.current = false;
    }
    if (callState.status !== 'calling' && callState.status !== 'incoming') {
      if (ringRef.current) {
        ringRef.current.stop();
        ringRef.current = null;
      }
    }

    if (callState.status === 'calling') {
      if (!ringRef.current) ringRef.current = startCallRingback();
    } else if (callState.status === 'incoming') {
      if (!ringRef.current) ringRef.current = startIncomingRingtone();
    } else if (callState.status === 'connected') {
      if (callState.webrtcState === 'connected') {
        if (!connectSoundPlayedRef.current) {
          playCallConnect();
          connectSoundPlayedRef.current = true;
        }
        setElapsed(0);
        const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
        const pulseInterval = setInterval(() => {
          setPulseScale(1 + Math.random() * 0.28);
        }, 150);
        return () => {
          clearInterval(timer);
          clearInterval(pulseInterval);
        };
      }
      setPulseScale(1.0);
    } else if (callState.status === 'ended') {
      playCallDisconnect();
    }

    return undefined;
  }, [callState.status, callState.webrtcState]);

  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localVideoStream, isMinimized]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoStream) {
      remoteVideoRef.current.srcObject = remoteVideoStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteVideoStream, isMinimized]);

  useEffect(() => {
    if (callState.isRemoteScreenSharing) setIsVideoContain(true);
  }, [callState.isRemoteScreenSharing]);

  if (callState.status === 'idle') return null;

  const activeChat = chats.find((c) => c.id === callState.chatId);
  const isGroupCall = activeChat?.type === 'group';

  let displayName = '';
  let avatarColor = 'linear-gradient(135deg, #74b9ff, #0984e3)';
  let avatarContent = '👤';
  if (callState.status === 'incoming' && callState.callerInfo) {
    displayName = callState.callerInfo.name;
    avatarColor = callState.callerInfo.avatarColor;
    avatarContent = callState.callerInfo.avatar;
  } else if (activeChat) {
    displayName = activeChat.name;
    avatarColor = activeChat.avatarColor;
    avatarContent = activeChat.avatar;
  } else {
    displayName = 'Звонок...';
  }

  let statusText = 'Подключение...';
  if (callState.status === 'calling') statusText = 'Звонок...';
  else if (callState.status === 'incoming') statusText = 'Входящий звонок...';
  else if (callState.status === 'connected') {
    if (callState.webrtcState === 'connected') statusText = formatTime(elapsed);
    else if (callState.webrtcState === 'failed') statusText = 'Нет WebRTC-связи (сеть/NAT)';
    else statusText = 'Соединение...';
  } else if (callState.status === 'ended') {
    statusText = mediaError ? 'Звонок завершен' : 'Звонок завершен';
  }

  const showRemoteVideo = !isGroupCall && !!remoteVideoStream;
  const showLocalVideo = !isGroupCall && !!localVideoStream;
  const showBackgroundAvatar = !showRemoteVideo;
  const hasVideo = showLocalVideo || showRemoteVideo;
  const isScreenShareSupported =
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function';
  const showVideoControls = !isGroupCall && callState.status !== 'incoming';
  const isIncoming = callState.status === 'incoming';

  if (isMinimized) {
    return (
      <div
        className="call-minimized-bubble"
        style={{ left: `${bubblePos.x}px`, top: `${bubblePos.y}px` }}
        onMouseDown={handleBubbleMouseDown}
        onTouchStart={handleBubbleTouchStart}
        onClick={handleBubbleClick}
        title="Развернуть звонок"
        role="region"
        aria-label={`Активный звонок: ${displayName}, ${statusText}`}
      >
        <div className="call-bubble-avatar" style={{ background: avatarColor }}>
          {renderAvatar(avatarContent, '👤')}
        </div>
        {callState.status === 'connected' && callState.webrtcState === 'connected' && (
          <div className="call-bubble-pulse" />
        )}
        <div className="call-bubble-timer">{statusText}</div>
      </div>
    );
  }

  const cardStyle = isCompact
    ? {
        position: 'relative',
        left: 'auto',
        top: 'auto',
        margin: 0,
        width: '100%',
        height: 'auto',
        maxHeight: '100%',
        transition: 'none'
      }
    : {
        ...(cardPos
          ? {
              position: 'absolute',
              left: `${cardPos.x}px`,
              top: `${cardPos.y}px`,
              margin: 0
            }
          : {}),
        width: `${cardSize.width}px`,
        height: `${cardSize.height}px`,
        transition:
          isDraggingCard.current || isResizing.current
            ? 'none'
            : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.3s ease, height 0.3s ease'
      };

  const wrapperProps = isIncoming
    ? {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': `Входящий звонок: ${displayName || 'Звонок'}`
      }
    : {
        role: 'region',
        'aria-label': `Активный звонок: ${displayName || 'Звонок'}`
      };

  return (
    <div
      className={`call-overlay-wrapper ${callState.status !== 'idle' ? 'active' : ''} ${!isIncoming ? 'non-blocking' : ''} ${isCompact ? 'is-compact' : ''}`}
      {...wrapperProps}
    >
      <div
        className={`call-card ${showRemoteVideo ? 'has-remote-video' : ''} ${hasVideo ? 'has-video' : ''} ${isVideoContain ? 'is-contain' : ''} ${isCompact ? 'is-compact' : ''}`}
        ref={containerRef}
        style={cardStyle}
        onMouseDown={isCompact ? undefined : handleCardMouseDown}
        onTouchStart={isCompact ? undefined : handleCardTouchStart}
      >
        {/* Top Bar with Actions */}
        {!isIncoming && (
          <div className="call-top-bar">
            <div className="call-header-actions">
              {showRemoteVideo && (
                <button
                  type="button"
                  className="call-action-icon-btn"
                  onClick={() => setIsVideoContain((prev) => !prev)}
                  title={isVideoContain ? 'Заполнить экран' : 'Вписать в экран'}
                >
                  <Maximize2 size={15} />
                </button>
              )}
              <button
                type="button"
                className="call-action-icon-btn"
                onClick={() => setIsMinimized(true)}
                title="Свернуть"
              >
                <Minimize2 size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Video Feeds */}
        {showRemoteVideo && (
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video-feed" />
        )}

        {showLocalVideo && (
          <div
            ref={dragRef}
            className="local-video-preview"
            style={isCompact ? undefined : { left: `${dragPos.x}px`, top: `${dragPos.y}px` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`local-video-feed ${isScreenSharing ? 'is-screen' : 'is-camera'}`}
            />
          </div>
        )}

        {/* Media Error Toast */}
        {mediaError && (
          <div className="call-media-error" role="alert">
            <span>{mediaError}</span>
            {typeof clearMediaError === 'function' && (
              <button
                type="button"
                className="call-media-error-dismiss"
                onClick={clearMediaError}
                title="Закрыть"
                aria-label="Закрыть сообщение об ошибке"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Group Call View or 1:1 Voice Call View */}
        {isGroupCall ? (
          <div className="group-call-container">
            <h2 className="call-user-name" style={{ marginBottom: '4px' }}>
              {displayName}
            </h2>
            <p className="call-status-subtitle" style={{ marginBottom: '14px' }}>
              {statusText}
            </p>
            <div className="group-call-stage-list">
              {(groupCallParticipants || []).map((p) => (
                <div key={p.id} className={`group-call-member-row ${p.speaking ? 'speaking' : ''}`}>
                  <div
                    className={`group-call-avatar-wrapper ${p.speaking ? 'speaking' : ''}`}
                    style={{
                      background: p.avatarColor || 'linear-gradient(135deg, #a1c4fd, #c2e9fb)'
                    }}
                  >
                    {renderAvatar(p.avatar, '👤')}
                  </div>
                  <div className="group-call-member-info">
                    <span className="group-call-member-name">{p.name}</span>
                    <span
                      className={`group-call-member-status ${p.muted ? 'muted' : p.speaking ? 'speaking' : 'online'}`}
                    >
                      {p.muted ? 'Микрофон выкл.' : p.speaking ? 'Говорит' : 'Слушает'}
                    </span>
                  </div>
                  <div className="group-call-member-action">
                    {p.muted ? (
                      <div className="group-call-status-icon muted">
                        <MicOff size={14} />
                      </div>
                    ) : p.speaking ? (
                      <div className="speaking-wave-indicator">
                        <span className="wave-bar" />
                        <span className="wave-bar" />
                        <span className="wave-bar" />
                      </div>
                    ) : (
                      <div className="group-call-status-icon active">
                        <Mic size={14} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Avatar & Dynamic Triple Voice Pulse Rings */}
            <div className={`call-avatar-section ${!showBackgroundAvatar ? 'fade-out' : ''}`}>
              {callState.status === 'connected' &&
                callState.webrtcState === 'connected' && (
                  <>
                    <div
                      className="wave-pulse wave-1"
                      style={{
                        transform: `translate(-50%, -50%) scale(${pulseScale * 1.12})`,
                        opacity: callState.isRemoteSpeaking ? 0.35 : 0.12
                      }}
                    />
                    <div
                      className="wave-pulse wave-2"
                      style={{
                        transform: `translate(-50%, -50%) scale(${pulseScale * 1.28})`,
                        opacity: callState.isRemoteSpeaking ? 0.25 : 0.08
                      }}
                    />
                    <div
                      className="wave-pulse wave-3"
                      style={{
                        transform: `translate(-50%, -50%) scale(${pulseScale * 1.45})`,
                        opacity: callState.isRemoteSpeaking ? 0.15 : 0.04
                      }}
                    />
                  </>
                )}
              <div className="call-avatar-circle" style={{ background: avatarColor }}>
                {renderAvatar(avatarContent, '👤')}
              </div>
            </div>

            <h2 className="call-user-name" id="call-overlay-title">
              {displayName}
            </h2>

            <div className="call-status-container">
              <p className="call-status-subtitle">{statusText}</p>
              {callState.status === 'connected' &&
                callState.webrtcState === 'connected' &&
                (callState.isLocalSpeaking || callState.isRemoteSpeaking) && (
                  <div className="speaking-wave-indicator one-to-one-wave">
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                  </div>
                )}
            </div>

            {callState.status === 'connected' && callState.webrtcState === 'failed' && (
              <p className="call-connection-hint" style={{ fontSize: '11.5px', color: '#ff7675', marginBottom: '14px' }}>
                Нет WebRTC-связи (сеть/NAT). Нажмите «Повторить» или завершите звонок.
              </p>
            )}
          </>
        )}

        {/* Floating Controls Dock */}
        <div className="call-controls">
          {callState.status === 'incoming' ? (
            <div className="incoming-buttons" style={{ display: 'flex', gap: '24px' }}>
              <button
                ref={acceptBtnRef}
                type="button"
                className="call-ctrl-btn call-accept"
                onClick={acceptCall}
                title="Ответить на звонок"
              >
                <Phone size={22} />
              </button>
              <button
                ref={rejectBtnRef}
                type="button"
                className="call-ctrl-btn call-hangup"
                onClick={rejectCall}
                title="Отклонить звонок"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          ) : (
            <div className="active-controls-panel">
              {showVideoControls && (
                <button
                  type="button"
                  className={`call-ctrl-btn ctrl-secondary ${localVideoStream && !isScreenSharing ? 'active-video' : ''}`}
                  onClick={toggleCallVideo}
                  disabled={callState.status === 'ended'}
                  title={
                    localVideoStream && !isScreenSharing ? 'Выключить камеру' : 'Включить камеру'
                  }
                >
                  {localVideoStream && !isScreenSharing ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              <button
                type="button"
                className={`call-ctrl-btn ctrl-secondary ${callState.muted ? 'active-mute' : ''}`}
                onClick={toggleCallMute}
                disabled={callState.status === 'ended'}
                title={callState.muted ? 'Включить микрофон' : 'Отключить микрофон'}
              >
                {callState.muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button
                type="button"
                className={`call-ctrl-btn ctrl-secondary ${voiceEnhancementEnabled ? 'active-enhancement active-video' : ''}`}
                onClick={toggleVoiceEnhancement}
                disabled={callState.status !== 'connected'}
                title={voiceEnhancementEnabled ? 'Отключить улучшение голоса' : 'Включить улучшение голоса'}
              >
                <SlidersHorizontal size={20} />
              </button>

              {showVideoControls && isScreenShareSupported && (
                <button
                  type="button"
                  className={`call-ctrl-btn ctrl-secondary ${isScreenSharing ? 'active-screenshare' : ''}`}
                  onClick={toggleCallScreenShare}
                  disabled={callState.status === 'ended'}
                  title={
                    isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'
                  }
                >
                  <Monitor size={20} />
                </button>
              )}

              {callState.status === 'connected' &&
                callState.webrtcState === 'failed' &&
                typeof retryCallConnection === 'function' && (
                  <button
                    type="button"
                    className="call-ctrl-btn ctrl-secondary call-retry"
                    onClick={retryCallConnection}
                    title="Повторить соединение"
                  >
                    <RefreshCw size={20} />
                  </button>
                )}

              <button
                type="button"
                className="call-ctrl-btn call-hangup ctrl-secondary"
                onClick={endCall}
                disabled={callState.status === 'ended'}
                title="Завершить звонок"
              >
                <PhoneOff size={20} />
              </button>
            </div>
          )}
        </div>

        {!isIncoming && !isCompact && (
          <div
            className="call-resize-handle"
            onMouseDown={handleResizeMouseDown}
            onTouchStart={handleResizeTouchStart}
            title="Растянуть окно"
          />
        )}
      </div>
    </div>
  );
}
