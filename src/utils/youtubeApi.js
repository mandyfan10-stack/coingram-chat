/** Load YouTube IFrame API once (browser). */

let ytApiPromise = null;

export function loadYoutubeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(window.YT);
    };
    if (!document.querySelector('script[data-pulse-yt]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.dataset.pulseYt = '1';
      document.head.appendChild(s);
    }
    if (window.YT?.Player) resolve(window.YT);
  });

  return ytApiPromise;
}
