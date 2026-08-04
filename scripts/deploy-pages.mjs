/**
 * Deploy Vite dist/ to GitHub Pages and keep recent hashed assets from
 * previous gh-pages commits so open tabs do not 404 on old chunk names.
 *
 * Usage: node scripts/deploy-pages.mjs
 * Expects dist/ already built (or set BUILD_FIRST=1).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const stagingDir = path.join(root, 'dist-pages');

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

if (process.env.BUILD_FIRST === '1') {
  run('npm run build');
}

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('dist/index.html missing — run npm run build first');
}

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.cpSync(distDir, stagingDir, { recursive: true });

// Preserve previously published hashed assets (last N gh-pages commits).
const keepCommits = Number(process.env.PAGES_KEEP_COMMITS || 12);
try {
  run('git fetch origin gh-pages', { silent: true });
  const commits = run(`git rev-list origin/gh-pages -${keepCommits}`, { silent: true })
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let restored = 0;
  for (const commit of commits) {
    let files = [];
    try {
      files = run(`git ls-tree -r --name-only ${commit}`, { silent: true })
        .split(/\n/)
        .map((f) => f.trim())
        .filter((f) => f.startsWith('assets/') && f.length > 0);
    } catch {
      continue;
    }

    for (const rel of files) {
      const dest = path.join(stagingDir, rel);
      if (fs.existsSync(dest)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try {
        const buf = execSync(`git show ${commit}:${rel}`, {
          cwd: root,
          maxBuffer: 40 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        fs.writeFileSync(dest, buf);
        restored += 1;
      } catch {
        /* skip missing blob */
      }
    }
  }
  console.log(`Preserved ${restored} historical asset file(s) for cache-safe deploys.`);
} catch (error) {
  console.warn('Could not preserve historical assets:', error.message || error);
}

// Bump a comment so GH Pages content always changes (helps CDN/browser revalidate HTML).
const indexPath = path.join(stagingDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(
  /<!-- deploy-timestamp:.*?-->\s*$/m,
  ''
);
html += `\n<!-- deploy-timestamp: ${new Date().toISOString()} -->\n`;
fs.writeFileSync(indexPath, html);

run('npx gh-pages -t -d dist-pages');
console.log('GitHub Pages deploy finished.');
