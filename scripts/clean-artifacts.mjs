/**
 * Remove local build/test artifacts that are safe to regenerate.
 * Usage:
 *   node scripts/clean-artifacts.mjs
 *   node scripts/clean-artifacts.mjs --all   # also removes node_modules
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const includeNodeModules = process.argv.includes('--all');

const targets = [
  'dist',
  'dist-electron',
  'dist-ssr',
  'test-results',
  'playwright-report',
  path.join('android', 'app', 'build'),
  path.join('android', 'build'),
  path.join('android', '.gradle'),
];

if (includeNodeModules) {
  targets.push('node_modules');
}

function rmrf(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return { removed: false, bytes: 0 };
  }
  let bytes = 0;
  try {
    const stat = fs.statSync(targetPath);
    if (stat.isFile()) {
      bytes = stat.size;
    }
  } catch {
    /* ignore */
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
  return { removed: true, bytes };
}

let removedCount = 0;
for (const rel of targets) {
  const full = path.join(rootDir, rel);
  const { removed } = rmrf(full);
  if (removed) {
    removedCount += 1;
    console.log(`removed: ${rel}`);
  } else {
    console.log(`skip (missing): ${rel}`);
  }
}

console.log(
  removedCount > 0
    ? `Done. Cleaned ${removedCount} path(s).${includeNodeModules ? ' Run npm install before the next build.' : ''}`
    : 'Nothing to clean.'
);
