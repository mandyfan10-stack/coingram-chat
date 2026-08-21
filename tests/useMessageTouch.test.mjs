import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import useMessageTouch, {
  triggerHaptic,
  isInteractiveTarget,
  extractCoordinates,
  isTouchOrMobileDevice,
  DEFAULT_INTERACTIVE_SELECTORS,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_MOVE_THRESHOLD_PX,
  DEFAULT_TAP_MAX_DURATION_MS,
  DEFAULT_HAPTIC_HOLD_MS,
  DEFAULT_HAPTIC_TAP_MS
} from '../src/hooks/useMessageTouch.js';

// Helper to construct a mock DOM element hierarchy
function createMockElement(tagName, { className = '', attributes = {}, parent = null } = {}) {
  const classList = new Set(className.split(/\s+/).filter(Boolean));
  const el = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    className,
    parentElement: parent,
    parentNode: parent,
    attributes: { ...attributes },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    hasAttribute(name) {
      return name in this.attributes;
    },
    matches(selector) {
      const trimmed = selector.trim();
      const tagWithClassMatch = trimmed.match(/^([a-zA-Z0-9_-]+)?((?:\.[a-zA-Z0-9_-]+)+)$/);
      if (tagWithClassMatch) {
        const [, tag, classes] = tagWithClassMatch;
        if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) {
          return false;
        }
        const requiredClasses = classes.split('.').filter(Boolean);
        return requiredClasses.every(cls => classList.has(cls));
      }
      if (trimmed.startsWith('.')) {
        const requiredClasses = trimmed.split('.').filter(Boolean);
        return requiredClasses.every(cls => classList.has(cls));
      }
      if (trimmed.startsWith('#')) {
        return this.attributes.id === trimmed.slice(1);
      }
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const attrExpr = trimmed.slice(1, -1);
        if (attrExpr.includes('=')) {
          const [key, val] = attrExpr.split('=').map(s => s.replace(/["']/g, '').trim());
          return this.attributes[key] === val;
        }
        return this.hasAttribute(attrExpr);
      }
      return this.tagName.toLowerCase() === trimmed.toLowerCase();
    },
    closest(selectorGroup) {
      const selectors = selectorGroup.split(',').map(s => s.trim());
      let cur = this;
      while (cur && cur.nodeType === 1) {
        for (const sel of selectors) {
          if (cur.matches(sel)) return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    }
  };
  return el;
}

function createMockTextNode(text, parent) {
  return {
    nodeType: 3,
    textContent: text,
    parentElement: parent,
    parentNode: parent
  };
}

/**
 * Lightweight React hook test harness for Node.js test environment.
 */
function renderHook(hookFn, initialProps) {
  const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const refs = [];
  let refIndex = 0;
  const effects = [];
  let cleanups = [];

  const mockDispatcher = {
    useRef: (initial) => {
      if (refIndex >= refs.length) {
        refs.push({ current: initial });
      }
      const ref = refs[refIndex];
      refIndex++;
      return ref;
    },
    useCallback: (fn) => fn,
    useEffect: (effectFn) => {
      effects.push(effectFn);
    },
    useLayoutEffect: (effectFn) => {
      effects.push(effectFn);
    },
    useMemo: (factory) => factory(),
    useState: (initial) => [initial, () => {}]
  };

  let currentProps = initialProps;
  let result = null;

  function run() {
    refIndex = 0;
    const prevDispatcher = internals.H;
    internals.H = mockDispatcher;
    try {
      result = hookFn(currentProps);
    } finally {
      internals.H = prevDispatcher;
    }
  }

  run();
  cleanups = effects.map(eff => eff()).filter(Boolean);

  return {
    get current() {
      return result;
    },
    rerender: (nextProps) => {
      currentProps = nextProps;
      run();
    },
    unmount: () => {
      cleanups.forEach(cleanup => cleanup());
      cleanups = [];
    }
  };
}

test('useMessageTouch exports constants and utility functions', () => {
  assert.equal(typeof useMessageTouch, 'function');
  assert.equal(typeof triggerHaptic, 'function');
  assert.equal(typeof isInteractiveTarget, 'function');
  assert.equal(typeof extractCoordinates, 'function');
  assert.equal(typeof isTouchOrMobileDevice, 'function');

  assert.equal(DEFAULT_HOLD_DURATION_MS, 380);
  assert.equal(DEFAULT_MOVE_THRESHOLD_PX, 10);
  assert.equal(DEFAULT_TAP_MAX_DURATION_MS, 350);
  assert.equal(DEFAULT_HAPTIC_HOLD_MS, 12);
  assert.equal(DEFAULT_HAPTIC_TAP_MS, 10);
  assert(Array.isArray(DEFAULT_INTERACTIVE_SELECTORS));
  assert(DEFAULT_INTERACTIVE_SELECTORS.length > 10);
});

test('isInteractiveTarget correctly filters voice player, video controls, links, badges, and avatars', () => {
  const bubble = createMockElement('div', { className: 'message-bubble' });

  // 1. Voice Note Controls
  const voiceBubble = createMockElement('div', { className: 'voice-player-bubble', parent: bubble });
  const playBtn = createMockElement('button', { className: 'voice-play-btn', parent: voiceBubble });
  const seekBar = createMockElement('input', { className: 'voice-seek-bar', attributes: { type: 'range' }, parent: voiceBubble });
  const progressContainer = createMockElement('div', { className: 'audio-progress-container', parent: voiceBubble });

  assert.equal(isInteractiveTarget(playBtn), true);
  assert.equal(isInteractiveTarget(seekBar), true);
  assert.equal(isInteractiveTarget(voiceBubble), true);
  assert.equal(isInteractiveTarget(progressContainer), true);

  // 2. Video Player Controls
  const regularVideo = createMockElement('div', { className: 'regular-video-wrapper', parent: bubble });
  const centerBtn = createMockElement('button', { className: 'regular-video-center-btn', parent: regularVideo });
  const videoOverlay = createMockElement('div', { className: 'video-player-overlay', parent: regularVideo });
  const roundVideo = createMockElement('div', { className: 'round-video-wrapper', parent: bubble });
  const videoTag = createMockElement('video', { parent: roundVideo });

  assert.equal(isInteractiveTarget(centerBtn), true);
  assert.equal(isInteractiveTarget(videoOverlay), true);
  assert.equal(isInteractiveTarget(roundVideo), true);
  assert.equal(isInteractiveTarget(videoTag), true);

  // 3. Reaction Badges & Drawers
  const reactionContainer = createMockElement('div', { className: 'bubble-reactions', parent: bubble });
  const reactionBadge = createMockElement('button', { className: 'reaction-badge', parent: reactionContainer });
  const reactionItem = createMockElement('span', { className: 'reaction-drawer-item', attributes: { role: 'option' }, parent: bubble });

  assert.equal(isInteractiveTarget(reactionBadge), true);
  assert.equal(isInteractiveTarget(reactionContainer), true);
  assert.equal(isInteractiveTarget(reactionItem), true);

  // 4. Failed message menu
  const failedMenu = createMockElement('div', { className: 'failed-message-menu', parent: bubble });
  const retryBtn = createMockElement('button', { className: 'failed-menu-btn retry', parent: failedMenu });
  const failedIcon = createMockElement('svg', { className: 'seen-check failed', parent: bubble });

  assert.equal(isInteractiveTarget(failedMenu), true);
  assert.equal(isInteractiveTarget(retryBtn), true);
  assert.equal(isInteractiveTarget(failedIcon), true);

  // 5. User Avatar and Sender Name
  const avatar = createMockElement('div', { className: 'message-sender-avatar interactive', parent: bubble });
  const senderName = createMockElement('span', { className: 'sender-name interactive', parent: bubble });

  assert.equal(isInteractiveTarget(avatar), true);
  assert.equal(isInteractiveTarget(senderName), true);

  // 6. Hyperlinks and standard buttons
  const link = createMockElement('a', { attributes: { href: 'https://example.com' }, parent: bubble });
  const plainBtn = createMockElement('button', { parent: bubble });
  const customInteractive = createMockElement('div', { attributes: { 'data-interactive': 'true' }, parent: bubble });

  assert.equal(isInteractiveTarget(link), true);
  assert.equal(isInteractiveTarget(plainBtn), true);
  assert.equal(isInteractiveTarget(customInteractive), true);
});

test('isInteractiveTarget returns false for message body, text paragraphs, and metadata', () => {
  const bubble = createMockElement('div', { className: 'message-bubble bubble-me' });
  const content = createMockElement('div', { className: 'bubble-content', parent: bubble });
  const textP = createMockElement('p', { className: 'message-text', parent: content });
  const textNode = createMockTextNode('Hello world! This is a test message.', textP);
  const metadata = createMockElement('span', { className: 'bubble-metadata', parent: textP });
  const timeSpan = createMockElement('span', { className: 'message-time', parent: metadata });

  assert.equal(isInteractiveTarget(bubble), false);
  assert.equal(isInteractiveTarget(content), false);
  assert.equal(isInteractiveTarget(textP), false);
  assert.equal(isInteractiveTarget(textNode), false);
  assert.equal(isInteractiveTarget(metadata), false);
  assert.equal(isInteractiveTarget(timeSpan), false);
});

test('isInteractiveTarget safely handles edge cases (null, undefined, primitives, custom predicates)', () => {
  assert.equal(isInteractiveTarget(null), false);
  assert.equal(isInteractiveTarget(undefined), false);
  assert.equal(isInteractiveTarget(42), false);
  assert.equal(isInteractiveTarget('button'), false);
  assert.equal(isInteractiveTarget({}), false);

  const customEl = createMockElement('div', { className: 'my-custom-slider' });
  assert.equal(isInteractiveTarget(customEl, ['.my-custom-slider']), true);
  assert.equal(isInteractiveTarget(customEl, DEFAULT_INTERACTIVE_SELECTORS, el => el.className.includes('custom')), true);
});

test('extractCoordinates accurately extracts coordinates from Pointer, Touch, and Mouse events', () => {
  // 1. PointerEvent / MouseEvent
  assert.deepEqual(extractCoordinates({ clientX: 120, clientY: 240 }), { x: 120, y: 240 });
  assert.deepEqual(extractCoordinates({ nativeEvent: { clientX: 50, clientY: 80 } }), { x: 50, y: 80 });

  // 2. TouchEvent with touches
  const touchEvent = {
    touches: [{ clientX: 200, clientY: 400 }],
    changedTouches: []
  };
  assert.deepEqual(extractCoordinates(touchEvent), { x: 200, y: 400 });

  // 3. TouchEvent with changedTouches (touchend)
  const touchEndEvent = {
    touches: [],
    changedTouches: [{ clientX: 300, clientY: 600 }]
  };
  assert.deepEqual(extractCoordinates(touchEndEvent), { x: 300, y: 600 });

  // 4. Invalid / empty events
  assert.equal(extractCoordinates(null), null);
  assert.equal(extractCoordinates(undefined), null);
  assert.equal(extractCoordinates({}), null);
});

test('triggerHaptic operates safely across Web API, Capacitor bridge, and WebKit message handlers', () => {
  const origWindow = globalThis.window;

  try {
    // 1. SSR / Node.js environment (no window)
    delete globalThis.window;
    assert.equal(triggerHaptic(12), false);

    // 2. Browser with navigator.vibrate
    let vibratePattern = null;
    globalThis.window = {};
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: (pattern) => {
        vibratePattern = pattern;
        return true;
      },
      configurable: true
    });
    assert.equal(triggerHaptic(15), true);
    assert.equal(vibratePattern, 15);

    // Pattern array
    assert.equal(triggerHaptic([10, 50, 10]), true);
    assert.deepEqual(vibratePattern, [10, 50, 10]);

    // 3. navigator.vibrate throws SecurityError / NotAllowedError
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: () => {
        throw new Error('NotAllowedError: Permissions policy forbids vibrate');
      },
      configurable: true
    });
    assert.doesNotThrow(() => {
      const result = triggerHaptic(12);
      assert.equal(result, false);
    });

    // 4. Capacitor Haptics plugin fallback
    let capacitorCalled = false;
    delete globalThis.navigator.vibrate;
    globalThis.window = {
      Capacitor: {
        isPluginAvailable(plugin) {
          return plugin === 'Haptics';
        },
        Plugins: {
          Haptics: {
            vibrate({ duration }) {
              capacitorCalled = duration;
            }
          }
        }
      }
    };
    assert.equal(triggerHaptic(20), true);
    assert.equal(capacitorCalled, 20);

    // 5. WebKit messageHandler fallback
    let webkitCalled = false;
    globalThis.window = {
      webkit: {
        messageHandlers: {
          hapticFeedback: {
            postMessage(msg) {
              webkitCalled = msg;
            }
          }
        }
      }
    };
    assert.equal(triggerHaptic(18), true);
    assert.deepEqual(webkitCalled, { type: 'impact', duration: 18 });

    // 6. Non-supporting browser (no vibrate, no capacitor, no webkit)
    globalThis.window = {};
    delete globalThis.navigator.vibrate;
    assert.equal(triggerHaptic(12), false);
  } finally {
    globalThis.window = origWindow;
    delete globalThis.navigator.vibrate;
  }
});

test('isTouchOrMobileDevice identifies mobile viewports and touch coarse pointers', () => {
  const origWindow = globalThis.window;

  try {
    // 1. Mobile screen width (<768px)
    globalThis.window = {
      innerWidth: 375,
      matchMedia: () => ({ matches: false })
    };
    Object.defineProperty(globalThis.navigator, 'maxTouchPoints', { value: 0, configurable: true });
    assert.equal(isTouchOrMobileDevice(), true);

    // 2. Touch coarse pointer on iPad (innerWidth: 1024px)
    globalThis.window = {
      innerWidth: 1024,
      matchMedia: (query) => ({ matches: query.includes('coarse') })
    };
    Object.defineProperty(globalThis.navigator, 'maxTouchPoints', { value: 5, configurable: true });
    assert.equal(isTouchOrMobileDevice(), true);

    // 3. Desktop browser (innerWidth: 1440px, no touch, fine pointer)
    globalThis.window = {
      innerWidth: 1440,
      matchMedia: () => ({ matches: false })
    };
    Object.defineProperty(globalThis.navigator, 'maxTouchPoints', { value: 0, configurable: true });
    assert.equal(isTouchOrMobileDevice(), false);
  } finally {
    globalThis.window = origWindow;
    delete globalThis.navigator.maxTouchPoints;
  }
});

test('useMessageTouch triggers onTrigger on long-press hold (~380ms)', async () => {
  let triggeredEvent = null;
  const hook = renderHook(() =>
    useMessageTouch({
      onTrigger: (e) => {
        triggeredEvent = e;
      },
      holdDurationMs: 50,
      enableHaptics: false
    })
  );

  const mockTarget = createMockElement('div', { className: 'message-bubble' });
  const downEvent = {
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    target: mockTarget
  };

  hook.current.onPointerDown(downEvent);
  assert.equal(triggeredEvent, null, 'Should not trigger immediately on pointerdown');

  // Wait for hold timer to expire
  await new Promise(resolve => setTimeout(resolve, 70));

  assert.notEqual(triggeredEvent, null, 'Should trigger onTrigger after holdDurationMs');
  assert.equal(triggeredEvent.clientX, 100);

  hook.unmount();
});

test('useMessageTouch cancels long-press when movement exceeds moveThresholdPx (>10px)', async () => {
  let triggered = false;
  const hook = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggered = true;
      },
      holdDurationMs: 50,
      moveThresholdPx: 10,
      enableHaptics: false
    })
  );

  const mockTarget = createMockElement('div', { className: 'message-bubble' });
  hook.current.onPointerDown({
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    target: mockTarget
  });

  // Move by 5px (within 10px threshold)
  hook.current.onPointerMove({
    clientX: 104,
    clientY: 103
  });

  // Move by 15px (exceeds 10px threshold -> scroll drag)
  hook.current.onPointerMove({
    clientX: 100,
    clientY: 120
  });

  await new Promise(resolve => setTimeout(resolve, 70));

  assert.equal(triggered, false, 'Movement exceeding threshold must cancel the long-press timer');
  hook.unmount();
});

test('useMessageTouch ignores touches on interactive children (audio, video, links, reaction badges)', async () => {
  let triggered = false;
  const hook = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggered = true;
      },
      holdDurationMs: 50,
      enableHaptics: false
    })
  );

  const bubble = createMockElement('div', { className: 'message-bubble' });
  const playBtn = createMockElement('button', { className: 'voice-play-btn', parent: bubble });

  // PointerDown on play button
  hook.current.onPointerDown({
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    target: playBtn
  });

  await new Promise(resolve => setTimeout(resolve, 70));

  assert.equal(triggered, false, 'Tapping interactive controls must never start hold gesture');
  hook.unmount();
});

test('useMessageTouch triggers quick tap on mobile touchscreens (<350ms release)', async () => {
  const origWindow = globalThis.window;
  try {
    globalThis.window = {
      innerWidth: 375,
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    let triggered = false;
    const hook = renderHook(() =>
      useMessageTouch({
        onTrigger: () => {
          triggered = true;
        },
        holdDurationMs: 380,
        tapMaxDurationMs: 350,
        enableHaptics: false
      })
    );

    const mockTarget = createMockElement('div', { className: 'message-bubble' });
    hook.current.onPointerDown({
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      target: mockTarget
    });

    // Release after 50ms (clean tap)
    await new Promise(resolve => setTimeout(resolve, 50));

    hook.current.onPointerUp({
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      target: mockTarget
    });

    assert.equal(triggered, true, 'Clean tap on touch screen must trigger onTrigger');
    hook.unmount();
  } finally {
    globalThis.window = origWindow;
  }
});

test('useMessageTouch suppresses contextmenu on touch and triggers onTrigger', () => {
  const origWindow = globalThis.window;
  try {
    globalThis.window = {
      innerWidth: 375,
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    let triggered = false;
    let defaultPrevented = false;
    let propagationStopped = false;

    const hook = renderHook(() =>
      useMessageTouch({
        onTrigger: () => {
          triggered = true;
        },
        enableHaptics: false
      })
    );

    const mockTarget = createMockElement('div', { className: 'message-bubble' });
    const contextMenuEvent = {
      pointerType: 'touch',
      target: mockTarget,
      preventDefault: () => {
        defaultPrevented = true;
      },
      stopPropagation: () => {
        propagationStopped = true;
      }
    };

    hook.current.onContextMenu(contextMenuEvent);

    assert.equal(triggered, true, 'Touch contextmenu must trigger action menu');
    assert.equal(defaultPrevented, true, 'Touch contextmenu must call preventDefault()');
    assert.equal(propagationStopped, true, 'Touch contextmenu must call stopPropagation()');
    hook.unmount();
  } finally {
    globalThis.window = origWindow;
  }
});

test('useMessageTouch 6-point cleanup lifecycle terminates active timers', async () => {
  let triggered = false;
  const hook = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggered = true;
      },
      holdDurationMs: 50,
      enableHaptics: false
    })
  );

  const mockTarget = createMockElement('div', { className: 'message-bubble' });

  // 1. Pointer cancel cleanup
  hook.current.onPointerDown({ pointerType: 'touch', clientX: 100, clientY: 100, target: mockTarget });
  hook.current.onPointerCancel();
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(triggered, false, 'onPointerCancel must abort hold timer');

  // 2. Explicit clearGesture cleanup
  hook.current.onPointerDown({ pointerType: 'touch', clientX: 100, clientY: 100, target: mockTarget });
  hook.current.clearGesture();
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(triggered, false, 'clearGesture must abort hold timer');

  hook.unmount();
});
