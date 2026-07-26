import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexCss = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const chatAreaCss = fs.readFileSync(new URL('../src/components/ChatArea.css', import.meta.url), 'utf8');

test('desktop chat layout keeps the info panel at its full width beside media', () => {
  assert.match(
    chatAreaCss,
    /\.chat-area\s*\{[^}]*\bmin-width:\s*0\s*;/s,
    'the central flex item must be allowed to shrink below media intrinsic width',
  );
  assert.match(
    indexCss,
    /\.chat-info\s*\{[^}]*\bflex:\s*0\s+0\s+auto\s*;/s,
    'the details panel must not shrink when the chat contains wide media',
  );
});