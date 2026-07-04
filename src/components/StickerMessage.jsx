import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'lucide-react';

// Load lottie-web dynamically from CDN to keep package size small
const loadLottie = () => {
  return new Promise((resolve, reject) => {
    if (window.lottie) {
      resolve(window.lottie);
      return;
    }
    // Check if script already exists
    const existing = document.getElementById('lottie-cdn-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.lottie));
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'lottie-cdn-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
    script.async = true;
    script.onload = () => resolve(window.lottie);
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
};

export default function StickerMessage({ mediaUrl }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(false);

  // Parse file extension to identify format
  const isLottie = mediaUrl && (mediaUrl.endsWith('.json') || mediaUrl.includes('.json?'));
  const isVideo = mediaUrl && (mediaUrl.endsWith('.webm') || mediaUrl.includes('.webm?'));

  useEffect(() => {
    if (!isLottie || !containerRef.current) return;

    let anim = null;
    loadLottie()
      .then((lottie) => {
        if (!containerRef.current) return;
        anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: mediaUrl,
        });
      })
      .catch((err) => {
        console.error("Lottie load failed:", err);
        setError(true);
      });

    return () => {
      if (anim) {
        anim.destroy();
      }
    };
  }, [mediaUrl, isLottie]);

  if (error) {
    return (
      <div className="sticker-fallback" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '130px', height: '130px', backgroundColor: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
        <Image size={32} />
      </div>
    );
  }

  if (isLottie) {
    return (
      <div 
        ref={containerRef} 
        className="sticker-container sticker-animated" 
        style={{ width: '130px', height: '130px' }} 
      />
    );
  }

  if (isVideo) {
    return (
      <video
        src={mediaUrl}
        autoPlay
        loop
        muted
        playsInline
        className="sticker-container sticker-video"
        style={{ width: '130px', height: '130px', objectFit: 'contain' }}
      />
    );
  }

  // Fallback: WebP/Static Sticker
  return (
    <img
      src={mediaUrl}
      alt="Стикер"
      className="sticker-container sticker-static"
      style={{ width: '130px', height: '130px', objectFit: 'contain' }}
      onError={() => setError(true)}
    />
  );
}
