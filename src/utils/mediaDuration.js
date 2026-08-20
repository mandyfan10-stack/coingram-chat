const WEBM_DURATION_PROBE_TIME = 1e101;

function hasFiniteDuration(media) {
  return Number.isFinite(media?.duration) && media.duration > 0;
}
export function prepareFiniteMediaDuration(media, onReady) {
  if (!media || typeof onReady !== 'function') return () => {};

  let settled = false;
  let probing = false;

  const settle = () => {
    if (settled || !hasFiniteDuration(media)) return false;

    settled = true;
    media.currentTime = 0;
    onReady(media.duration);
    return true;
  };

  const inspectDuration = () => {
    if (settle() || settled) return;

    if (media.duration === Infinity && !probing) {
      probing = true;
      media.currentTime = WEBM_DURATION_PROBE_TIME;
    }
  };

  media.addEventListener('loadedmetadata', inspectDuration);
  media.addEventListener('durationchange', inspectDuration);
  media.addEventListener('seeked', inspectDuration);
  inspectDuration();

  return () => {
    settled = true;
    media.removeEventListener('loadedmetadata', inspectDuration);
    media.removeEventListener('durationchange', inspectDuration);
    media.removeEventListener('seeked', inspectDuration);
  };
}
