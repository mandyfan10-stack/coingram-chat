# Project: Coingram Chat Mobile Touch Interactions Overhaul

## Architecture
Coingram Chat is a high-performance React + TypeScript/JavaScript chat client. The mobile touch overhaul provides an ergonomic, touch-friendly Telegram-style interaction model on mobile screens (< 768px / touch devices) while preserving seamless desktop hover actions (`.message-hover-actions`) and desktop context-menu workflows.

### Component & State Architecture
- **Gesture Detection Hook / Engine (`src/hooks/useMessageTouch.js`)**:
  - Distinguishes taps, long-press holds (~380-450ms), and scrolls (pointer move > 10px Euclidean distance threshold or container scroll).
  - Triggers multi-tier safe haptics (`navigator.vibrate?.(12)` / Capacitor / WebKit).
  - Suppresses native browser context menu via `-webkit-touch-callout: none;` and `e.preventDefault()` on touch devices.
  - Filters out clicks on interactive children (audio play/pause/seeker, video player, image viewer, reaction badges, avatar, links).
- **Mobile Action Sheet & Reaction Bar (`src/components/chat/MobileActionSheet.jsx` & `MobileActionSheet.css`)**:
  - Telegram-style floating bottom sheet or context overlay with smooth backdrop.
  - Horizontal quick reaction carousel with 8 emoji options: ❤️, 👍, 👎, 🔥, 😂, 👏, 🎉, 😢.
  - Action list with touch targets >= 44px:
    - **Reply (Ответить)** -> triggers `onReply(message)` (`setReplyingTo`).
    - **Copy Text (Копировать текст)** -> copies `message.text` / media caption to clipboard with haptic feedback.
    - **Delete (Удалить сообщение)** -> triggers `onDelete(message)` (`deleteMessage`) with strict RBAC authorization.
  - Tap-outside / backdrop dismissal with smooth exit animation.
- **Message Rendering Integration (`src/components/chat/MessageBubble.jsx`, `MessageList.jsx`, `ChatArea.jsx`)**:
  - Attaches touch gesture handlers across all message types: text, photos, videos, voice notes, stickers, forwarded messages.
  - Preserves desktop `.message-hover-actions` for mouse/desktop users.
  - Ensures voice note playback, 10-minute timestamp grouping, scroll preservation on delete, and E2EE encryption remain 100% intact.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Touch Gesture & Long-Press Engine | Long-press (~380ms) and tap trigger with 10px movement threshold and scroll cancellation | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Haptic Vibration Trigger | `navigator.vibrate?.(12)` invocation with safe multi-tier error handling | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Browser Callout Suppression | `-webkit-touch-callout: none;` and touch context menu prevention on message bubbles | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Interactive Child Target Filtering | Prevent action sheet trigger when tapping voice play/pause/seeker, video controls, links, avatars, reaction badges | M1 | Survey |
| 5 | Quick Emoji Reaction Carousel | Horizontal reaction bar with 8 emojis: ❤️, 👍, 👎, 🔥, 😂, 👏, 🎉, 😢 with atomic RPC update | M2 | ORIGINAL_REQUEST §R1 |
| 6 | Touch-Friendly Action List (>=44px) | Reply (Ответить), Copy Text (Копировать текст), Delete (Удалить сообщение) with >=44px touch targets | M2 | ORIGINAL_REQUEST §R1 |
| 7 | Backdrop & Tap-Outside Dismissal | Full backdrop overlay dismissing action sheet on tap outside or Escape key | M2 | ORIGINAL_REQUEST §R1 |
| 8 | Copy Text Clipboard Action | Clipboard copy of message text with haptic confirmation | M2 | ORIGINAL_REQUEST §R1 |
| 9 | Cross-Message Type Touch Support | Touch triggers on text, photo, video, voice notes, stickers, forwarded messages | M3 | ORIGINAL_REQUEST §R2 |
| 10 | Desktop Parity & Coexistence | Desktop hover actions (`.message-hover-actions`) and desktop context-menu intact | M3 | ORIGINAL_REQUEST §R2 |
| 11 | Non-Regression Protections | Preserve voice playback, 10-minute grouping, scroll preservation on delete, E2EE encryption | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Comprehensive E2E & Unit Test Verification | 100% test pass across existing 277+ tests + new touch action sheet tests, typecheck, and oxlint | M4 (Final) | ORIGINAL_REQUEST §R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Touch Gesture Engine & Haptics | `src/hooks/useMessageTouch.js`, movement cancellation, interactive filters, haptics, CSS touch-callout rules | none | DONE |
| M2 | Mobile Action Sheet & Reactions Component | `src/components/chat/MobileActionSheet.jsx`, `MobileActionSheet.css`, 8 emojis, >=44px Reply/Copy/Delete, backdrop dismissal | M1 | DONE |
| M3 | MessageBubble Integration & Desktop Parity | Connect `useMessageTouch` and `MobileActionSheet` in `MessageBubble.jsx` / `ChatArea.jsx`, test all message types, preserve desktop hover actions | M2 | DONE |
| M4 | E2E Testing Suite & Quality Gate | Comprehensive 4-tier test suite (`node:test`), regression tests, `npm test` (100% pass), `npm run typecheck`, `oxlint --deny-warnings` | M3 | PLANNED |

## Interface Contracts

### `useMessageTouch(options)`
```typescript
interface UseMessageTouchOptions {
  onTrigger: (event: TouchEvent | PointerEvent | MouseEvent) => void;
  disabled?: boolean;
  holdDurationMs?: number; // default 380ms
  moveThresholdPx?: number; // default 10px
  interactiveSelectors?: string[];
}
```

### `MobileActionSheet.jsx`
```typescript
interface MobileActionSheetProps {
  message: MessageObject;
  isOpen: boolean;
  onClose: () => void;
  onReactionSelect?: (emoji: string) => void;
  onReply?: (message: MessageObject) => void;
  onCopy?: (message: MessageObject) => void;
  onDelete?: (message: MessageObject) => void;
  isOutgoing?: boolean;
  canDelete?: boolean;
}
```

## Code Layout
- `src/hooks/useMessageTouch.js`: Mobile gesture engine hook (M1 - DONE)
- `src/components/chat/MobileActionSheet.jsx`: Mobile touch action sheet & reaction carousel (M2 - DONE)
- `src/components/chat/MobileActionSheet.css`: Styles for action sheet, 44px targets, animations (M2 - DONE)
- `src/utils/mobileActionSheetUtils.js`: Utility helpers for text extraction, clipboard, RBAC (M2 - DONE)
- `src/components/chat/MessageBubble.jsx`: Message bubble component integrating touch hook & action sheet (M3)
- `src/components/chat/MessageList.jsx` / `ChatArea.jsx`: Message list and chat container managing active sheet state (M3)
- `src/components/chat/Message.css`: CSS rules for `-webkit-touch-callout: none;` and touch styling (M1 - DONE)
- `tests/useMessageTouch.test.mjs`: Gesture engine unit tests (M1 - DONE)
- `tests/mobileActionSheet.test.mjs`: Action sheet & reactions tests (M2 - DONE)
- `tests/m2ChallengerEmpiricalVerification.test.mjs`: Action sheet edge-case tests (M2 - DONE)
- `tests/messageBubbleTouchIntegration.test.mjs`: Integration tests for all message types & desktop parity (M3)
- `tests/mobileTouchInteractions.test.mjs`: E2E / integrated touch test suite (M4)
