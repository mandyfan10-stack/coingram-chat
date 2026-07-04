import React, { useEffect, useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { Mic, MicOff, PhoneOff, Phone, Video, VideoOff } from 'lucide-react';

export default function CallOverlay() {
  const { 
    callState, 
    setCallState, 
    endCall, 
    toggleCallMute, 
    acceptCall, 
    rejectCall, 
    chats, 
    renderAvatar, 
    currentUser,
    localVideoStream,
    remoteVideoStream,
    toggleCallVideo
  } = useChat();

  const [pulseScale, setPulseScale] = useState(1);
  const ringRef = useRef(null);
  const timerRef = useRef(null);
  const connectSoundPlayedRef = useRef(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Drag position offset for floating preview window
  const [dragPos, setDragPos] = useState({ x: 318, y: 12 });
  const dragRef = useRef(null);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const elementStart = useRef({ x: 0, y: 0 });

  // If outgoing call, target is callState.chatId. If incoming, display caller info.
  const activeChat = chats.find(c => c.id === callState.chatId);

  // Play synthetic call sounds using Web Audio API
  const playConnectSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  };

  const playDisconnectSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      osc.frequency.setValueAtTime(240, audioCtx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {}
  };

  const startRingingSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = () => {
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(425, audioCtx.currentTime); // Standard ringback frequency
          
          gain.gain.setValueAtTime(0, audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.05);
          gain.gain.setValueAtTime(0.06, audioCtx.currentTime + 0.95);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.05);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 1.05);
        } catch (e) {}
      };
      
      playBeep();
      const ringInterval = setInterval(playBeep, 3000);
      
      return {
        stop: () => {
          clearInterval(ringInterval);
          try {
            audioCtx.close();
          } catch (e) {}
        }
      };
    } catch (e) {
      return { stop: () => {} };
    }
  };

  const startIncomingRingingSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = () => {
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
          osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
          
          gain.gain.setValueAtTime(0, audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.8);
        } catch (e) {}
      };
      
      playBeep();
      const ringInterval = setInterval(playBeep, 2000);
      
      return {
        stop: () => {
          clearInterval(ringInterval);
          try {
            audioCtx.close();
          } catch (e) {}
        }
      };
    } catch (e) {
      return { stop: () => {} };
    }
  };

  // Manage Call States
  useEffect(() => {
    // Reset connect sound flag if not connected
    if (callState.status !== 'connected') {
      connectSoundPlayedRef.current = false;
    }

    // Stop ringing if status is no longer calling or incoming
    if (callState.status !== 'calling' && callState.status !== 'incoming') {
      if (ringRef.current) {
        ringRef.current.stop();
        ringRef.current = null;
      }
    }

    if (callState.status === 'calling') {
      if (!ringRef.current) {
        ringRef.current = startRingingSound();
      }
    } else if (callState.status === 'incoming') {
      if (!ringRef.current) {
        ringRef.current = startIncomingRingingSound();
      }
    } else if (callState.status === 'connected') {
      if (callState.webrtcState === 'connected') {
        if (!connectSoundPlayedRef.current) {
          playConnectSound();
          connectSoundPlayedRef.current = true;
        }

        // Active call timer
        timerRef.current = setInterval(() => {
          setCallState(prev => ({
            ...prev,
            duration: prev.duration + 1
          }));
        }, 1000);

        // Simulated voice activity scale updates for wave animation
        const pulseInterval = setInterval(() => {
          setPulseScale(1 + Math.random() * 0.28);
        }, 150);

        return () => {
          clearInterval(timerRef.current);
          clearInterval(pulseInterval);
        };
      } else {
        setPulseScale(1.0);
      }
    } else if (callState.status === 'ended') {
      playDisconnectSound();
    }

    return () => {
      // General cleanup
    };
  }, [callState.status, callState.webrtcState]);

  // Bind local and remote video streams to refs
  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream;
    }
    if (localVideoStream) {
      setDragPos({ x: 318, y: 12 });
    }
  }, [localVideoStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoStream) {
      remoteVideoRef.current.srcObject = remoteVideoStream;
    }
  }, [remoteVideoStream]);

  // Interactive Drag-and-drop Handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    elementStart.current = { x: dragPos.x, y: dragPos.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    if (containerRef.current && dragRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementRect = dragRef.current.getBoundingClientRect();
      
      let newX = elementStart.current.x + dx;
      let newY = elementStart.current.y + dy;
      
      const maxX = containerRect.width - elementRect.width - 12;
      const maxY = containerRect.height - elementRect.height - 12;
      
      newX = Math.max(12, Math.min(newX, maxX));
      newY = Math.max(12, Math.min(newY, maxY));
      
      setDragPos({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e) => {
    isDragging.current = true;
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    elementStart.current = { x: dragPos.x, y: dragPos.y };
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;

    if (containerRef.current && dragRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementRect = dragRef.current.getBoundingClientRect();

      let newX = elementStart.current.x + dx;
      let newY = elementStart.current.y + dy;

      const maxX = containerRect.width - elementRect.width - 12;
      const maxY = containerRect.height - elementRect.height - 12;

      newX = Math.max(12, Math.min(newX, maxX));
      newY = Math.max(12, Math.min(newY, maxY));

      setDragPos({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  if (callState.status === 'idle') return null;

  // Formatting calling duration
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine User details to display
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

  // Determine Call Subtitle Status
  let statusText = 'Подключение...';
  if (callState.status === 'calling') {
    statusText = 'Звонок...';
  } else if (callState.status === 'incoming') {
    statusText = 'Входящий звонок...';
  } else if (callState.status === 'connected') {
    if (callState.webrtcState === 'connected') {
      statusText = formatTime(callState.duration);
    } else if (callState.webrtcState === 'failed') {
      statusText = 'Ошибка подключения';
    } else {
      statusText = 'Соединение...';
    }
  } else if (callState.status === 'ended') {
    statusText = 'Звонок завершен';
  }

  const showBackgroundAvatar = !remoteVideoStream;
  const hasVideo = !!(localVideoStream || remoteVideoStream);

  return (
    <div className={`call-overlay-wrapper ${callState.status !== 'idle' ? 'active' : ''}`}>
      <div className={`call-card ${remoteVideoStream ? 'has-remote-video' : ''} ${hasVideo ? 'has-video' : ''}`} ref={containerRef}>
        
        {/* Remote Video Stream Feed */}
        {remoteVideoStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video-feed"
          />
        )}

        {/* Local Video Stream Preview (Draggable) */}
        {localVideoStream && (
          <div
            ref={dragRef}
            className="local-video-preview"
            style={{ left: `${dragPos.x}px`, top: `${dragPos.y}px` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video-feed"
            />
          </div>
        )}

        {/* Background Visual Wave Glow Circles */}
        <div className={`call-avatar-section ${!showBackgroundAvatar ? 'fade-out' : ''}`}>
          {callState.status === 'connected' && callState.webrtcState === 'connected' && !callState.muted && (
            <>
              <div className="wave-pulse wave-1" style={{ transform: `scale(${pulseScale * 1.15})`, opacity: 0.15 }} />
              <div className="wave-pulse wave-2" style={{ transform: `scale(${pulseScale * 1.35})`, opacity: 0.1 }} />
              <div className="wave-pulse wave-3" style={{ transform: `scale(${pulseScale * 1.55})`, opacity: 0.05 }} />
            </>
          )}
          <div className="call-avatar-circle" style={{ background: avatarColor }}>
            {renderAvatar(avatarContent, '👤')}
          </div>
        </div>

        {/* User Info Header */}
        <h2 className="call-user-name">{displayName}</h2>
        <p className="call-status-subtitle">{statusText}</p>

        {/* Call Controls Panel */}
        <div className="call-controls">
          {callState.status === 'incoming' ? (
            <div className="incoming-buttons" style={{ display: 'flex', gap: '24px' }}>
              <button 
                type="button"
                className="call-ctrl-btn call-accept"
                onClick={acceptCall}
                title="Ответить на звонок"
              >
                <Phone size={22} />
              </button>
              <button 
                type="button"
                className="call-ctrl-btn call-hangup"
                onClick={rejectCall}
                title="Отклонить звонок"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          ) : (
            <>
              <button 
                type="button"
                className={`call-ctrl-btn ${callState.muted ? 'active-mute' : ''}`}
                onClick={toggleCallMute}
                disabled={callState.status === 'ended'}
                title={callState.muted ? 'Включить микрофон' : 'Отключить микрофон'}
              >
                {callState.muted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
              
              <button 
                type="button"
                className={`call-ctrl-btn ${localVideoStream ? 'active-video' : ''}`}
                onClick={toggleCallVideo}
                disabled={callState.status === 'ended'}
                title={localVideoStream ? 'Выключить камеру' : 'Включить камеру'}
              >
                {localVideoStream ? <VideoOff size={22} /> : <Video size={22} />}
              </button>

              <button 
                type="button"
                className="call-ctrl-btn call-hangup"
                onClick={endCall}
                disabled={callState.status === 'ended'}
                title="Завершить звонок"
              >
                <PhoneOff size={22} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
