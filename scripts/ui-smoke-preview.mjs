import { chromium } from '@playwright/test';
import fs from 'fs';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:4173/';
const outDir = 'C:/Users/serge/visual-review/packaging-smoke';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const findings = [];

async function check(page, label) {
  const data = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const misconfigured = /не настроено|VITE_SUPABASE/i.test(text);
    const pulse = !!document.querySelector('.pulse-edge-tab, .pulse-panel, .pulse-shell');
    const app = document.querySelector('.app-container');
    const auth = !!document.querySelector('.auth-card, .auth-card-wrapper, .auth-loading-screen');
    const sidebar = document.querySelector('.sidebar');
    const chat = document.querySelector('.chat-area');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    return {
      misconfigured,
      pulse,
      hasApp: !!app,
      authOrLoading: auth,
      sidebarW: sidebar?.getBoundingClientRect().width || 0,
      chatW: chat?.getBoundingClientRect().width || 0,
      bodySnippet: text.slice(0, 200).replace(/\s+/g, ' '),
      overflowX,
      vw,
      vh,
      appClass: app?.className || '',
    };
  });
  if (data.misconfigured) findings.push({ sev: 'high', label, msg: 'MisconfiguredScreen visible' });
  if (data.pulse) findings.push({ sev: 'high', label, msg: 'Pulse UI still present' });
  if (data.overflowX) findings.push({ sev: 'med', label, msg: 'horizontal overflow' });
  return data;
}

const viewports = [
  { name: 'desktop-1280', w: 1280, h: 800 },
  { name: 'mobile-390', w: 390, h: 844 },
  { name: 'short-800x360', w: 800, h: 360 },
];

const results = [];
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  const data = await check(page, vp.name);
  await page.screenshot({ path: `${outDir}/${vp.name}.png` });
  results.push({ vp: vp.name, ...data });
  await page.close();
}

await browser.close();
const report = { findings, results };
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (findings.some((f) => f.sev === 'high')) process.exit(1);
