import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import useMessageTouch, {
  isInteractiveTarget,
  extractCoordinates
} from '../src/hooks/useMessageTouch.js';

// Deep DOM tree element factory supporting arbitrary nesting, SVG elements, text nodes, and closest() traversal
function createMockNode(tagName, { className = '', attributes = {}, parent = null, nodeType = 1, textContent = '' } = {}) {
  const classList = new Set(className.split(/\s+/).filter(Boolean));
  const node = {
    nodeType,
    tagName: tagName ? tagName.toUpperCase() : '',
    className,
    parentElement: parent,
    parentNode: parent,
    attributes: { ...attributes },
    textContent,
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    hasAttribute(name) {
      return name in this.attributes;
    },
    matches(selector) {
      if (this.nodeType !== 1) return false;
      const trimmed = selector.trim();

      // Handle compound tag + classes: e.g. "button.voice-play-btn" or "svg.seen-check.failed"
      const tagWithClassMatch = trimmed.match(/^([a-zA-Z0-9_-]+)?((?:\.[a-zA-Z0-9_-]+)+)$/);
      if (tagWithClassMatch) {
        const [, tag, classes] = tagWithClassMatch;
        if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) {
          return false;
        }
        const requiredClasses = classes.split('.').filter(Boolean);
        return requiredClasses.every(cls => classList.has(cls));
      }

      // Handle simple class selectors: e.g. ".reaction-badge"
      if (trimmed.startsWith('.')) {
        const requiredClasses = trimmed.split('.').filter(Boolean);
        return requiredClasses.every(cls => classList.has(cls));
      }

      // Handle id selectors: e.g. "#btn"
      if (trimmed.startsWith('#')) {
        return this.attributes.id === trimmed.slice(1);
      }

      // Handle attribute selectors: e.g. '[role="button"]', '[data-interactive="true"]'
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const attrExpr = trimmed.slice(1, -1);
        if (attrExpr.includes('=')) {
          const [key, val] = attrExpr.split('=').map(s => s.replace(/["']/g, '').trim());
          return this.attributes[key] === val;
        }
        return this.hasAttribute(attrExpr);
      }

      // Handle tag selectors: e.g. 'button', 'a', 'video', 'audio'
      return this.tagName.toLowerCase() === trimmed.toLowerCase();
    },
    closest(selectorGroup) {
      const selectors = selectorGroup.split(',').map(s => s.trim());
      let cur = this;
      while (cur) {
        if (cur.nodeType === 1) {
          for (const sel of selectors) {
            if (cur.matches(sel)) return cur;
          }
        }
        cur = cur.parentElement || cur.parentNode;
      }
      return null;
    }
  };
  return node;
}

function createTextNode(text, parent) {
  return createMockNode('', { nodeType: 3, textContent: text, parent });
}

// Lightweight React hook runner for testing hooks without a full browser DOM
function renderTestHook(hookFn, initialProps) {
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
      cleanups.forEach(cleanup => {
        try {
          cleanup();
        } catch {
          /* ignore */
        }
      });
      cleanups = [];
    }
  };
}

// -----------------------------------------------------------------------------------------
// SECTION 1: Deep DOM Tree Target Filtering Tests
// -----------------------------------------------------------------------------------------

test('Deep DOM Filtering: 10-level nested SVG path inside Voice Play Button is filtered', () => {
  const root = createMockNode('div', { className: 'chat-container' });
  const list = createMockNode('div', { className: 'message-list', parent: root });
  const row = createMockNode('div', { className: 'message-row message-incoming', parent: list });
  const bubble = createMockNode('div', { className: 'message-bubble bubble-voice', parent: row });
  const voicePlayer = createMockNode('div', { className: 'voice-player-bubble', parent: bubble });
  const playBtn = createMockNode('button', { className: 'voice-play-btn', parent: voicePlayer });
  const svg = createMockNode('svg', { className: 'voice-play-icon', parent: playBtn });
  const g = createMockNode('g', { className: 'icon-group', parent: svg });
  const path = createMockNode('path', { attributes: { d: 'M0 0h24v24H0z' }, parent: g });

  assert.equal(isInteractiveTarget(path), true, 'SVG <path> inside voice play button must be detected as interactive');
  assert.equal(isInteractiveTarget(g), true, 'SVG <g> inside voice play button must be detected as interactive');
  assert.equal(isInteractiveTarget(svg), true, 'SVG <svg> inside voice play button must be detected as interactive');
  assert.equal(isInteractiveTarget(playBtn), true, 'Voice play button must be detected as interactive');
  assert.equal(isInteractiveTarget(voicePlayer), true, 'Voice player container must be detected as interactive');

  // Bubble itself is not interactive (so long press can open action sheet)
  assert.equal(isInteractiveTarget(bubble), false, 'Message bubble itself should not be interactive');
});

test('Deep DOM Filtering: Text node and formatted spans inside Markdown links are filtered', () => {
  const bubble = createMockNode('div', { className: 'message-bubble' });
  const content = createMockNode('div', { className: 'bubble-content', parent: bubble });
  const p = createMockNode('p', { className: 'message-text', parent: content });
  const link = createMockNode('a', { attributes: { href: 'https://coingram.tech' }, className: 'chat-link', parent: p });
  const spanBold = createMockNode('span', { className: 'text-bold', parent: link });
  const textNode = createTextNode('Click here for crypto rewards', spanBold);

  assert.equal(isInteractiveTarget(textNode), true, 'Text node inside link must be filtered out');
  assert.equal(isInteractiveTarget(spanBold), true, 'Formatted span inside link must be filtered out');
  assert.equal(isInteractiveTarget(link), true, 'Anchor tag must be filtered out');

  // Text outside the link
  const normalTextNode = createTextNode('Normal message text before link', p);
  assert.equal(isInteractiveTarget(normalTextNode), false, 'Normal text node in paragraph must NOT be filtered');
  assert.equal(isInteractiveTarget(p), false, 'Paragraph element must NOT be filtered');
});

test('Deep DOM Filtering: Reaction badge components (emoji span, count badge, drawer item) are filtered', () => {
  const bubble = createMockNode('div', { className: 'message-bubble' });
  const reactionsRow = createMockNode('div', { className: 'bubble-reactions', parent: bubble });
  const badgeBtn = createMockNode('button', { className: 'reaction-badge active', parent: reactionsRow });
  const emojiSpan = createMockNode('span', { className: 'reaction-emoji', parent: badgeBtn });
  const emojiText = createTextNode('❤️', emojiSpan);
  const countSpan = createMockNode('span', { className: 'reaction-count', parent: badgeBtn });
  const countText = createTextNode('3', countSpan);

  assert.equal(isInteractiveTarget(emojiText), true, 'Emoji text inside reaction badge must be interactive');
  assert.equal(isInteractiveTarget(emojiSpan), true, 'Emoji span inside reaction badge must be interactive');
  assert.equal(isInteractiveTarget(countText), true, 'Count text inside reaction badge must be interactive');
  assert.equal(isInteractiveTarget(countSpan), true, 'Count span inside reaction badge must be interactive');
  assert.equal(isInteractiveTarget(badgeBtn), true, 'Reaction badge button must be interactive');
  assert.equal(isInteractiveTarget(reactionsRow), true, 'Reaction container must be interactive');
});

test('Deep DOM Filtering: Failed message retry icon (SVG & path) and action menus are filtered', () => {
  const bubble = createMockNode('div', { className: 'message-bubble bubble-me message-failed' });
  const statusWrap = createMockNode('span', { className: 'message-status', parent: bubble });
  const failedSvg = createMockNode('svg', { className: 'seen-check failed', parent: statusWrap });
  const circle = createMockNode('circle', { attributes: { cx: '12', cy: '12', r: '10' }, parent: failedSvg });
  const line = createMockNode('line', { attributes: { x1: '12', y1: '8', x2: '12', y2: '12' }, parent: failedSvg });

  assert.equal(isInteractiveTarget(circle), true, 'Circle inside failed icon must be interactive');
  assert.equal(isInteractiveTarget(line), true, 'Line inside failed icon must be interactive');
  assert.equal(isInteractiveTarget(failedSvg), true, 'Failed SVG icon must be interactive');

  // Failed message popup menu
  const menu = createMockNode('div', { className: 'failed-message-menu', parent: bubble });
  const retryBtn = createMockNode('button', { className: 'failed-menu-btn retry', parent: menu });
  const retryText = createTextNode('Повторить', retryBtn);
  assert.equal(isInteractiveTarget(retryText), true);
  assert.equal(isInteractiveTarget(retryBtn), true);
  assert.equal(isInteractiveTarget(menu), true);
});

test('Deep DOM Filtering: Video controls and audio seeker elements are filtered', () => {
  const bubble = createMockNode('div', { className: 'message-bubble' });
  const videoWrapper = createMockNode('div', { className: 'regular-video-wrapper', parent: bubble });
  const controls = createMockNode('div', { className: 'regular-video-controls', parent: videoWrapper });
  const ctrlBtn = createMockNode('button', { className: 'regular-video-ctrl-btn', parent: controls });
  const seekSlider = createMockNode('input', { className: 'regular-video-seek', attributes: { type: 'range' }, parent: controls });

  assert.equal(isInteractiveTarget(ctrlBtn), true);
  assert.equal(isInteractiveTarget(seekSlider), true);
  assert.equal(isInteractiveTarget(controls), true);
  assert.equal(isInteractiveTarget(videoWrapper), true);
});

test('Deep DOM Filtering: Avatar and sender name with interactive class are filtered, plain are not', () => {
  const bubble = createMockNode('div', { className: 'message-bubble' });
  const interactiveAvatar = createMockNode('div', { className: 'message-sender-avatar interactive', parent: bubble });
  const avatarImg = createMockNode('img', { className: 'avatar-img', parent: interactiveAvatar });
  const interactiveName = createMockNode('span', { className: 'sender-name interactive', parent: bubble });

  assert.equal(isInteractiveTarget(avatarImg), true);
  assert.equal(isInteractiveTarget(interactiveAvatar), true);
  assert.equal(isInteractiveTarget(interactiveName), true);

  // Plain timestamp or message info
  const timeSpan = createMockNode('span', { className: 'message-time', parent: bubble });
  const timeText = createTextNode('14:32', timeSpan);
  assert.equal(isInteractiveTarget(timeText), false);
  assert.equal(isInteractiveTarget(timeSpan), false);
});

// -----------------------------------------------------------------------------------------
// SECTION 2: Touchmove & Movement Cancellation Across Various Touch Events
// -----------------------------------------------------------------------------------------

test('Touchmove Cancellation: Sub-threshold movement (<= 10px Euclidean distance) DOES NOT cancel long-press', async () => {
  let triggered = false;
  const hook = renderTestHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggered = true;
      },
      holdDurationMs: 60,
      moveThresholdPx: 10,
      enableHaptics: false
    })
  );

  const bubble = createMockNode('div', { className: 'message-bubble' });

  // 1. Touch start at (100, 100)
  hook.current.onTouchStart({
    touches: [{ clientX: 100, clientY: 100 }],
    target: bubble
  });

  // 2. Micro-jitter: 6px X, 8px Y (Euclidean distance = sqrt(36 + 64) = 10.0px == 10px -> threshold is 10px, distSq = 100 not > 100)
  hook.current.onTouchMove({
    touches: [{ clientX: 106, clientY: 108 }]
  });

  await new Promise(r => setTimeout(r, 80));

  assert.equal(triggered, true, 'Sub-threshold finger tremor must not cancel long-press trigger');
  hook.unmount();
});

test('Touchmove Cancellation: Supra-threshold movement (> 10px) cancels long-press in all 4 quadrants', async () => {
  const quadrants = [
    { name: 'Quadrant I (+X, +Y)', dx: 9, dy: 9 }, // distSq = 81 + 81 = 162 > 100
    { name: 'Quadrant II (-X, +Y)', dx: -12, dy: 5 }, // distSq = 144 + 25 = 169 > 100
    { name: 'Quadrant III (-X, -Y)', dx: -8, dy: -8 }, // distSq = 64 + 64 = 128 > 100
    { name: 'Quadrant IV (+X, -Y)', dx: 11, dy: -4 } // distSq = 121 + 16 = 137 > 100
  ];

  for (const quad of quadrants) {
    let triggered = false;
    const hook = renderTestHook(() =>
      useMessageTouch({
        onTrigger: () => {
          triggered = true;
        },
        holdDurationMs: 60,
        moveThresholdPx: 10,
        enableHaptics: false
      })
    );

    const bubble = createMockNode('div', { className: 'message-bubble' });

    hook.current.onTouchStart({
      touches: [{ clientX: 200, clientY: 200 }],
      target: bubble
    });

    hook.current.onTouchMove({
      touches: [{ clientX: 200 + quad.dx, clientY: 200 + quad.dy }]
    });

    await new Promise(r => setTimeout(r, 80));

    assert.equal(triggered, false, `Movement exceeding 10px in ${quad.name} must cancel long-press`);
    hook.unmount();
  }
});

test('Touchmove Cancellation: Native TouchEvent vs PointerEvent coordinate extraction', () => {
  // 1. TouchEvent with touches array
  const touchStartEvt = { touches: [{ clientX: 150, clientY: 250 }] };
  assert.deepEqual(extractCoordinates(touchStartEvt), { x: 150, y: 250 });

  // 2. TouchEvent with changedTouches array (e.g. touchend)
  const touchEndEvt = { touches: [], changedTouches: [{ clientX: 180, clientY: 290 }] };
  assert.deepEqual(extractCoordinates(touchEndEvt), { x: 180, y: 290 });

  // 3. React SyntheticEvent wrapping nativeEvent
  const syntheticEvt = {
    nativeEvent: {
      touches: [{ clientX: 55, clientY: 77 }]
    }
  };
  assert.deepEqual(extractCoordinates(syntheticEvt), { x: 55, y: 77 });

  // 4. PointerEvent / MouseEvent
  const pointerEvt = { clientX: 320, clientY: 480, pointerType: 'touch' };
  assert.deepEqual(extractCoordinates(pointerEvt), { x: 320, y: 480 });
});

test('Multi-touch pinch / multi-finger gesture immediately cancels long-press', async () => {
  let triggered = false;
  const hook = renderTestHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggered = true;
      },
      holdDurationMs: 60,
      enableHaptics: false
    })
  );

  const bubble = createMockNode('div', { className: 'message-bubble' });

  // Single finger touch down
  hook.current.onTouchStart({
    touches: [{ clientX: 100, clientY: 100 }],
    target: bubble
  });

  // Second finger down (e.g. user starts zoom pinch or multi-touch scroll)
  hook.current.onTouchStart({
    touches: [
      { clientX: 100, clientY: 100 },
      { clientX: 180, clientY: 220 }
    ],
    target: bubble
  });

  await new Promise(r => setTimeout(r, 80));

  assert.equal(triggered, false, 'Multi-touch gesture must immediately cancel long-press timer');
  hook.unmount();
});

test('Touchmove Cancellation: Rapid oscillating movement does not revive cancelled timer', async () => {
  let triggered = false;
  const hook = renderTestHook(() =>
    useMessageTouch({
      onTrigger: () => {
        triggered = true;
      },
      holdDurationMs: 80,
      moveThresholdPx: 10,
      enableHaptics: false
    })
  );

  const bubble = createMockNode('div', { className: 'message-bubble' });

  hook.current.onTouchStart({
    touches: [{ clientX: 100, clientY: 100 }],
    target: bubble
  });

  // Move far away (>10px) -> cancels
  hook.current.onTouchMove({
    touches: [{ clientX: 130, clientY: 130 }]
  });

  // Move back to initial (100, 100) -> isMovedRef should remain true, not revive!
  hook.current.onTouchMove({
    touches: [{ clientX: 100, clientY: 100 }]
  });

  await new Promise(r => setTimeout(r, 100));

  assert.equal(triggered, false, 'Returning back to origin must not resurrect a cancelled gesture');
  hook.unmount();
});

test('Interruption Lifecycle: TouchCancel, Window Blur, and Document Scroll immediately abort hold', async () => {
  // 1. TouchCancel test
  {
    let triggered = false;
    const hook = renderTestHook(() =>
      useMessageTouch({
        onTrigger: () => {
          triggered = true;
        },
        holdDurationMs: 60,
        enableHaptics: false
      })
    );
    const bubble = createMockNode('div', { className: 'message-bubble' });
    hook.current.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }],
      target: bubble
    });
    hook.current.onTouchCancel();
    await new Promise(r => setTimeout(r, 80));
    assert.equal(triggered, false, 'onTouchCancel must abort hold timer');
    hook.unmount();
  }

  // 2. Global clearGesture invocation
  {
    let triggered = false;
    const hook = renderTestHook(() =>
      useMessageTouch({
        onTrigger: () => {
          triggered = true;
        },
        holdDurationMs: 60,
        enableHaptics: false
      })
    );
    const bubble = createMockNode('div', { className: 'message-bubble' });
    hook.current.onPointerDown({
      clientX: 100,
      clientY: 100,
      target: bubble
    });
    hook.current.clearGesture();
    await new Promise(r => setTimeout(r, 80));
    assert.equal(triggered, false, 'clearGesture must abort hold timer');
    hook.unmount();
  }
});

test('Quick Tap on Mobile vs Long Press Discrimination', async () => {
  const origWindow = globalThis.window;
  try {
    globalThis.window = {
      innerWidth: 375,
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    let triggerCount = 0;
    const hook = renderTestHook(() =>
      useMessageTouch({
        onTrigger: () => {
          triggerCount++;
        },
        holdDurationMs: 100,
        tapMaxDurationMs: 80,
        moveThresholdPx: 10,
        enableHaptics: false
      })
    );

    const bubble = createMockNode('div', { className: 'message-bubble' });

    // Case A: Clean quick tap (down at 0ms, up at 30ms -> duration < 80ms)
    hook.current.onPointerDown({
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      target: bubble
    });
    await new Promise(r => setTimeout(r, 30));
    hook.current.onPointerUp({
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      target: bubble
    });

    assert.equal(triggerCount, 1, 'Quick tap on mobile must trigger onTrigger exactly once');

    // Wait past hold duration to verify hold timer was cleaned up and does not double trigger
    await new Promise(r => setTimeout(r, 120));
    assert.equal(triggerCount, 1, 'Hold timer must have been cleared by pointerUp');

    // Case B: Tap with movement > 10px -> must NOT trigger on release
    hook.current.onPointerDown({
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      target: bubble
    });
    hook.current.onPointerMove({
      clientX: 125,
      clientY: 125
    });
    await new Promise(r => setTimeout(r, 30));
    hook.current.onPointerUp({
      pointerType: 'touch',
      clientX: 125,
      clientY: 125,
      target: bubble
    });
    assert.equal(triggerCount, 1, 'Tap with movement must not trigger action sheet');

    hook.unmount();
  } finally {
    globalThis.window = origWindow;
  }
});
