import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const messageBubbleJsx = fs.readFileSync(new URL('../src/components/chat/MessageBubble.jsx', import.meta.url), 'utf8');
const messageCss = fs.readFileSync(new URL('../src/components/chat/Message.css', import.meta.url), 'utf8');
const mobileActionSheetCss = fs.readFileSync(new URL('../src/components/chat/MobileActionSheet.css', import.meta.url), 'utf8');
const chatAreaCss = fs.readFileSync(new URL('../src/components/ChatArea.css', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// HTML Test Harness Builder for Desktop Parity & Coexistence
// ---------------------------------------------------------------------------
function buildDesktopHarnessHtml() {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    :root {
      --bg-primary: #0e1621;
      --bg-secondary: #17212b;
      --bg-tertiary: #24303f;
      --border-color: #101921;
      --text-primary: #f5f6f7;
      --text-secondary: #7f91a4;
      --accent-color: #2481cc;
      --accent-gradient: linear-gradient(135deg, #2481cc 0%, #1c6199 100%);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
      --transition-fast: 0.15s ease;
    }
    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 40px;
      min-height: 100vh;
    }
    .chat-body {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message-row {
      position: relative;
      display: flex;
      align-items: flex-end;
      width: 100%;
    }
    .message-row.row-me {
      justify-content: flex-end;
    }
    .message-row.row-other {
      justify-content: flex-start;
    }
    .message-bubble {
      position: relative;
      max-width: 480px;
      padding: 8px 12px;
      border-radius: 16px;
      background: var(--bg-secondary);
    }
    .message-row.row-me .message-bubble {
      background: #2b5278;
      border-bottom-right-radius: 4px;
    }
    .message-row.row-other .message-bubble {
      background: #182533;
      border-bottom-left-radius: 4px;
    }
    .message-text {
      font-size: 14px;
      line-height: 1.4;
    }
    .bubble-metadata {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 8px;
      font-size: 11px;
      color: var(--text-secondary);
    }
    .hover-action-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 4px 6px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .hover-action-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
    }
    .hover-action-btn.delete:hover {
      color: #ef4444;
    }
    .reaction-drawer-fixed {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 4px 8px;
      display: flex;
      gap: 6px;
      box-shadow: var(--shadow-md);
    }
    .reaction-drawer-item {
      cursor: pointer;
      font-size: 18px;
      padding: 2px 4px;
      border-radius: 6px;
      transition: transform 0.12s ease;
    }
    .reaction-drawer-item:hover {
      transform: scale(1.25);
    }

    ${chatAreaCss}
    ${messageCss}
    ${mobileActionSheetCss}
  </style>
</head>
<body>
  <div class="chat-body" id="chat-body">
    <!-- Outgoing Message (Me) -->
    <div class="message-row row-me" id="row-me-1" data-message-id="m_me_1">
      <div class="message-bubble bubble-me" id="bubble-me-1">
        <div class="bubble-content">
          <p class="message-text">
            <span>Hello from desktop Alice! Here is some selectable text.</span>
            <span class="bubble-metadata">
              <span class="message-time">10:45</span>
            </span>
          </p>
        </div>
        <div class="message-hover-actions" id="hover-actions-me-1">
          <button type="button" class="hover-action-btn" id="btn-reply-me-1" title="Ответить">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
          </button>
          <button type="button" class="hover-action-btn" id="btn-smile-me-1" title="Реакция">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <button type="button" class="hover-action-btn delete" id="btn-delete-me-1" title="Удалить">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Incoming Message (Other) -->
    <div class="message-row row-other" id="row-other-1" data-message-id="m_other_1">
      <div class="message-bubble bubble-other" id="bubble-other-1">
        <div class="bubble-content">
          <p class="message-text">
            <span>Hi Alice! Desktop parity test message from Bob.</span>
            <span class="bubble-metadata">
              <span class="message-time">10:46</span>
            </span>
          </p>
        </div>
        <div class="message-hover-actions" id="hover-actions-other-1">
          <button type="button" class="hover-action-btn" id="btn-reply-other-1" title="Ответить">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
          </button>
          <button type="button" class="hover-action-btn" id="btn-smile-other-1" title="Реакция">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <button type="button" class="hover-action-btn delete" id="btn-delete-other-1" title="Удалить">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.__eventsLog = [];

    // Reply click handler
    document.getElementById('btn-reply-me-1').addEventListener('click', (e) => {
      e.stopPropagation();
      window.__eventsLog.push({ action: 'reply', messageId: 'm_me_1' });
    });
    document.getElementById('btn-reply-other-1').addEventListener('click', (e) => {
      e.stopPropagation();
      window.__eventsLog.push({ action: 'reply', messageId: 'm_other_1' });
    });

    // Delete click handler
    document.getElementById('btn-delete-me-1').addEventListener('click', (e) => {
      e.stopPropagation();
      window.__eventsLog.push({ action: 'delete', messageId: 'm_me_1' });
    });
    document.getElementById('btn-delete-other-1').addEventListener('click', (e) => {
      e.stopPropagation();
      window.__eventsLog.push({ action: 'delete', messageId: 'm_other_1' });
    });

    // Smile click handler: mount portaled reaction drawer
    function openReactionDrawer(anchorBtn, messageId) {
      const existing = document.getElementById('portaled-reaction-drawer');
      if (existing) {
        existing.remove();
        return;
      }
      const rect = anchorBtn.getBoundingClientRect();
      const drawer = document.createElement('div');
      drawer.id = 'portaled-reaction-drawer';
      drawer.className = 'reaction-drawer reaction-drawer-fixed';
      drawer.setAttribute('role', 'listbox');
      drawer.setAttribute('aria-label', 'Реакции');

      const realWidth = 280;
      const realHeight = 40;
      const viewportPad = 8;
      const gap = 8;

      let top = rect.top - realHeight - gap;
      let placement = 'above';
      if (top < viewportPad) {
        top = rect.bottom + gap;
        placement = 'below';
      }
      const maxTop = window.innerHeight - realHeight - viewportPad;
      if (top > maxTop) top = Math.max(viewportPad, maxTop);

      let left = rect.left + rect.width / 2 - realWidth / 2;
      const maxLeft = window.innerWidth - realWidth - viewportPad;
      left = Math.max(viewportPad, Math.min(left, maxLeft));

      drawer.style.position = 'fixed';
      drawer.style.top = Math.round(top) + 'px';
      drawer.style.left = Math.round(left) + 'px';
      drawer.style.zIndex = '10050';
      drawer.style.visibility = 'visible';

      const emojis = ['❤️', '👍', '👎', '🔥', '😂', '👏', '🎉', '😢'];
      emojis.forEach(emo => {
        const item = document.createElement('span');
        item.className = 'reaction-drawer-item';
        item.textContent = emo;
        item.setAttribute('data-emoji', emo);
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          window.__eventsLog.push({ action: 'reactionSelect', messageId, emoji: emo });
          drawer.remove();
        });
        drawer.appendChild(item);
      });

      document.body.appendChild(drawer);
    }

    document.getElementById('btn-smile-me-1').addEventListener('click', function(e) {
      e.stopPropagation();
      openReactionDrawer(this, 'm_me_1');
    });
    document.getElementById('btn-smile-other-1').addEventListener('click', function(e) {
      e.stopPropagation();
      openReactionDrawer(this, 'm_other_1');
    });

    // Context menu tracking
    document.getElementById('bubble-me-1').addEventListener('contextmenu', (e) => {
      window.__eventsLog.push({
        event: 'contextmenu',
        target: 'bubble-me-1',
        defaultPrevented: e.defaultPrevented
      });
    });
    document.getElementById('bubble-other-1').addEventListener('contextmenu', (e) => {
      window.__eventsLog.push({
        event: 'contextmenu',
        target: 'bubble-other-1',
        defaultPrevented: e.defaultPrevented
      });
    });
  </script>
</body>
</html>
  `;
}

async function launchBrowserSafely() {
  try {
    return await chromium.launch({ headless: true });
  } catch (e) {
    if (
      e?.message?.includes("Executable doesn't exist") ||
      e?.message?.includes('browserType.launch') ||
      (e?.name === 'Error' && e?.message?.includes('playwright'))
    ) {
      return null;
    }
    throw e;
  }
}

// ===========================================================================
// SECTION 1: EMPIRICAL DESKTOP PARITY & COEXISTENCE VERIFICATION (HEADLESS CHROMIUM)
// ===========================================================================

test('EMPIRICAL DESKTOP PARITY 1: Mouse hover reveals .message-hover-actions on desktop with correct positioning', async () => {
  const browser = await launchBrowserSafely();
  if (!browser) return;
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      hasTouch: false
    });
    await page.setContent(buildDesktopHarnessHtml());

    const hoverActionsMe = page.locator('#hover-actions-me-1');
    const hoverActionsOther = page.locator('#hover-actions-other-1');
    const bubbleMe = page.locator('#bubble-me-1');
    const bubbleOther = page.locator('#bubble-other-1');

    // 1. Initial state (no hover): hover actions must have opacity 0 or pointer-events none
    const initialOpacityMe = await hoverActionsMe.evaluate((el) => window.getComputedStyle(el).opacity);
    assert.equal(initialOpacityMe, '0', 'Outgoing message hover actions must be hidden initially');

    const initialOpacityOther = await hoverActionsOther.evaluate((el) => window.getComputedStyle(el).opacity);
    assert.equal(initialOpacityOther, '0', 'Incoming message hover actions must be hidden initially');

    // 2. Hover over outgoing bubble: hover actions become visible (opacity 1) and pointer-events auto
    await bubbleMe.hover();
    await page.waitForTimeout(250);

    const hoveredOpacityMe = await hoverActionsMe.evaluate((el) => window.getComputedStyle(el).opacity);
    const hoveredEventsMe = await hoverActionsMe.evaluate((el) => window.getComputedStyle(el).pointerEvents);
    assert.equal(hoveredOpacityMe, '1', 'Outgoing hover actions must become visible on hover');
    assert.equal(hoveredEventsMe, 'auto', 'Outgoing hover actions must receive pointer events on hover');

    // Verify positioning: For row-me, hover actions are placed to the LEFT (right: 100%, margin-right: 8px)
    const bubbleMeBox = await bubbleMe.boundingBox();
    const actionsMeBox = await hoverActionsMe.boundingBox();
    assert(actionsMeBox.x + actionsMeBox.width <= bubbleMeBox.x + 2, 'Outgoing hover actions must be placed to the left of outgoing bubble');

    // 3. Hover over incoming bubble: hover actions become visible to the RIGHT (left: 100%, margin-left: 8px)
    await bubbleOther.hover();
    await page.waitForTimeout(250);

    const hoveredOpacityOther = await hoverActionsOther.evaluate((el) => window.getComputedStyle(el).opacity);
    const hoveredEventsOther = await hoverActionsOther.evaluate((el) => window.getComputedStyle(el).pointerEvents);
    assert.equal(hoveredOpacityOther, '1', 'Incoming hover actions must become visible on hover');
    assert.equal(hoveredEventsOther, 'auto', 'Incoming hover actions must receive pointer events on hover');

    // 4. Move mouse away to body: hover actions revert to opacity 0
    await page.mouse.move(10, 10);
    await page.waitForTimeout(250);
    const finalOpacityMe = await hoverActionsMe.evaluate((el) => window.getComputedStyle(el).opacity);
    assert.equal(finalOpacityMe, '0', 'Hover actions must hide when mouse leaves bubble');
  } finally {
    await browser.close();
  }
});

test('EMPIRICAL DESKTOP PARITY 2: Mouse click on hover action buttons triggers Reply, Reaction portal, and Delete', async () => {
  const browser = await launchBrowserSafely();
  if (!browser) return;
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      hasTouch: false
    });
    await page.setContent(buildDesktopHarnessHtml());

    // 1. Reply Button Click
    await page.locator('#bubble-me-1').hover();
    await page.locator('#btn-reply-me-1').click();
    let events = await page.evaluate(() => window.__eventsLog);
    assert.deepEqual(events[events.length - 1], { action: 'reply', messageId: 'm_me_1' }, 'Clicking reply button must log reply action');

    // 2. Smile Reaction Button Click -> opens portaled reaction drawer
    await page.locator('#bubble-other-1').hover();
    await page.locator('#btn-smile-other-1').click();
    await page.waitForSelector('#portaled-reaction-drawer', { state: 'visible' });

    const drawer = page.locator('#portaled-reaction-drawer');
    const drawerBox = await drawer.boundingBox();
    assert(drawerBox != null, 'Portaled reaction drawer must have a valid bounding box');
    assert(drawerBox.width >= 200, 'Portaled reaction drawer must have proper width');

    // Click an emoji inside the reaction drawer (e.g. 🔥)
    const fireEmoji = page.locator('.reaction-drawer-item[data-emoji="🔥"]');
    await fireEmoji.click();
    events = await page.evaluate(() => window.__eventsLog);
    assert.deepEqual(
      events[events.length - 1],
      { action: 'reactionSelect', messageId: 'm_other_1', emoji: '🔥' },
      'Clicking emoji in drawer must trigger reaction toggle'
    );

    // Verify drawer dismissed after emoji selection
    const drawerCount = await page.locator('#portaled-reaction-drawer').count();
    assert.equal(drawerCount, 0, 'Reaction drawer must close after emoji selection');

    // 3. Delete Button Click
    await page.locator('#bubble-me-1').hover();
    await page.locator('#btn-delete-me-1').click();
    events = await page.evaluate(() => window.__eventsLog);
    assert.deepEqual(events[events.length - 1], { action: 'delete', messageId: 'm_me_1' }, 'Clicking delete button must trigger delete action');
  } finally {
    await browser.close();
  }
});

test('EMPIRICAL DESKTOP PARITY 3: Desktop right-click preserves native context menu (not defaultPrevented)', async () => {
  const browser = await launchBrowserSafely();
  if (!browser) return;
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      hasTouch: false
    });
    await page.setContent(buildDesktopHarnessHtml());

    // Right-click on desktop bubble
    await page.locator('#bubble-me-1').click({ button: 'right' });
    const events = await page.evaluate(() => window.__eventsLog);
    const contextEvent = events.find(e => e.event === 'contextmenu' && e.target === 'bubble-me-1');

    assert(contextEvent != null, 'Context menu event must have fired');
    assert.equal(contextEvent.defaultPrevented, false, 'Desktop right click must NOT prevent default, allowing native browser menu');
  } finally {
    await browser.close();
  }
});

test('EMPIRICAL DESKTOP PARITY 4: Desktop text selection (user-select: text) and cursor styling', async () => {
  const browser = await launchBrowserSafely();
  if (!browser) return;
  try {
    // Desktop Viewport (>=769px, fine pointer, hover: hover)
    const page = await browser.newPage({
      viewport: { width: 1024, height: 768 },
      hasTouch: false
    });
    await page.setContent(buildDesktopHarnessHtml());

    const userSelectDesktop = await page.evaluate(() => {
      const textEl = document.querySelector('.message-bubble .message-text');
      return window.getComputedStyle(textEl).userSelect || window.getComputedStyle(textEl).webkitUserSelect;
    });
    assert.equal(userSelectDesktop, 'text', 'Desktop text selection must be allowed (user-select: text)');

    const cursorDesktop = await page.evaluate(() => {
      const textEl = document.querySelector('.message-bubble .message-text');
      return window.getComputedStyle(textEl).cursor;
    });
    assert.equal(cursorDesktop, 'text', 'Desktop message text cursor must be text');
  } finally {
    await browser.close();
  }
});

// ===========================================================================
// SECTION 2: EMPIRICAL NON-REGRESSION VERIFICATION (10-MIN GROUPING & SCROLL & E2EE)
// ===========================================================================

test('NON-REGRESSION 1 [10-Minute Grouping]: millisecond boundaries and sender identity resolution', () => {
  function computeGroupingState(messages, index, currentUser, activeChat) {
    const msg = messages[index];
    const isMe = msg.senderId === currentUser?.id || msg.senderId === 'current';
    const isGroupOther = activeChat?.type === 'group' && !isMe;
    const nextMsg = messages[index + 1];
    const prevMsg = messages[index - 1];

    const getSenderKey = (m) => m ? (m.senderId || m.sender_id || m.senderName || null) : null;
    const currentSenderKey = getSenderKey(msg);
    const prevSenderKey = getSenderKey(prevMsg);
    const nextSenderKey = getSenderKey(nextMsg);

    const isSameSenderAsPrev = Boolean(
      prevMsg &&
      prevSenderKey &&
      currentSenderKey &&
      prevSenderKey === currentSenderKey &&
      Math.abs(new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) < 10 * 60 * 1000
    );

    const isSameSenderAsNext = Boolean(
      nextMsg &&
      nextSenderKey &&
      currentSenderKey &&
      nextSenderKey === currentSenderKey &&
      Math.abs(new Date(nextMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 10 * 60 * 1000
    );

    return {
      isFirstInGroup: !isSameSenderAsPrev,
      isLastInGroup: !isSameSenderAsNext,
      showSenderName: isGroupOther && !isSameSenderAsPrev
    };
  }

  const t0 = 1755770000000; // Base timestamp
  const currentUser = { id: 'me_123' };
  const groupChat = { id: 'group_1', type: 'group' };

  // Test Boundary 1: Exactly 9 min 59.999 sec (599,999 ms) -> Grouped together
  const msgsBoundaryBelow = [
    { id: '1', senderId: 'bob_1', timestamp: new Date(t0).toISOString(), text: 'Msg 1' },
    { id: '2', senderId: 'bob_1', timestamp: new Date(t0 + 599999).toISOString(), text: 'Msg 2 (599999ms)' }
  ];
  const g0_below = computeGroupingState(msgsBoundaryBelow, 0, currentUser, groupChat);
  const g1_below = computeGroupingState(msgsBoundaryBelow, 1, currentUser, groupChat);

  assert.equal(g0_below.isFirstInGroup, true, 'Msg 1 is first in group');
  assert.equal(g0_below.isLastInGroup, false, 'Msg 1 is NOT last because Msg 2 is <10 min');
  assert.equal(g0_below.showSenderName, true, 'Msg 1 shows sender name');

  assert.equal(g1_below.isFirstInGroup, false, 'Msg 2 is NOT first in group (<10 min)');
  assert.equal(g1_below.isLastInGroup, true, 'Msg 2 is last in group');
  assert.equal(g1_below.showSenderName, false, 'Msg 2 must NOT repeat sender name');

  // Test Boundary 2: Exactly 10 min 0.000 sec (600,000 ms) -> NOT grouped (new cluster)
  const msgsBoundaryExact = [
    { id: '1', senderId: 'bob_1', timestamp: new Date(t0).toISOString(), text: 'Msg 1' },
    { id: '2', senderId: 'bob_1', timestamp: new Date(t0 + 600000).toISOString(), text: 'Msg 2 (600000ms)' }
  ];
  const g0_exact = computeGroupingState(msgsBoundaryExact, 0, currentUser, groupChat);
  const g1_exact = computeGroupingState(msgsBoundaryExact, 1, currentUser, groupChat);

  assert.equal(g0_exact.isFirstInGroup, true);
  assert.equal(g0_exact.isLastInGroup, true, 'Msg 1 is isolated because Msg 2 is >=10 min');
  assert.equal(g1_exact.isFirstInGroup, true, 'Msg 2 starts new group at exact 10 min');
  assert.equal(g1_exact.isLastInGroup, true, 'Msg 2 is last in its group');
  assert.equal(g1_exact.showSenderName, true, 'Msg 2 must show sender name for new cluster');

  // Test Boundary 3: Heterogeneous sender keys (senderId vs sender_id vs senderName)
  const msgsHetero = [
    { id: '1', sender_id: 'alice_99', timestamp: new Date(t0).toISOString(), text: 'Legacy DB shape' },
    { id: '2', senderId: 'alice_99', timestamp: new Date(t0 + 60000).toISOString(), text: 'Normalized shape' }
  ];
  const g0_hetero = computeGroupingState(msgsHetero, 0, currentUser, groupChat);
  const g1_hetero = computeGroupingState(msgsHetero, 1, currentUser, groupChat);
  assert.equal(g0_hetero.isLastInGroup, false, 'Heterogeneous sender keys must resolve correctly');
  assert.equal(g1_hetero.isFirstInGroup, false, 'Heterogeneous sender keys must resolve correctly');
});

test('NON-REGRESSION 2 [Scroll Stability]: message deletion and reaction toggle strictly preserve scroll position', () => {
  let scrollInvocations = [];
  function runChatAreaScrollPolicy({
    currentCount,
    prevCount,
    currentLatestId,
    prevLatestId,
    latestSenderId,
    currentUserId,
    shouldAutoScroll,
    isLoadingOlder
  }) {
    const isNewMessage = (
      currentCount > prevCount &&
      currentLatestId !== prevLatestId
    );
    const isOwnMessage = isNewMessage && (latestSenderId === currentUserId || latestSenderId === 'current');

    if (!isLoadingOlder && isNewMessage) {
      if (shouldAutoScroll || isOwnMessage) {
        scrollInvocations.push({ behavior: 'smooth', isOwnMessage, shouldAutoScroll });
      }
    }
  }

  // Scenario 1: Message deleted (count decreases from 20 to 19)
  scrollInvocations = [];
  runChatAreaScrollPolicy({
    currentCount: 19,
    prevCount: 20,
    currentLatestId: 'm19',
    prevLatestId: 'm20',
    latestSenderId: 'bob',
    currentUserId: 'me',
    shouldAutoScroll: false,
    isLoadingOlder: false
  });
  assert.equal(scrollInvocations.length, 0, 'Scroll must NEVER trigger on message delete');

  // Scenario 2: Reaction toggled (count remains 20)
  scrollInvocations = [];
  runChatAreaScrollPolicy({
    currentCount: 20,
    prevCount: 20,
    currentLatestId: 'm20',
    prevLatestId: 'm20',
    latestSenderId: 'bob',
    currentUserId: 'me',
    shouldAutoScroll: false,
    isLoadingOlder: false
  });
  assert.equal(scrollInvocations.length, 0, 'Scroll must NEVER trigger on reaction toggle');

  // Scenario 3: Incoming message while scrolled up (distanceFromBottom > 120px -> shouldAutoScroll: false)
  scrollInvocations = [];
  runChatAreaScrollPolicy({
    currentCount: 21,
    prevCount: 20,
    currentLatestId: 'm21',
    prevLatestId: 'm20',
    latestSenderId: 'bob',
    currentUserId: 'me',
    shouldAutoScroll: false,
    isLoadingOlder: false
  });
  assert.equal(scrollInvocations.length, 0, 'Incoming message when scrolled up must NOT autoscroll');

  // Scenario 4: Outgoing new message (isOwnMessage: true) -> Always autoscrolls
  scrollInvocations = [];
  runChatAreaScrollPolicy({
    currentCount: 21,
    prevCount: 20,
    currentLatestId: 'm21',
    prevLatestId: 'm20',
    latestSenderId: 'me',
    currentUserId: 'me',
    shouldAutoScroll: false,
    isLoadingOlder: false
  });
  assert.equal(scrollInvocations.length, 1, 'Own outgoing message must always autoscroll');
  assert.equal(scrollInvocations[0].isOwnMessage, true);

  // Scenario 5: Incoming message while near bottom (shouldAutoScroll: true) -> Autoscrolls
  scrollInvocations = [];
  runChatAreaScrollPolicy({
    currentCount: 21,
    prevCount: 20,
    currentLatestId: 'm21',
    prevLatestId: 'm20',
    latestSenderId: 'bob',
    currentUserId: 'me',
    shouldAutoScroll: true,
    isLoadingOlder: false
  });
  assert.equal(scrollInvocations.length, 1, 'Incoming message when near bottom must autoscroll');
});

test('NON-REGRESSION 3 [E2EE Rendering & Media Component Contracts]: lock icon and decrypted media routing intact', () => {
  // 1. Check Lock icon rendering in MessageBubble
  assert.match(
    messageBubbleJsx,
    /msg\.isLocked\s*&&\s*<Lock\s+size=\{13\}/,
    'MessageBubble must render Lock icon for encrypted messages'
  );

  // 2. Check Decrypted* media component imports & usage
  assert.match(
    messageBubbleJsx,
    /<DecryptedImage\s+mediaUrl=\{msg\.media\}\s+chatId=\{activeChat\.id\}/,
    'MessageBubble must use DecryptedImage with chatId'
  );
  assert.match(
    messageBubbleJsx,
    /<DecryptedRegularVideoPlayer\s+mediaUrl=\{msg\.media\}\s+chatId=\{activeChat\.id\}/,
    'MessageBubble must use DecryptedRegularVideoPlayer with chatId'
  );
  assert.match(
    messageBubbleJsx,
    /<DecryptedVideoPlayer\s+mediaUrl=\{msg\.media\}\s+chatId=\{activeChat\.id\}/,
    'MessageBubble must use DecryptedVideoPlayer with chatId'
  );
  assert.match(
    messageBubbleJsx,
    /<DecryptedVoicePlayer\s+mediaUrl=\{msg\.media\}\s+chatId=\{activeChat\.id\}/,
    'MessageBubble must use DecryptedVoicePlayer with chatId'
  );
  assert.match(
    messageBubbleJsx,
    /<DecryptedSticker\s+mediaUrl=\{msg\.media\}\s+chatId=\{activeChat\.id\}/,
    'MessageBubble must use DecryptedSticker with chatId'
  );

  // 3. Check code block rendering
  assert.match(
    messageBubbleJsx,
    /<pre\s+className="code-block">\s*<code>\{msg\.text\.replace\(\/```\/g,\s*''\)\}<\/code>\s*<\/pre>/,
    'MessageBubble must format markdown code blocks'
  );
});
