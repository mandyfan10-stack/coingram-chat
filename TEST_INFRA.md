# E2E Test Infra: Coingram Chat Mobile Touch Interactions

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.
- Toolchain: Native Node.js test runner (`node:test`, `node:assert/strict`) compatible with `npm test`, `npm run typecheck`, and `oxlint --deny-warnings`.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Touch Gesture & Long-Press Engine | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Haptic Vibration Trigger | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Browser Callout Suppression | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | Interactive Child Target Filtering | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 5 | Quick Emoji Reaction Carousel (8 emojis) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 6 | Touch-Friendly Action List (>=44px) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 7 | Backdrop & Tap-Outside Dismissal | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 8 | Copy Text Clipboard Action | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 9 | Cross-Message Type Touch Support | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 10 | Desktop Parity & Coexistence | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 11 | Non-Regression Protections | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 12 | Automated Verification & Quality Gate | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |

## Test Architecture
- **Test File**: `tests/mobileTouchInteractions.test.mjs`
- **Execution Command**: `node --test tests/mobileTouchInteractions.test.mjs` and `npm test`
- **Pass Semantics**: Exit code 0, 0 failures, 0 skipped, 0 type errors (`tsc --noEmit`), 0 lint warnings (`oxlint --deny-warnings`).

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Mobile user long-presses text message and adds ❤️ reaction | F1, F2, F5, F7, F12 | High |
| 2 | Mobile user taps voice message play button (should play audio, NOT open action sheet) | F1, F4, F11 | High |
| 3 | Mobile user long-presses photo message, copies caption/text, and dismisses | F1, F2, F6, F7, F8, F9 | High |
| 4 | Mobile user initiates scroll gesture on message list (pointer moves >12px) - long press is aborted | F1, F4, F11 | Medium |
| 5 | Desktop mouse user hovers message to reveal `.message-hover-actions` and right-clicks for context menu | F10, F11, F12 | High |
| 6 | Mobile user deletes message via action sheet with scroll preservation and optimistic update | F1, F6, F11, F12 | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature (≥60 tests)
- Tier 2: ≥5 per feature boundary cases (≥60 tests)
- Tier 3: Pairwise coverage of major feature interactions (≥12 tests)
- Tier 4: ≥6 realistic application scenarios
- **Total Minimum Target**: ~138+ touch test assertions integrated into `npm test`.
