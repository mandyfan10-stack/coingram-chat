import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Default long-press duration in milliseconds (~380ms matches Telegram mobile timing).
 */
export const DEFAULT_HOLD_DURATION_MS = 380;

/**
 * Default movement threshold in pixels before a touch is considered a scroll drag.
 */
export const DEFAULT_MOVE_THRESHOLD_PX = 10;

/**
 * Default maximum tap duration in milliseconds for mobile tap trigger.
 */
export const DEFAULT_TAP_MAX_DURATION_MS = 350;

/**
 * Default haptic feedback duration for long-press trigger in milliseconds.
 */
export const DEFAULT_HAPTIC_HOLD_MS = 12;

/**
 * Default haptic feedback duration for tap trigger in milliseconds.
 */
export const DEFAULT_HAPTIC_TAP_MS = 10;

/**
 * Exhaustive list of CSS selectors for interactive elements inside message bubbles
 * that must handle their own touch/click events without triggering message action sheets.
 */
export const DEFAULT_INTERACTIVE_SELECTORS = [
  // Standard interactive HTML elements and ARIA roles
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'video:not(.sticker-video):not(.sticker-container)',
  'audio',
  'label',
  '[role="button"]',
  '[role="link"]',
  '[role="option"]',
  '[contenteditable="true"]',
  '[data-interactive="true"]',
  '.interactive',

  // Voice player elements
  '.voice-play-btn',
  'button.voice-play-btn',
  '.voice-seek-bar',
  'input[type="range"].voice-seek-bar',
  '.voice-player-bubble',
  '.audio-progress-container',
  '.voice-player-details',

  // Video player elements
  '.round-video-wrapper',
  '.round-video-element',
  '.video-mute-icon-overlay',
  '.regular-video-wrapper',
  '.regular-video-element',
  '.regular-video-center-btn',
  '.regular-video-controls',
  '.regular-video-ctrl-btn',
  '.regular-video-seek',
  '.video-player-overlay',

  // Media open trigger
  '.bubble-media-open',
  'button.bubble-media-open',
  'img.bubble-media',

  // Message metadata and author actions
  '.message-sender-avatar',
  '.message-sender-avatar.interactive',
  '.sender-name',
  '.sender-name.interactive',

  // Reaction badges & drawer
  '.reaction-badge',
  'button.reaction-badge',
  '.bubble-reactions',
  '.bubble-reactions button',
  '.reaction-drawer',
  '.reaction-drawer-item',

  // Failed message retry menu & icons
  '.failed-message-menu',
  '.failed-menu-btn',
  '.failed-menu-btn.retry',
  '.failed-menu-btn.delete',
  '.seen-check.failed',
  'svg.seen-check.failed',

  // Hover actions & mobile action sheet elements
  '.message-hover-actions',
  '.hover-action-btn',
  '.mobile-action-sheet',
  '.mobile-action-sheet-backdrop',
  '.mobile-sheet-reactions',
  '.mobile-sheet-reaction-pill',
  '.mobile-sheet-item'
];

/**
 * Safely extracts client (x, y) coordinates from a pointer, touch, or mouse event.
 *
 * @param {any} event
 * @returns {{ x: number, y: number } | null}
 */
export function extractCoordinates(event) {
  if (!event) return null;
  const native = event.nativeEvent || event;

  // TouchEvent with active touches
  if (native.touches && native.touches.length > 0) {
    return { x: native.touches[0].clientX, y: native.touches[0].clientY };
  }
  // TouchEvent on touchend / touchcancel
  if (native.changedTouches && native.changedTouches.length > 0) {
    return { x: native.changedTouches[0].clientX, y: native.changedTouches[0].clientY };
  }
  // PointerEvent / MouseEvent
  if (typeof native.clientX === 'number' && typeof native.clientY === 'number') {
    return { x: native.clientX, y: native.clientY };
  }
  return null;
}

/**
 * Determines whether a given DOM event target or element is an interactive control
 * that should not trigger message long-press or tap action sheets.
 *
 * @param {any} target - EventTarget or Element to test
 * @param {string[] | string} [customSelectors=DEFAULT_INTERACTIVE_SELECTORS] - Selectors to test against
 * @param {((el: Element) => boolean) | null} [customPredicate=null] - Optional additional predicate
 * @returns {boolean}
 */
export function isInteractiveTarget(
  target,
  customSelectors = DEFAULT_INTERACTIVE_SELECTORS,
  customPredicate = null
) {
  if (!target || typeof target !== 'object') return false;

  // Resolve to Element if target is a Text or Document node
  let element = null;
  if ('nodeType' in target) {
    element = target.nodeType === 1
      ? target
      : (target.parentElement || target.parentNode);
  }

  if (!element || typeof element.closest !== 'function') return false;

  // Stickers (animated Lottie, WebM video stickers, WebP/static) are non-interactive media
  // and must never be blocked by generic video player filters.
  if (element.closest('.sticker-container, .sticker-video, .sticker-animated, .sticker-static')) {
    return false;
  }

  if (typeof customPredicate === 'function') {
    try {
      if (customPredicate(element)) return true;
    } catch {
      /* ignore custom predicate errors */
    }
  }

  const selectorStr = Array.isArray(customSelectors)
    ? customSelectors.join(', ')
    : customSelectors;

  try {
    return Boolean(element.closest(selectorStr));
  } catch {
    // Fallback in case of invalid selector syntax
    return Boolean(element.closest('button, a, input, textarea, select, video, audio, .reaction-badge'));
  }
}

/**
 * Multi-tier safe haptic vibration feedback engine.
 * Dispatches vibration feedback across mobile web, Capacitor hybrid apps, and WebKit bridges.
 * Never throws an error in non-supporting browsers, test runners, or restricted iframes.
 *
 * @param {number | number[]} [pattern=DEFAULT_HAPTIC_HOLD_MS] - Duration in ms or pattern array
 * @returns {boolean} Whether haptics were successfully dispatched
 */
export function triggerHaptic(pattern = DEFAULT_HAPTIC_HOLD_MS) {
  if (typeof window === 'undefined') return false;

  // Tier 1: Web Standard Navigator Vibration API
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      const sanitized = Array.isArray(pattern)
        ? pattern.map(p => Math.max(0, Number(p) || 0))
        : Math.max(0, Number(pattern) || 0);

      const result = navigator.vibrate(sanitized);
      if (result) return true;
    }
  } catch {
    /* ignore vibration permission or battery saver errors */
  }

  // Tier 2: Capacitor Native Haptics Plugin (Android / iOS hybrid container)
  try {
    /** @type {any} */
    const win = window;
    const capacitor = win.Capacitor;
    if (capacitor?.isPluginAvailable?.('Haptics') && capacitor?.Plugins?.Haptics?.vibrate) {
      const duration = Array.isArray(pattern) ? (pattern[0] || 12) : (Number(pattern) || 12);
      capacitor.Plugins.Haptics.vibrate({ duration });
      return true;
    }
  } catch {
    /* ignore Capacitor bridge errors */
  }

  // Tier 3: Native WebKit MessageHandler Fallback
  try {
    /** @type {any} */
    const win = window;
    if (win.webkit?.messageHandlers?.hapticFeedback?.postMessage) {
      const duration = Array.isArray(pattern) ? (pattern[0] || 12) : (Number(pattern) || 12);
      win.webkit.messageHandlers.hapticFeedback.postMessage({ type: 'impact', duration });
      return true;
    }
  } catch {
    /* ignore WebKit messageHandler errors */
  }

  return false;
}

/**
 * Heuristic to detect touchscreens or mobile viewports (<768px or coarse pointer).
 *
 * @returns {boolean}
 */
export function isTouchOrMobileDevice() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (typeof window.innerWidth === 'number' && window.innerWidth < 768) ||
    window.matchMedia?.('(pointer: coarse)')?.matches ||
    window.matchMedia?.('(hover: none)')?.matches ||
    (typeof navigator !== 'undefined' && navigator?.maxTouchPoints != null && navigator.maxTouchPoints > 0)
  );
}

/**
 * @typedef {Object} UseMessageTouchOptions
 * @property {((event: any) => void)} onTrigger - Callback fired when long-press or tap activates
 * @property {boolean} [disabled=false] - Whether gesture detection is disabled
 * @property {number} [holdDurationMs=380] - Milliseconds to hold for long-press trigger
 * @property {number} [moveThresholdPx=10] - Pixel movement threshold for scroll cancellation
 * @property {number} [tapMaxDurationMs=350] - Maximum touch duration for quick tap trigger
 * @property {string[]} [interactiveSelectors=DEFAULT_INTERACTIVE_SELECTORS] - Selectors to exclude from triggers
 * @property {((el: Element) => boolean) | null} [isInteractive=null] - Custom interactive filter predicate
 * @property {boolean} [enableHaptics=true] - Whether to trigger haptic vibration
 * @property {number} [hapticHoldMs=12] - Vibration duration for long-press in ms
 * @property {number} [hapticTapMs=10] - Vibration duration for quick tap in ms
 */

/**
 * @typedef {Object} UseMessageTouchReturn
 * @property {(e: any) => void} onPointerDown - Pointer down event handler
 * @property {(e: any) => void} onPointerMove - Pointer move event handler
 * @property {(e: any) => void} onPointerUp - Pointer up event handler
 * @property {(e: any) => void} onPointerCancel - Pointer cancel event handler
 * @property {(e: any) => void} onTouchStart - Touch start event handler
 * @property {(e: any) => void} onTouchMove - Touch move event handler
 * @property {(e: any) => void} onTouchEnd - Touch end event handler
 * @property {(e: any) => void} onTouchCancel - Touch cancel event handler
 * @property {(e: any) => void} onContextMenu - Context menu event handler
 * @property {(e: any) => void} onClick - Click event handler
 * @property {() => void} clearGesture - Clears active gesture and cancels pending timers
 * @property {() => void} clearLongPress - Alias for clearGesture
 * @property {(e: any) => void} handleBubblePointerDown - Alias for onPointerDown
 * @property {(e: any) => void} handleBubblePointerMove - Alias for onPointerMove
 * @property {(e: any) => void} handleBubblePointerUp - Alias for onPointerUp
 * @property {(target: any) => boolean} isInteractiveTarget - Checks if target is interactive control
 * @property {(pattern?: number | number[]) => boolean} triggerHaptic - Dispatches haptic feedback
 */

/**
 * React hook for mobile touch interactions and gesture discrimination on message bubbles.
 *
 * Implements:
 * 1. Long-press hold (~380ms) and quick tap (<350ms on mobile) detection.
 * 2. 10px Euclidean movement threshold with automatic scroll cancellation.
 * 3. 6-point cleanup lifecycle (unmount, move, cancel, blur, scroll, release).
 * 4. Comprehensive interactive child target filtering (voice player, video controls, links, badges).
 * 5. Multi-tier safe haptics (`navigator.vibrate?.(12)`).
 * 6. Browser context menu and text selection suppression on touch devices.
 *
 * @param {UseMessageTouchOptions} options
 * @returns {UseMessageTouchReturn}
 */
export default function useMessageTouch({
  onTrigger,
  onSwipeReply = null,
  disabled = false,
  holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  moveThresholdPx = DEFAULT_MOVE_THRESHOLD_PX,
  tapMaxDurationMs = DEFAULT_TAP_MAX_DURATION_MS,
  interactiveSelectors = DEFAULT_INTERACTIVE_SELECTORS,
  isInteractive = null,
  enableHaptics = true,
  hapticHoldMs = DEFAULT_HAPTIC_HOLD_MS,
  hapticTapMs = DEFAULT_HAPTIC_TAP_MS
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipedHapticFiredRef = useRef(false);

  /** @type {React.MutableRefObject<any>} */
  const timerRef = useRef(null);
  /** @type {React.MutableRefObject<{ x: number, y: number } | null>} */
  const startCoordRef = useRef(null);
  const startTimeRef = useRef(0);
  const isMovedRef = useRef(false);
  const isTriggeredRef = useRef(false);
  const isTouchActiveRef = useRef(false);
  const lastTouchTimestampRef = useRef(0);

  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;
  const onSwipeReplyRef = useRef(onSwipeReply);
  onSwipeReplyRef.current = onSwipeReply;

  /**
   * 6-Point lifecycle cleanup function:
   * Resets active timers, tracking coordinates, and gesture states.
   */
  const clearGesture = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startCoordRef.current = null;
    startTimeRef.current = 0;
    isMovedRef.current = false;
    isTriggeredRef.current = false;
    isTouchActiveRef.current = false;
    setSwipeOffset(0);
    swipedHapticFiredRef.current = false;
  }, []);

  const checkInteractive = useCallback((target) => {
    return isInteractiveTarget(target, interactiveSelectors, isInteractive);
  }, [interactiveSelectors, isInteractive]);

  /**
   * Handles touchstart / pointerdown on message bubble surface.
   */
  const handlePointerDown = useCallback((event) => {
    if (disabled) return;

    // Discard non-primary mouse buttons on desktop
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    // Multi-touch guard (e.g. pinch-to-zoom): cancel hold immediately
    const native = event.nativeEvent || event;
    if (native.touches && native.touches.length > 1) {
      clearGesture();
      return;
    }

    // Ignore taps on interactive children (audio player, video controls, links, reaction badges)
    if (checkInteractive(event.target)) {
      return;
    }

    clearGesture();

    const coords = extractCoordinates(event);
    if (!coords) return;

    const now = Date.now();
    startCoordRef.current = coords;
    startTimeRef.current = now;
    isMovedRef.current = false;
    isTriggeredRef.current = false;
    swipedHapticFiredRef.current = false;

    const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen' || Boolean(native.touches);
    isTouchActiveRef.current = isTouch;
    if (isTouch) {
      lastTouchTimestampRef.current = now;
    }

    // Start long-press timer (~380ms)
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!isMovedRef.current) {
        isTriggeredRef.current = true;
        if (enableHaptics) {
          triggerHaptic(hapticHoldMs);
        }
        onTriggerRef.current?.(event);
      }
    }, holdDurationMs);
  }, [disabled, checkInteractive, clearGesture, enableHaptics, hapticHoldMs, holdDurationMs]);

  /**
   * Handles touchmove / pointermove with Euclidean distance calculation.
   * Cancels timer if movement exceeds moveThresholdPx (>10px).
   */
  const handlePointerMove = useCallback((event) => {
    if (!startCoordRef.current) return;

    const coords = extractCoordinates(event);
    if (!coords) return;

    const dx = coords.x - startCoordRef.current.x;
    const dy = coords.y - startCoordRef.current.y;
    const distSq = (dx * dx) + (dy * dy);

    if (distSq > moveThresholdPx * moveThresholdPx) {
      isMovedRef.current = true;
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    // Horizontal swipe-to-reply handling on touch devices (Telegram style: swipe left)
    if (onSwipeReplyRef.current && isTouchActiveRef.current && dx < -20 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      const clampedOffset = -Math.min(65, Math.pow(Math.abs(dx), 0.85) * 2.2);
      setSwipeOffset(clampedOffset);

      if (Math.abs(clampedOffset) >= 42 && !swipedHapticFiredRef.current) {
        swipedHapticFiredRef.current = true;
        if (enableHaptics) {
          triggerHaptic(12);
        }
      } else if (Math.abs(clampedOffset) < 42) {
        swipedHapticFiredRef.current = false;
      }
    }
  }, [moveThresholdPx, enableHaptics]);

  /**
   * Handles touchend / pointerup.
   * Evaluates clean tap on mobile touchscreens (<350ms duration).
   */
  const handlePointerUp = useCallback((event) => {
    const startCoord = startCoordRef.current;
    const startTime = startTimeRef.current;
    const isMoved = isMovedRef.current;
    const wasTriggered = isTriggeredRef.current;
    const wasSwiped = swipedHapticFiredRef.current;

    if (wasSwiped && onSwipeReplyRef.current) {
      onSwipeReplyRef.current(event);
    }

    clearGesture();

    if (!startCoord || isMoved || wasTriggered || wasSwiped) return;

    const duration = Date.now() - startTime;

    // Quick tap detection on mobile / touch devices
    if (duration < tapMaxDurationMs && isTouchOrMobileDevice()) {
      if (!checkInteractive(event.target)) {
        if (enableHaptics) {
          triggerHaptic(hapticTapMs);
        }
        onTriggerRef.current?.(event);
      }
    }
  }, [clearGesture, tapMaxDurationMs, checkInteractive, enableHaptics, hapticTapMs]);

  /**
   * Handles contextmenu events.
   * Suppresses native context menu on mobile touch and triggers message action sheet.
   * Preserves desktop right-click menu for mouse users.
   */
  const handleContextMenu = useCallback((event) => {
    if (disabled) return;
    if (checkInteractive(event.target)) return;

    const isTouchDevice = isTouchOrMobileDevice();
    const isRecentTouch = (Date.now() - (lastTouchTimestampRef.current || 0)) < 800;
    const isTouchTrigger = isTouchActiveRef.current || isRecentTouch || isTouchDevice;

    if (isTouchTrigger) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      clearGesture();

      if (enableHaptics) {
        triggerHaptic(hapticHoldMs);
      }
      onTriggerRef.current?.(event);
    }
  }, [disabled, checkInteractive, clearGesture, enableHaptics, hapticHoldMs]);

  /**
   * Handles click event fallback.
   */
  const handleClick = useCallback((event) => {
    if (disabled) return;
    if (checkInteractive(event.target)) return;
  }, [disabled, checkInteractive]);

  /**
   * 6-Point Lifecycle Event Listeners:
   * 1. Window blur (tab switch / app sent to background).
   * 2. Container / document scroll (inertial compositor scrolling).
   * 3. Document visibility change (screen lock).
   * 4. Component unmount.
   */
  useEffect(() => {
    const handleInterruption = () => {
      clearGesture();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        clearGesture();
      }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('blur', handleInterruption);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      document.addEventListener('scroll', handleInterruption, { capture: true, passive: true });
    }

    return () => {
      clearGesture();
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('blur', handleInterruption);
      }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('scroll', handleInterruption, { capture: true });
      }
    };
  }, [clearGesture]);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: clearGesture,
    onTouchStart: handlePointerDown,
    onTouchMove: handlePointerMove,
    onTouchEnd: handlePointerUp,
    onTouchCancel: clearGesture,
    onContextMenu: handleContextMenu,
    onClick: handleClick,
    swipeOffset,
    isSwiping: Boolean(swipeOffset !== 0),
    clearGesture,
    // Drop-in aliases for existing MessageBubble conventions
    clearLongPress: clearGesture,
    handleBubblePointerDown: handlePointerDown,
    handleBubblePointerMove: handlePointerMove,
    handleBubblePointerUp: handlePointerUp,
    isInteractiveTarget: checkInteractive,
    triggerHaptic
  };
}
