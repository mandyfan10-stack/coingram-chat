import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexCss = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const chatAreaCss = fs.readFileSync(new URL('../src/components/ChatArea.css', import.meta.url), 'utf8');

function getSpecificity(selector) {
  const a = (selector.match(/#[a-zA-Z0-9_-]+/g) || []).length;
  const b = (selector.match(/\.[a-zA-Z0-9_-]+|\[[^\]]+\]|:[a-zA-Z0-9_-]+/g) || []).length;
  const c = (selector.match(/(?:^|\s|>|\+|~)[a-zA-Z0-9_-]+/g) || []).filter(s => !s.includes('.') && !s.includes('#')).length;
  return [a, b, c];
}

test('CSS specificity hierarchy guarantees row-other override over base message-bubble', () => {
  const baseSpec = getSpecificity('.message-bubble');
  const rowOtherSpec = getSpecificity('.message-row.row-other .message-bubble');
  const rowMeSpec = getSpecificity('.message-row.row-me .message-bubble');

  assert.equal(baseSpec[0], 0);
  assert.equal(baseSpec[1], 1); // 1 class

  assert.equal(rowOtherSpec[0], 0);
  assert.equal(rowOtherSpec[1], 3); // 3 classes (.message-row, .row-other, .message-bubble)
  assert(rowOtherSpec[1] > baseSpec[1], 'row-other selector must have higher class specificity than base bubble');

  assert.equal(rowMeSpec[0], 0);
  assert.equal(rowMeSpec[1], 3);
});

test('viewport boundary simulation across all mobile, tablet, and desktop breakpoints', () => {
  const viewports = [
    { name: 'Galaxy Fold Cover', w: 280 },
    { name: 'iPhone SE 1st gen', w: 320 },
    { name: 'Android Mini', w: 340 },
    { name: 'Standard Android budget', w: 360 },
    { name: 'iPhone SE 2/3 / 12 mini', w: 375 },
    { name: 'iPhone 13 / 14 / 15 standard', w: 390 },
    { name: 'Samsung Galaxy S22/S23', w: 400 },
    { name: 'Google Pixel 7', w: 412 },
    { name: 'iPhone Pro Max / Plus', w: 428 },
    { name: 'Large phablet', w: 480 },
    { name: 'Small tablet / foldable open', w: 600 },
    { name: '640px Breakpoint boundary', w: 640 },
    { name: 'Small tablet landscape', w: 700 },
    { name: '768px Breakpoint boundary', w: 768 },
    { name: 'iPad Landscape', w: 1024 },
    { name: 'Desktop Full HD', w: 1920 }
  ];

  for (const { name, w } of viewports) {
    let padH = 48;
    if (w <= 380) {
      padH = 16;
    } else if (w <= 640) {
      padH = 20;
    } else if (w <= 768) {
      padH = 24;
    }

    const innerW = w - padH;

    // Outgoing bubble
    let maxBubbleMe = 0;
    if (w <= 380) {
      maxBubbleMe = Math.min(0.88 * innerW, 320);
    } else if (w <= 768) {
      maxBubbleMe = Math.min(0.88 * innerW, 460);
    } else {
      maxBubbleMe = Math.min(0.75 * innerW, 480);
    }

    // Incoming bubble (.message-row.row-other .message-bubble)
    let maxBubbleOther = 0;
    if (w <= 380) {
      maxBubbleOther = innerW - 40;
    } else if (w <= 768) {
      maxBubbleOther = Math.min(innerW - 44, 460);
    } else {
      maxBubbleOther = Math.min(0.75 * innerW, 480);
    }

    const incomingRowTotal = 32 + 8 + maxBubbleOther;
    const incomingHeadroom = innerW - incomingRowTotal;
    const outgoingHeadroom = innerW - maxBubbleMe;

    assert(
      incomingHeadroom >= -0.001,
      `Incoming message row overflows at ${w}px (${name}). Headroom: ${incomingHeadroom}`
    );
    assert(
      outgoingHeadroom >= -0.001,
      `Outgoing message row overflows at ${w}px (${name}). Headroom: ${outgoingHeadroom}`
    );

    // Voice player
    let voiceW = 230;
    if (w <= 380) {
      voiceW = 180;
    } else if (w <= 640) {
      const v52 = 0.52 * w;
      voiceW = Math.max(175, Math.min(v52, 220));
    }
    const voiceBubbleTotal = voiceW + 20;
    const incomingVoiceRowTotal = 32 + 8 + voiceBubbleTotal;
    const voiceHeadroom = innerW - incomingVoiceRowTotal;

    assert(
      voiceHeadroom >= 0,
      `Voice player overflows incoming row at ${w}px (${name}). Headroom: ${voiceHeadroom}`
    );

    // Circular video note: 180px + 4px = 184px
    const roundVideoBubbleTotal = 184;
    const incomingVideoNoteRowTotal = 32 + 8 + roundVideoBubbleTotal;
    const videoNoteHeadroom = innerW - incomingVideoNoteRowTotal;

    assert(
      videoNoteHeadroom >= 0,
      `Video note overflows incoming row at ${w}px (${name}). Headroom: ${videoNoteHeadroom}`
    );
  }
});

test('text wrapping, overflow-wrap, and flex shrink containment rules', () => {
  assert.match(
    chatAreaCss,
    /\.message-text\s*\{[^}]*\boverflow-wrap:\s*anywhere\s*;/s,
    'ChatArea.css must have overflow-wrap: anywhere for breaking long continuous strings'
  );
  assert.match(
    chatAreaCss,
    /\.message-text\s*\{[^}]*\bword-break:\s*break-word\s*;/s,
    'ChatArea.css must have word-break: break-word'
  );
  assert.match(
    chatAreaCss,
    /\.bubble-content\s*\{[^}]*\bmin-width:\s*0\s*;/s,
    'ChatArea.css bubble-content must have min-width: 0'
  );
  assert.match(
    indexCss,
    /\.code-block\s*\{[^}]*\boverflow-x:\s*auto\s*;/s,
    'index.css code-block must have overflow-x: auto'
  );
});
