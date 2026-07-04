import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff, Phone } from 'lucide-react';

export default function CallOverlay() {
  const {
    callState,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    localStreamRef,
    renderAvatar
  } = useChat();

  const [duration, setDuration] = useState(0);
  const localVideoRef = useRef(null);
  const canvasRef = useRef(null);

  // Connection timer
  useEffect(() => {
    if (callState.status !== 'connected') {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState.status]);

  // Assign local stream to PiP video element
  useEffect(() => {
    if (callState.status === 'idle') return;
    const interval = setInterval(() => {
      if (localVideoRef.current && localStreamRef.current && callState.type === 'video' && !callState.isVideoOff) {
        if (localVideoRef.current.srcObject !== localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [callState.status, callState.type, callState.isVideoOff, localStreamRef]);

  // Audio analyzer canvas animation
  useEffect(() => {
    if (callState.status !== 'connected' || !localStreamRef.current) return;

    let animationFrameId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let audioContext;
    let source;
    let analyser;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      source = audioContext.createMediaStreamSource(localStreamRef.current);
      source.connect(analyser);
      analyser.fftSize = 64;
    } catch (e) {
      console.warn("Visualizer audio context blocked or failed:", e);
    }

    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      
      let average = 0;
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        average = sum / bufferLength;
      } else {
        // Fallback pulsing if microphone is denied or inactive
        average = 10 + Math.sin(Date.now() / 200) * 8;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 80;
      const bounce = (average / 255) * 55; // visual amplitude scaling

      // Ripple 1 (Accent Color)
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + bounce, 0, 2 * Math.PI);
      ctx.stroke();

      // Ripple 2 (Faded Outer Ripple)
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + bounce * 1.8 + 18, 0, 2 * Math.PI);
      ctx.stroke();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [callState.status, localStreamRef]);

  if (callState.status === 'idle') return null;

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  let statusLabel = 'Звонок...';
  if (callState.status === 'incoming') statusLabel = 'Входящий звонок...';
  else if (callState.status === 'connected') statusLabel = `Соединение установлено • ${formatDuration(duration)}`;
  else if (callState.status === 'ended') statusLabel = 'Звонок завершен';

  return (
    <div className={`call-overlay-screen ${callState.status}`}>
      {/* Dynamic blurred background based on avatar color */}
      <div 
        className="call-blur-background" 
        style={{ background: callState.peerAvatarColor }} 
      />

      <div className="call-overlay-content">
        {/* Call Header Status */}
        <div className="call-status-header">
          <span className="call-type-indicator">
            {callState.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
          </span>
          <h2 className="call-status-text">{statusLabel}</h2>
        </div>

        {/* Central Contact Stage */}
        <div className="call-avatar-stage">
          {callState.status === 'connected' && (
            <canvas 
              ref={canvasRef} 
              width={350} 
              height={350} 
              className="call-canvas-visualizer"
            />
          )}

          <div className="call-avatar-outer-pulse">
            <div 
              className={`call-avatar-wrapper ${callState.status === 'calling' ? 'pulsing' : ''}`}
              style={{ background: callState.peerAvatarColor }}
            >
              {renderAvatar(callState.peerAvatar, '👤')}
            </div>
          </div>
          <h3 className="call-peer-name">{callState.peerName}</h3>
        </div>

        {/* Local Webcam Pip (for Video Call) */}
        {callState.type === 'video' && callState.status !== 'ended' && !callState.isVideoOff && (
          <div className="call-local-pip">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="local-pip-video"
            />
          </div>
        )}

        {/* Actions Controls Bar */}
        <div className="call-controls-bar">
          {callState.status === 'incoming' ? (
            <div className="call-incoming-row">
              <button 
                className="call-control-btn accept" 
                onClick={acceptCall}
                title="Ответить"
              >
                <Phone size={24} />
              </button>
              <button 
                className="call-control-btn hangup" 
                onClick={rejectCall}
                title="Отклонить"
              >
                <PhoneOff size={24} />
              </button>
            </div>
          ) : (
            <div className="call-active-row">
              <button 
                className={`call-control-btn secondary ${callState.isMuted ? 'active' : ''}`}
                onClick={toggleMute}
                title={callState.isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                {callState.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {callState.type === 'video' && (
                <button 
                  className={`call-control-btn secondary ${callState.isVideoOff ? 'active' : ''}`}
                  onClick={toggleVideo}
                  title={callState.isVideoOff ? 'Включить видео' : 'Выключить видео'}
                >
                  {callState.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              <button 
                className="call-control-btn hangup" 
                onClick={endCall}
                title="Завершить звонок"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
