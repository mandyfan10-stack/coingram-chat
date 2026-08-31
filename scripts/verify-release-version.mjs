import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(rootDir, 'src');

const rawTag = process.argv[2] || process.env.GITHUB_REF_NAME;
if (!rawTag) {
  throw new Error('Pass a release tag, for example: npm run release:verify -- v1.20.39');
}

const tagVersion = rawTag.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(tagVersion)) {
  throw new Error(`Release tag must use vMAJOR.MINOR.PATCH: ${rawTag}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
if (packageJson.version !== tagVersion) {
  throw new Error(`Tag ${rawTag} does not match package.json version ${packageJson.version}`);
}

const [major, minor, patch] = tagVersion.split('.').map(Number);
if (minor >= 1000 || patch >= 1000) {
  throw new Error('Android versionCode encoding requires minor and patch values below 1000');
}

const androidVersionCode = major * 1_000_000 + minor * 1_000 + patch;
if (androidVersionCode <= 0 || androidVersionCode > 2_100_000_000) {
  throw new Error(`Calculated Android versionCode is out of range: ${androidVersionCode}`);
}

/** Collect source files under src/ */
function walkSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, acc);
      continue;
    }
    if (/\.(jsx?|tsx?|mjs|cjs|css)$/i.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Fail if src/ hardcodes a semver that is not the release version.
 * Allows import.meta.env.APP_VERSION and package-driven defines only.
 * Skips node dependency version strings by matching only string/template literals.
 */
const VERSION_LITERAL = /(?:'|"|`)(\d+\.\d+\.\d+)(?:'|"|`)/g;
const staleHits = [];

for (const file of walkSourceFiles(srcDir)) {
  const text = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = VERSION_LITERAL.exec(text)) !== null) {
    const found = match[1];
    if (found === tagVersion) continue;
    // Ignore obvious non-app versions (CSS opacity-like unlikely in x.y.z with 3 parts often is app version)
    // Flag any x.y.z that differs from package version as potential stale app version.
    const rel = path.relative(rootDir, file).replace(/\\/g, '/');
    const line = text.slice(0, match.index).split('\n').length;
    staleHits.push(`${rel}:${line} contains version literal "${found}" (expected ${tagVersion} or APP_VERSION)`);
  }
}

if (staleHits.length > 0) {
  throw new Error(
    `Found hardcoded version literals in src/ that do not match package.json ${tagVersion}:\n` +
      staleHits.map((h) => `  - ${h}`).join('\n') +
      '\nUse import.meta.env.APP_VERSION (injected from package.json by Vite) instead of hardcoded fallbacks.'
  );
}

console.log(`Release ${rawTag} is consistent (Android versionCode ${androidVersionCode}).`);
console.log('No stale app version literals found in src/.');
