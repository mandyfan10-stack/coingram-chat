import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import useMessageTouch, {
  triggerHaptic,
  isInteractiveTarget,
  extractCoordinates,
  DEFAULT_INTERACTIVE_SELECTORS
} from '../src/hooks/useMessageTouch.js';

// DOM mock helper
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

// React Hook testing harness
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

test('EMPIRICAL ADVERSARIAL: Multi-touch gesture isolation (pinch/multi-finger aborts hold)', async () => {
  let triggerCount = 0;
  const hook = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggerCount++;
      },
      holdDurationMs: 40,
      enableHaptics: false
    })
  );

  const bubble = createMockElement('div', { className: 'message-bubble' });

  // Scenario 1: Initial touch is multi-touch (e.g. 2 fingers down)
  hook.current.onTouchStart({
    pointerType: 'touch',
    nativeEvent: {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 150, clientY: 150 }
      ]
    },
    target: bubble
  });

  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(triggerCount, 0, 'Multi-touch start must abort gesture immediately');

  // Scenario 2: Single touch start, then multi-touch arrives before hold completes
  hook.current.onTouchStart({
    pointerType: 'touch',
    nativeEvent: {
      touches: [{ clientX: 100, clientY: 100 }]
    },
    target: bubble
  });

  // Second finger lands 20ms later
  await new Promise(resolve => setTimeout(resolve, 20));
  hook.current.onTouchStart({
    pointerType: 'touch',
    nativeEvent: {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 }
      ]
    },
    target: bubble
  });

  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(triggerCount, 0, 'Multi-touch incoming event must cancel pending hold timer');

  hook.unmount();
});

test('EMPIRICAL ADVERSARIAL: Rapid churn stress test (100 rapid touchstart/touchend cycles)', async () => {
  let triggerCount = 0;
  const hook = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggerCount++;
      },
      holdDurationMs: 40,
      tapMaxDurationMs: 20,
      enableHaptics: false
    })
  );

  const bubble = createMockElement('div', { className: 'message-bubble' });

  // Run 100 rapid events without delay
  for (let i = 0; i < 100; i++) {
    hook.current.onTouchStart({
      pointerType: 'touch',
      clientX: 50 + (i % 10),
      clientY: 50 + (i % 10),
      target: bubble,
      nativeEvent: { touches: [{ clientX: 50, clientY: 50 }] }
    });

    if (i % 3 === 0) {
      hook.current.onTouchCancel();
    } else if (i % 3 === 1) {
      hook.current.clearGesture();
    } else {
      hook.current.onTouchEnd({
        pointerType: 'touch',
        clientX: 50,
        clientY: 50,
        target: bubble
      });
    }
  }

  // Wait to confirm no orphaned timers fire
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(triggerCount <= 100, true);
  hook.unmount();
});

test('EMPIRICAL ADVERSARIAL: Exact Euclidean movement boundary precision (9.99px vs 10.01px)', async () => {
  const moveThreshold = 10;

  // Test 1: Sub-pixel movement at 9.99px (dx=7.064, dy=7.064 -> sqrt(49.9 + 49.9) = 9.9899px <= 10px) -> SHOULD TRIGGER
  let triggerSubPixel = false;
  const hook1 = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggerSubPixel = true;
      },
      holdDurationMs: 40,
      moveThresholdPx: moveThreshold,
      enableHaptics: false
    })
  );
  const bubble1 = createMockElement('div', { className: 'message-bubble' });
  hook1.current.onPointerDown({
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    target: bubble1
  });
  hook1.current.onPointerMove({
    clientX: 107.064,
    clientY: 107.064
  });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(triggerSubPixel, true, 'Sub-pixel movement under 10px must NOT cancel long-press');
  hook1.unmount();

  // Test 2: Movement exceeding 10px (dx=7.08, dy=7.08 -> sqrt(50.126 + 50.126) = 10.012px > 10px) -> MUST CANCEL
  let triggerExceed = false;
  const hook2 = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggerExceed = true;
      },
      holdDurationMs: 40,
      moveThresholdPx: moveThreshold,
      enableHaptics: false
    })
  );
  const bubble2 = createMockElement('div', { className: 'message-bubble' });
  hook2.current.onPointerDown({
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    target: bubble2
  });
  hook2.current.onPointerMove({
    clientX: 107.08,
    clientY: 107.08
  });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(triggerExceed, false, 'Movement exceeding 10px Euclidean distance must cancel long-press');
  hook2.unmount();

  // Test 3: Negative directional movement (-6.1px, -8.1px -> sqrt(37.21 + 65.61) = 10.14px > 10px)
  let triggerNegative = false;
  const hook3 = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggerNegative = true;
      },
      holdDurationMs: 40,
      moveThresholdPx: moveThreshold,
      enableHaptics: false
    })
  );
  const bubble3 = createMockElement('div', { className: 'message-bubble' });
  hook3.current.onPointerDown({
    pointerType: 'touch',
    clientX: 200,
    clientY: 200,
    target: bubble3
  });
  hook3.current.onPointerMove({
    clientX: 193.9,
    clientY: 191.9
  });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(triggerNegative, false, 'Negative delta exceeding 10px must cancel long-press');
  hook3.unmount();
});

test('EMPIRICAL ADVERSARIAL: Unmount mid-timer prevents memory leaks and state updates', async () => {
  let triggeredAfterUnmount = false;
  const hook = renderHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggeredAfterUnmount = true;
      },
      holdDurationMs: 50,
      enableHaptics: false
    })
  );

  const bubble = createMockElement('div', { className: 'message-bubble' });
  hook.current.onPointerDown({
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    target: bubble
  });

  // Unmount 20ms into the 50ms hold duration
  await new Promise(resolve => setTimeout(resolve, 20));
  hook.unmount();

  // Wait for original timer to have elapsed
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(triggeredAfterUnmount, false, 'Callback must never fire after component unmount');
});

test('EMPIRICAL ADVERSARIAL: Global window blur, visibility change, and scroll interception', async () => {
  const registeredListeners = new Map();
  const origWindow = globalThis.window;
  const origDoc = globalThis.document;

  try {
    globalThis.window = {
      addEventListener(type, handler) {
        registeredListeners.set(`window:${type}`, handler);
      },
      removeEventListener(type) {
        registeredListeners.delete(`window:${type}`);
      }
    };
    globalThis.document = {
      hidden: false,
      addEventListener(type, handler) {
        registeredListeners.set(`doc:${type}`, handler);
      },
      removeEventListener(type) {
        registeredListeners.delete(`doc:${type}`);
      }
    };

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

    // 1. Test Window Blur abort
    hook.current.onPointerDown({ pointerType: 'touch', clientX: 100, clientY: 100, target: bubble });
    registeredListeners.get('window:blur')?.();
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(triggered, false, 'Window blur must cancel pending touch gesture');

    // 2. Test Document Visibility Change abort
    triggered = false;
    hook.current.onPointerDown({ pointerType: 'touch', clientX: 100, clientY: 100, target: bubble });
    globalThis.document.hidden = true;
    registeredListeners.get('doc:visibilitychange')?.();
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(triggered, false, 'Document hidden state change must cancel pending touch gesture');

    // 3. Test Scroll capture abort
    triggered = false;
    hook.current.onPointerDown({ pointerType: 'touch', clientX: 100, clientY: 100, target: bubble });
    registeredListeners.get('doc:scroll')?.();
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(triggered, false, 'Document scroll event must cancel pending touch gesture');

    hook.unmount();
  } finally {
    globalThis.window = origWindow;
    globalThis.document = origDoc;
  }
});

test('EMPIRICAL ADVERSARIAL: Malicious / throwing navigator.vibrate, Capacitor, and WebKit bridges', () => {
  const origWindow = globalThis.window;

  try {
    // 1. navigator.vibrate throws custom error
    globalThis.window = {};
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: () => {
        throw new Error('Vibration permission denied by user agent');
      },
      configurable: true
    });

    assert.doesNotThrow(() => {
      const result = triggerHaptic(12);
      assert.equal(result, false);
    });

    // 2. navigator.vibrate receives weird values (NaN, negative, symbols, infinite)
    let passedPattern = null;
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: (pattern) => {
        passedPattern = pattern;
        return true;
      },
      configurable: true
    });

    triggerHaptic(-100);
    assert.equal(passedPattern, 0, 'Negative duration must clamp to 0');

    triggerHaptic(NaN);
    assert.equal(passedPattern, 0, 'NaN duration must clamp to 0');

    triggerHaptic(['abc', -50, null, undefined]);
    assert.deepEqual(passedPattern, [0, 0, 0, 0], 'Array of invalid values must sanitize to [0, 0, 0, 0]');

    // 3. Capacitor throwing in vibrate
    delete globalThis.navigator.vibrate;
    globalThis.window = {
      Capacitor: {
        isPluginAvailable: () => true,
        Plugins: {
          Haptics: {
            vibrate: () => {
              throw new Error('Capacitor IPC bridge crashed');
            }
          }
        }
      }
    };
    assert.doesNotThrow(() => {
      const result = triggerHaptic(12);
      assert.equal(result, false);
    });

    // 4. WebKit throwing in postMessage
    globalThis.window = {
      webkit: {
        messageHandlers: {
          hapticFeedback: {
            postMessage: () => {
              throw new Error('WebKit postMessage failed');
            }
          }
        }
      }
    };
    assert.doesNotThrow(() => {
      const result = triggerHaptic(12);
      assert.equal(result, false);
    });
  } finally {
    globalThis.window = origWindow;
    delete globalThis.navigator.vibrate;
  }
});

test('EMPIRICAL ADVERSARIAL: Deeply nested and unusual interactive DOM targets', () => {
  const bubble = createMockElement('div', { className: 'message-bubble' });

  // 1. Nested span inside button inside custom component
  const btn = createMockElement('button', { className: 'voice-play-btn', parent: bubble });
  const iconSpan = createMockElement('span', { className: 'icon-inner', parent: btn });
  const svgPath = createMockElement('path', { parent: iconSpan });

  assert.equal(isInteractiveTarget(svgPath), true);
  assert.equal(isInteractiveTarget(iconSpan), true);

  // 2. Custom interactive predicate throwing error
  const brokenPredicate = () => {
    throw new Error('Predicate runtime exception');
  };
  const normalText = createMockElement('p', { className: 'message-text', parent: bubble });
  assert.doesNotThrow(() => {
    const isTarget = isInteractiveTarget(normalText, DEFAULT_INTERACTIVE_SELECTORS, brokenPredicate);
    assert.equal(isTarget, false);
  });

  // 3. Node without closest method (mock bare object)
  assert.equal(isInteractiveTarget({ nodeType: 1 }), false);
  assert.equal(isInteractiveTarget({ foo: 'bar' }), false);
});

test('EMPIRICAL ADVERSARIAL: Desktop mouse coexistence (right-click preservation & non-primary click)', async () => {
  const origWindow = globalThis.window;
  try {
    // Desktop environment: 1440px, no touch
    globalThis.window = {
      innerWidth: 1440,
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    Object.defineProperty(globalThis.navigator, 'maxTouchPoints', { value: 0, configurable: true });

    let triggerCount = 0;
    let defaultPrevented = false;

    const hook = renderHook(() =>
      useMessageTouch({
        onTrigger: () => {
          triggerCount++;
        },
        holdDurationMs: 40,
        enableHaptics: false
      })
    );

    const bubble = createMockElement('div', { className: 'message-bubble' });

    // 1. Secondary mouse click (right click pointerdown)
    hook.current.onPointerDown({
      pointerType: 'mouse',
      button: 2,
      clientX: 200,
      clientY: 200,
      target: bubble
    });
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(triggerCount, 0, 'Secondary mouse click (button: 2) must NOT start long-press');

    // 2. Middle mouse click (button: 1)
    hook.current.onPointerDown({
      pointerType: 'mouse',
      button: 1,
      clientX: 200,
      clientY: 200,
      target: bubble
    });
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(triggerCount, 0, 'Middle mouse click (button: 1) must NOT start long-press');

    // 3. Native desktop right-click contextmenu event
    hook.current.onContextMenu({
      pointerType: 'mouse',
      target: bubble,
      preventDefault: () => {
        defaultPrevented = true;
      },
      stopPropagation: () => {}
    });

    assert.equal(triggerCount, 0, 'Desktop mouse contextmenu must NOT trigger mobile action sheet');
    assert.equal(defaultPrevented, false, 'Desktop mouse contextmenu must NOT prevent native context menu');

    hook.unmount();
  } finally {
    globalThis.window = origWindow;
    delete globalThis.navigator.maxTouchPoints;
  }
});

test('EMPIRICAL ADVERSARIAL: Double-trigger protection (long-press hold already triggered prevents tap on release)', async () => {
  const origWindow = globalThis.window;
  try {
    globalThis.window = {
      innerWidth: 375,
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    let triggerCount = 0;
    const hook = renderHook(() =>
      useMessageTouch({
        onTrigger: () => {
          triggerCount++;
        },
        holdDurationMs: 40,
        tapMaxDurationMs: 350,
        enableHaptics: false
      })
    );

    const bubble = createMockElement('div', { className: 'message-bubble' });

    // Touch down
    hook.current.onTouchStart({
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      target: bubble,
      nativeEvent: { touches: [{ clientX: 100, clientY: 100 }] }
    });

    // Wait 60ms so hold fires
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(triggerCount, 1, 'Long-press hold should fire once at 40ms');

    // Now user releases finger (touchend) at 80ms
    hook.current.onTouchEnd({
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      target: bubble,
      nativeEvent: { changedTouches: [{ clientX: 100, clientY: 100 }] }
    });

    assert.equal(triggerCount, 1, 'Release after hold trigger must NOT fire onTrigger a second time');

    hook.unmount();
  } finally {
    globalThis.window = origWindow;
  }
});

test('EMPIRICAL ADVERSARIAL: Dynamic disabled prop toggling mid-gesture', async () => {
  let triggerCount = 0;

  const hook = renderHook(
    (props) =>
      useMessageTouch({
        onTrigger: () => {
          triggerCount++;
        },
        holdDurationMs: 50,
        disabled: props.disabled,
        enableHaptics: false
      }),
    { disabled: false }
  );

  const bubble = createMockElement('div', { className: 'message-bubble' });

  // Touch down while enabled
  hook.current.onTouchStart({
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    target: bubble,
    nativeEvent: { touches: [{ clientX: 100, clientY: 100 }] }
  });

  // Switch disabled to true mid-gesture at 20ms
  await new Promise(resolve => setTimeout(resolve, 20));
  hook.rerender({ disabled: true });

  // Disable handler calls
  hook.current.onTouchStart({
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    target: bubble
  });

  hook.unmount();
});

test('EMPIRICAL ADVERSARIAL: Robust coordinate extraction with malformed/unusual events', () => {
  assert.equal(extractCoordinates(null), null);
  assert.equal(extractCoordinates(undefined), null);
  assert.equal(extractCoordinates(42), null);
  assert.equal(extractCoordinates('string'), null);
  assert.equal(extractCoordinates({}), null);
  assert.equal(extractCoordinates({ touches: [] }), null);
  assert.equal(extractCoordinates({ touches: [], changedTouches: [] }), null);
  assert.equal(extractCoordinates({ nativeEvent: {} }), null);

  // Synthetic React event with clientX: 0, clientY: 0 (valid coordinates)
  assert.deepEqual(extractCoordinates({ clientX: 0, clientY: 0 }), { x: 0, y: 0 });
});
