import { useEffect, useRef } from 'react';

/**
 * Hook for edge-swipe gestures on mobile screens (< 768px).
 * Detects swiping from the left edge to the right to go back to the chat list.
 *
 * @param {Object} options
 * @param {() => void} options.onSwipeBack - Callback fired on successful edge swipe
 * @param {boolean} [options.enabled=true] - Whether edge swipe is enabled
 * @param {number} [options.edgeThresholdPx=40] - Maximum X coordinate from left edge to start gesture
 * @param {number} [options.minDistancePx=60] - Minimum horizontal swipe distance to trigger back
 */
export function useEdgeSwipeBack({
  onSwipeBack,
  enabled = true,
  edgeThresholdPx = 40,
  minDistancePx = 60
}) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isEdgeGestureRef = useRef(false);
  const onSwipeBackRef = useRef(onSwipeBack);
  onSwipeBackRef.current = onSwipeBack;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleTouchStart = (e) => {
      if (window.innerWidth >= 768) return;
      if (!e.touches || e.touches.length !== 1) return;

      const touch = e.touches[0];
      if (touch.clientX <= edgeThresholdPx) {
        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        isEdgeGestureRef.current = true;
      } else {
        isEdgeGestureRef.current = false;
      }
    };

    const handleTouchEnd = (e) => {
      if (!isEdgeGestureRef.current) return;
      isEdgeGestureRef.current = false;

      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = Math.abs(touch.clientY - startYRef.current);

      // Horizontal gesture must dominate vertical scroll and exceed min distance
      if (deltaX >= minDistancePx && deltaX > deltaY * 1.6) {
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(10);
          }
        } catch {
          /* ignore */
        }
        if (typeof onSwipeBackRef.current === 'function') {
          onSwipeBackRef.current();
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, edgeThresholdPx, minDistancePx]);
}

export default useEdgeSwipeBack;
