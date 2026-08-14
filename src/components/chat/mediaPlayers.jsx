import React, { useState, useEffect, useRef } from 'react';
import { Play, VolumeX, Volume2 } from 'lucide-react';
import StickerMessage from '../StickerMessage';
import useResolvedMedia from '../../hooks/useResolvedMedia';

function AttachmentUnavailable({ compact = false }) {
  return (
    <div className={'bubble-media-error' + (compact ? ' bubble-media-error-compact' : '')}>
      Вложение недоступно
    </div>
  );
}

function DecryptedImage({ mediaUrl, chatId, onOpen }) {
  const { url, loading, error } = useResolvedMedia(mediaUrl, chatId, 'image/png');
  if (loading) {
    return (
      <div className="bubble-media-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
        <div className="spinner" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', width: '20px', height: '20px' }}></div>
      </div>
    );
  }
  if (error || !url) return <AttachmentUnavailable />;
  return (
    <button type="button" className="bubble-media-open" onClick={(event) => { event.stopPropagation(); onOpen?.(url); }} aria-label="Открыть изображение">
      <img src={url} alt="Изображение" className="bubble-media" />
    </button>
  );
}

function DecryptedVideoPlayer({ mediaUrl, chatId }) {
  const { url, loading, error } = useResolvedMedia(mediaUrl, chatId, 'video/webm');
  if (loading) {
    return (
      <div className="bubble-media-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
        <div className="spinner" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', width: '20px', height: '20px' }}></div>
      </div>
    );
  }
  if (error || !url) return <AttachmentUnavailable />;
  return <VideoMessagePlayer videoUrl={url} />;
}

function DecryptedVoicePlayer({ mediaUrl, chatId }) {
  const { url, loading, error } = useResolvedMedia(mediaUrl, chatId, 'audio/webm');
  if (loading) {
    return (
      <div className="voice-player-bubble-loading" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px' }}>
        <div className="spinner" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', width: '12px', height: '12px' }}></div>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Загрузка голосового сообщения...</span>
      </div>
    );
  }
  if (error || !url) return <AttachmentUnavailable compact />;
  return <VoiceMessagePlayer audioUrl={url} />;
}

function DecryptedSticker({ mediaUrl, chatId }) {
  const { url, loading, error } = useResolvedMedia(mediaUrl, chatId);
  if (loading) {
    return (
      <div
        className="bubble-media-loading"
        style={{ width: '130px', height: '130px', borderRadius: '12px' }}
      />
    );
  }
  if (error || !url) return <AttachmentUnavailable />;
  return <StickerMessage mediaUrl={url} sourceUrl={mediaUrl} />;
}

function VoiceMessagePlayer({ audioUrl, duration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(duration || 0);
  const audioRef = useRef(null);
  const isCalculatingRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setCurrentTime(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      if (!isCalculatingRef.current && audio.paused) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleDurationCompute = () => {
      if (audio.duration === Infinity) {
        isCalculatingRef.current = true;
        audio.currentTime = 1e101;
        
        const onSeeked = () => {
          audio.removeEventListener('seeked', onSeeked);
          setMaxDuration(audio.duration);
          audio.currentTime = 0;
          setTimeout(() => {
            isCalculatingRef.current = false;
          }, 150);
        };
        audio.addEventListener('seeked', onSeeked);
      } else if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setMaxDuration(audio.duration);
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDurationCompute);
    audio.addEventListener('durationchange', handleDurationCompute);

    setIsPlaying(false);
    setCurrentTime(0);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDurationCompute);
      audio.removeEventListener('durationchange', handleDurationCompute);
    };
  }, [audioUrl]);

  // Smooth 60fps progress update loop while playing
  useEffect(() => {
    if (!isPlaying) return undefined;
    let animId;
    const updateSmoothProgress = () => {
      const audio = audioRef.current;
      if (audio && !isCalculatingRef.current) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
          setMaxDuration(audio.duration);
        }
      }
      animId = requestAnimationFrame(updateSmoothProgress);
    };
    animId = requestAnimationFrame(updateSmoothProgress);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const togglePlay = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
    } else {
      if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.05)) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      audio.play().catch(err => console.error("Error playing audio:", err));
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    const val = parseFloat(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const formatTime = (time) => {
    if (isNaN(time) || time === Infinity) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = maxDuration > 0 ? Math.min(100, Math.max(0, (currentTime / maxDuration) * 100)) : 0;

  return (
    <div className="voice-player-bubble" onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button className="voice-play-btn" onClick={togglePlay} aria-label={isPlaying ? "Пауза" : "Воспроизвести"}>
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
      <div className="voice-player-details">
        <input
          type="range"
          className="voice-seek-bar"
          min={0}
          max={maxDuration || 100}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          style={{ '--voice-progress': `${progressPercent}%` }}
        />
        <div className="voice-player-meta">
          <span>{formatTime(currentTime)} / {formatTime(maxDuration)}</span>
        </div>
      </div>
    </div>
  );
}

function VideoMessagePlayer({ videoUrl }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasEnded, setHasEnded] = useState(false);
  const isCalculatingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isCalculatingRef.current && video.duration && video.duration !== Infinity) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleEnded = () => {
      setProgress(100);
      setIsPlaying(false);
      setHasEnded(true);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setHasEnded(false);
    };
    const handlePause = () => setIsPlaying(false);

    const handleDurationCompute = () => {
      if (video.duration === Infinity) {
        isCalculatingRef.current = true;
        video.currentTime = 1e101;
        
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          video.currentTime = 0;
          setTimeout(() => {
            isCalculatingRef.current = false;
          }, 150);
        };
        video.addEventListener('seeked', onSeeked);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleDurationCompute);
    video.addEventListener('durationchange', handleDurationCompute);

    video.play().catch(() => {
      setIsPlaying(false);
    });

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleDurationCompute);
      video.removeEventListener('durationchange', handleDurationCompute);
    };
  }, [videoUrl]);

  const togglePlaybackAndMute = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      if (hasEnded) video.currentTime = 0;
      video.muted = false;
      setIsMuted(false);
      video.play().then(() => setIsPlaying(true)).catch(err => console.error(err));
    } else {
      if (isPlaying) {
        video.pause();
      } else {
        if (hasEnded) video.currentTime = 0;
        video.play().then(() => setIsPlaying(true)).catch(err => console.error(err));
      }
    }
  };

  const handleMuteBtnClick = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const r = 88;
  const circ = 2 * Math.PI * r;
  const strokeDashoffset = circ - (progress / 100) * circ;

  return (
    <div className="round-video-wrapper" onClick={togglePlaybackAndMute}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="round-video-element"
        muted={isMuted}
        playsInline
        autoPlay
      />
      
      <svg className="video-progress-ring" viewBox="0 0 184 184">
        <circle
          className="video-progress-ring-circle"
          cx="92"
          cy="92"
          r={r}
          stroke="var(--accent-color)"
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circ}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 92 92)"
        />
      </svg>

      {!isPlaying && (
        <div className="video-mute-icon-overlay" style={{ top: '55%', left: '50%', transform: 'translate(-50%, -50%)', width: '36px', height: '36px', fontSize: '14px', position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />
        </div>
      )}

      <div className="video-mute-icon-overlay" onClick={handleMuteBtnClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </div>
    </div>
  );
}


export {
  AttachmentUnavailable,
  DecryptedImage,
  DecryptedVideoPlayer,
  DecryptedVoicePlayer,
  DecryptedSticker,
  VoiceMessagePlayer,
  VideoMessagePlayer
};
