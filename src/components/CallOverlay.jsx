import React, { useEffect, useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { Mic, MicOff, PhoneOff, Phone, Video, VideoOff, Monitor, Minimize2, Maximize2 } from 'lucide-react';

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
    toggleCallVideo,
    isScreenSharing,
    toggleCallScreenShare,
    groupCallParticipants
  } = useChat();

  const [pulseScale, setPulseScale] = useState(1);
  const ringRef = useRef(null);
  const timerRef = useRef(null);
  const connectSoundPlayedRef = useRef(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // States for card dragging and minimizing
  const [cardPos, setCardPos] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [bubblePos, setBubblePos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 120 });
  const [cardSize, setCardSize] = useState({ width: 320, height: 440 });
  const [isVideoContain, setIsVideoContain] = useState(false);

  // Drag position offset for floating preview window
  const [dragPos, setDragPos] = useState({ x: 318, y: 12 });
  const dragRef = useRef(null);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const elementStart = useRef({ x: 0, y: 0 });

  // Draggable logic for the main call card
  const isDraggingCard = useRef(false);
  const cardDragStart = useRef({ x: 0, y: 0 });
  const cardElementStart = useRef({ x: 0, y: 0 });

  // Resizing logic for the main call card
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ width: 0, height: 0 });

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY };
    sizeStart.current = { ...cardSize };
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  };

  const handleResizeMouseMove = (e) => {
    if (!isResizing.current) return;
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    const newWidth = Math.max(320, Math.min(window.innerWidth - (cardPos?.x || 0) - 12, sizeStart.current.width + dx));
    const newHeight = Math.max(400, Math.min(window.innerHeight - (cardPos?.y || 0) - 12, sizeStart.current.height + dy));
    setCardSize({ width: newWidth, height: newHeight });
  };

  const handleResizeMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  };

  const handleResizeTouchStart = (e) => {
    e.stopPropagation();
    isResizing.current = true;
    const touch = e.touches[0];
    resizeStart.current = { x: touch.clientX, y: touch.clientY };
    sizeStart.current = { ...cardSize };
    document.addEventListener('touchmove', handleResizeTouchMove, { passive: false });
    document.addEventListener('touchend', handleResizeTouchEnd);
  };

  const handleResizeTouchMove = (e) => {
    if (!isResizing.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - resizeStart.current.x;
    const dy = touch.clientY - resizeStart.current.y;
    const newWidth = Math.max(320, Math.min(window.innerWidth - (cardPos?.x || 0) - 12, sizeStart.current.width + dx));
    const newHeight = Math.max(400, Math.min(window.innerHeight - (cardPos?.y || 0) - 12, sizeStart.current.height + dy));
    setCardSize({ width: newWidth, height: newHeight });
  };

  const handleResizeTouchEnd = () => {
    isResizing.current = false;
    document.removeEventListener('touchmove', handleResizeTouchMove);
    document.removeEventListener('touchend', handleResizeTouchEnd);
  };

  const handleCardMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('.local-video-preview') || e.target.closest('.call-resize-handle')) return;
    e.preventDefault();
    isDraggingCard.current = true;
    cardDragStart.current = { x: e.clientX, y: e.clientY };
    cardElementStart.current = { x: cardPos?.x || 0, y: cardPos?.y || 0 };
    document.addEventListener('mousemove', handleCardMouseMove);
    document.addEventListener('mouseup', handleCardMouseUp);
  };

  const handleCardMouseMove = (e) => {
    if (!isDraggingCard.current) return;
    const dx = e.clientX - cardDragStart.current.x;
    const dy = e.clientY - cardDragStart.current.y;
    let newX = cardElementStart.current.x + dx;
    let newY = cardElementStart.current.y + dy;
    const maxX = window.innerWidth - cardSize.width - 12;
    const maxY = window.innerHeight - cardSize.height - 12;
    newX = Math.max(12, Math.min(newX, maxX));
    newY = Math.max(12, Math.min(newY, maxY));
    setCardPos({ x: newX, y: newY });
  };

  const handleCardMouseUp = () => {
    isDraggingCard.current = false;
    document.removeEventListener('mousemove', handleCardMouseMove);
    document.removeEventListener('mouseup', handleCardMouseUp);
  };

  const handleCardTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('.local-video-preview') || e.target.closest('.call-resize-handle')) return;
    isDraggingCard.current = true;
    const touch = e.touches[0];
    cardDragStart.current = { x: touch.clientX, y: touch.clientY };
    cardElementStart.current = { x: cardPos?.x || 0, y: cardPos?.y || 0 };
    document.addEventListener('touchmove', handleCardTouchMove, { passive: false });
    document.addEventListener('touchend', handleCardTouchEnd);
  };

  const handleCardTouchMove = (e) => {
    if (!isDraggingCard.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - cardDragStart.current.x;
    const dy = touch.clientY - cardDragStart.current.y;
    let newX = cardElementStart.current.x + dx;
    let newY = cardElementStart.current.y + dy;
    const maxX = window.innerWidth - cardSize.width - 12;
    const maxY = window.innerHeight - cardSize.height - 12;
    newX = Math.max(12, Math.min(newX, maxX));
    newY = Math.max(12, Math.min(newY, maxY));
    setCardPos({ x: newX, y: newY });
  };

  const handleCardTouchEnd = () => {
    isDraggingCard.current = false;
    document.removeEventListener('touchmove', handleCardTouchMove);
    document.removeEventListener('touchend', handleCardTouchEnd);
  };

  // Draggable logic for the minimized bubble
  const isDraggingBubble = useRef(false);
  const bubbleDragStart = useRef({ x: 0, y: 0 });
  const bubbleElementStart = useRef({ x: 0, y: 0 });
  const clickPrevented = useRef(false);

  const handleBubbleMouseDown = (e) => {
    e.preventDefault();
    isDraggingBubble.current = true;
    clickPrevented.current = false;
    bubbleDragStart.current = { x: e.clientX, y: e.clientY };
    bubbleElementStart.current = { x: bubblePos.x, y: bubblePos.y };
    document.addEventListener('mousemove', handleBubbleMouseMove);
    document.addEventListener('mouseup', handleBubbleMouseUp);
  };

  const handleBubbleMouseMove = (e) => {
    if (!isDraggingBubble.current) return;
    const dx = e.clientX - bubbleDragStart.current.x;
    const dy = e.clientY - bubbleDragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      clickPrevented.current = true;
    }
    let newX = bubbleElementStart.current.x + dx;
    let newY = bubbleElementStart.current.y + dy;
    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 70;
    newX = Math.max(10, Math.min(newX, maxX));
    newY = Math.max(10, Math.min(newY, maxY));
    setBubblePos({ x: newX, y: newY });
  };

  const handleBubbleMouseUp = () => {
    isDraggingBubble.current = false;
    document.removeEventListener('mousemove', handleBubbleMouseMove);
    document.removeEventListener('mouseup', handleBubbleMouseUp);
  };

  const handleBubbleTouchStart = (e) => {
    isDraggingBubble.current = true;
    clickPrevented.current = false;
    const touch = e.touches[0];
    bubbleDragStart.current = { x: touch.clientX, y: touch.clientY };
    bubbleElementStart.current = { x: bubblePos.x, y: bubblePos.y };
    document.addEventListener('touchmove', handleBubbleTouchMove, { passive: false });
    document.addEventListener('touchend', handleBubbleTouchEnd);
  };

  const handleBubbleTouchMove = (e) => {
    if (!isDraggingBubble.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - bubbleDragStart.current.x;
    const dy = touch.clientY - bubbleDragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      clickPrevented.current = true;
    }
    let newX = bubbleElementStart.current.x + dx;
    let newY = bubbleElementStart.current.y + dy;
    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 70;
    newX = Math.max(10, Math.min(newX, maxX));
    newY = Math.max(10, Math.min(newY, maxY));
    setBubblePos({ x: newX, y: newY });
  };

  const handleBubbleTouchEnd = () => {
    isDraggingBubble.current = false;
    document.removeEventListener('touchmove', handleBubbleTouchMove);
    document.removeEventListener('touchend', handleBubbleTouchEnd);
  };

  const handleBubbleClick = (e) => {
    if (clickPrevented.current) {
      e.stopPropagation();
      return;
    }
    setIsMinimized(false);
  };

  // Reset positioning & minimization on call state transition
  useEffect(() => {
    if (callState.status !== 'idle') {
      setIsMinimized(false);
      setCardPos({
        x: Math.max(12, window.innerWidth / 2 - 160),
        y: Math.max(12, window.innerHeight / 2 - 220)
      });
      setBubblePos({
        x: window.innerWidth - 80,
        y: window.innerHeight - 120
      });
    } else {
      setCardPos(null);
    }
  }, [callState.status]);

  // Window resize handler to keep components within viewport bounds
  useEffect(() => {
    const handleResize = () => {
      setBubblePos(prev => {
        const maxX = window.innerWidth - 70;
        const maxY = window.innerHeight - 70;
        return {
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY)
        };
      });
      if (cardPos) {
        setCardPos(prev => {
          const maxX = window.innerWidth - cardSize.width - 12;
          const maxY = window.innerHeight - cardSize.height - 12;
          return {
            x: Math.max(12, Math.min(prev.x, maxX)),
            y: Math.max(12, Math.min(prev.y, maxY))
          };
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [cardPos, cardSize]);

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

  // Auto-contain remote screen shares
  useEffect(() => {
    if (callState.isRemoteScreenSharing) {
      setIsVideoContain(true);
    }
  }, [callState.isRemoteScreenSharing]);

  // Keep local video preview (dragPos) inside card bounds when cardSize or stream changes
  useEffect(() => {
    if (dragRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementRect = dragRef.current.getBoundingClientRect();
      
      const maxX = containerRect.width - elementRect.width - 12;
      const maxY = containerRect.height - elementRect.height - 12;
      
      setDragPos(prev => {
        const newX = Math.max(12, Math.min(prev.x, maxX));
        const newY = Math.max(12, Math.min(prev.y, maxY));
        if (newX !== prev.x || newY !== prev.y) {
          return { x: newX, y: newY };
        }
        return prev;
      });
    }
  }, [cardSize, localVideoStream]);

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
  const isScreenShareSupported = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';

  if (isMinimized) {
    return (
      <div 
        className="call-minimized-bubble"
        style={{ left: `${bubblePos.x}px`, top: `${bubblePos.y}px` }}
        onMouseDown={handleBubbleMouseDown}
        onTouchStart={handleBubbleTouchStart}
        onClick={handleBubbleClick}
        title="Развернуть звонок"
      >
        <div className="call-bubble-avatar" style={{ background: avatarColor }}>
          {renderAvatar(avatarContent, '👤')}
        </div>
        {callState.status === 'connected' && callState.webrtcState === 'connected' && (
          <div className="call-bubble-pulse" />
        )}
        <div className="call-bubble-timer">
          {statusText}
        </div>
      </div>
    );
  }

  const isIncoming = callState.status === 'incoming';
  const cardStyle = {
    ...(cardPos ? {
      position: 'absolute',
      left: `${cardPos.x}px`,
      top: `${cardPos.y}px`,
      margin: 0
    } : {}),
    width: `${cardSize.width}px`,
    height: `${cardSize.height}px`,
    transition: (isDraggingCard.current || isResizing.current) ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.3s ease, height 0.3s ease'
  };

  return (
    <div className={`call-overlay-wrapper ${callState.status !== 'idle' ? 'active' : ''} ${!isIncoming ? 'non-blocking' : ''}`}>
      <div 
        className={`call-card ${remoteVideoStream ? 'has-remote-video' : ''} ${hasVideo ? 'has-video' : ''} ${isVideoContain ? 'is-contain' : ''}`} 
        ref={containerRef}
        style={cardStyle}
        onMouseDown={handleCardMouseDown}
        onTouchStart={handleCardTouchStart}
      >
        {/* Minimize & Scale buttons in Header */}
        {!isIncoming && (
          <div className="call-header-actions">
            {remoteVideoStream && (
              <button 
                type="button" 
                className="call-action-icon-btn" 
                onClick={() => setIsVideoContain(prev => !prev)}
                title={isVideoContain ? "Заполнить экран" : "Вписать в экран"}
              >
                <Maximize2 size={16} />
              </button>
            )}
            <button 
              type="button" 
              className="call-action-icon-btn" 
              onClick={() => setIsMinimized(true)}
              title="Свернуть"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        )}
        
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

        {activeChat && activeChat.type === 'group' ? (
          <div className="group-call-container">
            <h2 className="call-user-name" style={{ marginBottom: '8px' }}>Голосовой чат: {displayName}</h2>
            <p className="call-status-subtitle" style={{ marginBottom: '16px' }}>{statusText}</p>
            
            <div className="group-call-stage-list">
              {(groupCallParticipants || []).map(p => (
                <div key={p.id} className={`group-call-member-row ${p.speaking ? 'speaking' : ''}`}>
                  <div 
                    className={`group-call-avatar-wrapper ${p.speaking ? 'speaking' : ''}`}
                    style={{ background: p.avatarColor || 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' }}
                  >
                    {renderAvatar(p.avatar, '👤')}
                  </div>
                  <div className="group-call-member-info">
                    <span className="group-call-member-name">{p.name}</span>
                    <span className={`group-call-member-status ${p.muted ? 'muted' : p.speaking ? 'speaking' : 'online'}`}>
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
                        <span className="wave-bar"></span>
                        <span className="wave-bar"></span>
                        <span className="wave-bar"></span>
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
            <div className="call-status-container">
              <p className="call-status-subtitle">{statusText}</p>
              {callState.status === 'connected' && callState.webrtcState === 'connected' && (callState.isLocalSpeaking || callState.isRemoteSpeaking) && (
                <div className="speaking-wave-indicator one-to-one-wave">
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                </div>
              )}
            </div>
          </>
        )}

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
            <div className="active-controls-panel">
              <button 
                type="button"
                className={`call-ctrl-btn ctrl-secondary ${localVideoStream && !isScreenSharing ? 'active-video' : ''}`}
                onClick={toggleCallVideo}
                disabled={callState.status === 'ended'}
                title={localVideoStream && !isScreenSharing ? 'Выключить камеру' : 'Включить камеру'}
              >
                {localVideoStream && !isScreenSharing ? <VideoOff size={20} /> : <Video size={20} />}
              </button>

              <button 
                type="button"
                className={`call-ctrl-btn ctrl-secondary ${callState.muted ? 'active-mute' : ''}`}
                onClick={toggleCallMute}
                disabled={callState.status === 'ended'}
                title={callState.muted ? 'Включить микрофон' : 'Отключить микрофон'}
              >
                {callState.muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              
              {isScreenShareSupported && (
                <button 
                  type="button"
                  className={`call-ctrl-btn ctrl-secondary ${isScreenSharing ? 'active-screenshare' : ''}`}
                  onClick={toggleCallScreenShare}
                  disabled={callState.status === 'ended'}
                  title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
                >
                  <Monitor size={20} />
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

        {/* Resize Handle */}
        {!isIncoming && (
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
