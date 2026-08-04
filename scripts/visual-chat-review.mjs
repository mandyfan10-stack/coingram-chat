import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = 'C:/Users/serge/visual-review';
fs.mkdirSync(outDir, { recursive: true });

async function login(page) {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 30000 });
  const btn = page.getByRole('button', { name: /Быстрый вход/i });
  if (await btn.count()) await btn.click();
  await page.waitForSelector('.sidebar', { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function auditLayout(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: +r.x.toFixed(1),
        y: +r.y.toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        right: +r.right.toFixed(1),
        bottom: +r.bottom.toFixed(1),
      };
    };
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const findings = [];

    const sidebar = q('.sidebar');
    const chatArea = q('.chat-area');
    const header = q('.chat-header');
    const body = q('.chat-body');
    const footer = q('.chat-footer-input');
    const list = q('.chat-list');
    const items = qa('.chat-item');
    const bubbles = qa('.message-bubble');
    const app = q('.app-container');

    const docOverflowX =
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ||
      document.body.scrollWidth > document.body.clientWidth + 1;
    if (docOverflowX) findings.push({ sev: 'high', msg: 'document horizontal overflow' });

    for (const el of [sidebar, chatArea, header, footer, list].filter(Boolean)) {
      const r = el.getBoundingClientRect();
      // Off-screen panels (mobile slide) are expected; only flag on-screen overflow.
      if (r.left >= -2 && r.right > vw + 2 && r.width > 10) {
        findings.push({
          sev: 'high',
          msg: `${el.className.split(' ')[0]} exceeds viewport right (${r.right.toFixed(0)}>${vw})`,
        });
      }
    }

    if (footer) {
      const fr = footer.getBoundingClientRect();
      if (fr.bottom > vh + 4 && fr.top < vh) {
        findings.push({ sev: 'high', msg: `composer clipped below viewport (bottom=${fr.bottom.toFixed(0)}, vh=${vh})` });
      }
      if (fr.height > 0 && fr.height < 40) {
        findings.push({ sev: 'med', msg: `composer very short: ${fr.height.toFixed(0)}px` });
      }
    }

    if (header) {
      const hr = header.getBoundingClientRect();
      if (hr.height > 96) findings.push({ sev: 'low', msg: `header tall: ${hr.height.toFixed(0)}px` });
      if (hr.height > 0 && hr.height < 40) findings.push({ sev: 'med', msg: `header short: ${hr.height.toFixed(0)}px` });
    }

    for (const b of bubbles.slice(0, 12)) {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.left >= 0 && r.right > vw + 1) {
        findings.push({ sev: 'high', msg: 'message bubble overflows viewport' });
      }
      if (r.width > vw * 0.95) {
        findings.push({ sev: 'med', msg: `bubble too wide: ${r.width.toFixed(0)}/${vw}` });
      }
    }

    if (vw <= 768) {
      for (const btn of qa(
        '.chat-header-btn, .chat-back-btn, .send-message-btn, .menu-btn, .input-action-btn, .folder-tab',
      ).slice(0, 24)) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32)) {
          findings.push({
            sev: 'med',
            msg: `small touch target .${(btn.className || '').toString().split(/\s+/)[0]} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`,
          });
        }
      }
    }

    const myStory = q('.current-user-story .story-username');
    if (myStory) {
      const o = getComputedStyle(myStory);
      if (o.overflow === 'visible' && myStory.scrollWidth > myStory.clientWidth + 6) {
        findings.push({
          sev: 'med',
          msg: `story label overflows tray (${myStory.scrollWidth}>${myStory.clientWidth})`,
        });
      }
    }

    // Chat list row density
    if (items[0]) {
      const h = items[0].getBoundingClientRect().height;
      if (h < 56) findings.push({ sev: 'low', msg: `chat row short: ${h.toFixed(0)}px` });
      if (h > 88) findings.push({ sev: 'low', msg: `chat row tall: ${h.toFixed(0)}px` });
    }

    // Gap between header/body/footer stacking
    if (header && body && footer) {
      const hr = header.getBoundingClientRect();
      const br = body.getBoundingClientRect();
      const fr = footer.getBoundingClientRect();
      if (br.top < hr.bottom - 1) findings.push({ sev: 'high', msg: 'chat-body overlaps header' });
      if (fr.top < br.bottom - 1 && fr.width > 0 && br.width > 0) {
        // body and footer may share edge; allow 1px
      }
      if (Math.abs(br.bottom - fr.top) > 2 && fr.top > 0 && br.height > 0 && Math.abs(br.bottom - fr.top) < 40) {
        // fine
      }
    }

    const empty = q('.empty-state');
    const backBtn = q('.chat-back-btn');

    return {
      vw,
      vh,
      appClass: app?.className || '',
      sidebar: rect(sidebar),
      chatArea: rect(chatArea),
      header: rect(header),
      body: rect(body),
      footer: rect(footer),
      list: rect(list),
      itemCount: items.length,
      bubbleCount: bubbles.length,
      emptyVisible: !!(empty && empty.getBoundingClientRect().width > 0),
      chatBackDisplay: backBtn ? cs(backBtn).display : null,
      bubbleMaxW: bubbles[0] ? cs(bubbles[0]).maxWidth : null,
      chatNameEllipsis: items[0]?.querySelector('.chat-name')
        ? cs(items[0].querySelector('.chat-name')).textOverflow
        : null,
      findings,
    };
  });
}

const viewports = [
  { name: 'desktop-1440', w: 1440, h: 900 },
  { name: 'laptop-1280', w: 1280, h: 800 },
  { name: 'tablet-768', w: 768, h: 1024 },
  { name: 'mobile-390', w: 390, h: 844 },
  { name: 'mobile-360', w: 360, h: 800 },
  { name: 'landscape-800x360', w: 800, h: 360 },
];

const browser = await chromium.launch();
const audits = [];
const screenshots = [];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await login(page);

  let data = await auditLayout(page);
  audits.push({ vp: vp.name, state: 'list', ...data });
  const listPath = path.join(outDir, `${vp.name}-list.png`);
  await page.screenshot({ path: listPath });
  screenshots.push(listPath);

  const preferred = page.locator('.chat-item').filter({ hasText: /News|Coiny|Echo|Community|Saved/i }).first();
  if (await preferred.count()) {
    await preferred.click();
  } else {
    const first = page.locator('.chat-item').first();
    if (await first.count()) await first.click();
  }
  await page.waitForTimeout(500);

  data = await auditLayout(page);
  audits.push({ vp: vp.name, state: 'chat', ...data });
  const chatPath = path.join(outDir, `${vp.name}-chat.png`);
  await page.screenshot({ path: chatPath });
  screenshots.push(chatPath);

  if (await page.locator('.chat-header').count()) {
    await page.locator('.chat-header').click();
    await page.waitForTimeout(350);
    if (await page.locator('.chat-info.open').count()) {
      const infoPath = path.join(outDir, `${vp.name}-info.png`);
      await page.screenshot({ path: infoPath });
      screenshots.push(infoPath);
      const info = await page.evaluate(() => {
        const el = document.querySelector('.chat-info.open');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1) };
      });
      audits.push({ vp: vp.name, state: 'info', info, findings: [] });
      const close = page.locator('.info-close-btn');
      if (await close.count()) await close.click();
    }
  }

  await page.close();
}

// Desktop: open chat and hover reaction affordance presence (CSS)
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await login(page);
  const item = page.locator('.chat-item').filter({ hasText: /News|Echo/i }).first();
  if (await item.count()) await item.click();
  await page.waitForTimeout(400);
  // send a message to ensure bubble exists
  const ta = page.locator('.chat-footer-input textarea, .input-textarea-wrapper textarea').first();
  if (await ta.count()) {
    await ta.fill('Visual review test message — long enough to wrap on narrow layouts ✨');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
  const bubbleAudit = await auditLayout(page);
  audits.push({ vp: 'laptop-1280', state: 'chat-with-own-msg', ...bubbleAudit });
  await page.screenshot({ path: path.join(outDir, 'laptop-1280-own-msg.png') });
  screenshots.push(path.join(outDir, 'laptop-1280-own-msg.png'));
  await page.close();
}

await browser.close();

const issues = [];
for (const a of audits) {
  for (const f of a.findings || []) {
    issues.push({ ...f, vp: a.vp, state: a.state });
  }
}

const summary = audits.map((a) => ({
  vp: a.vp,
  state: a.state,
  sidebarW: a.sidebar?.w,
  chatW: a.chatArea?.w,
  headerH: a.header?.h,
  footerH: a.footer?.h,
  bodyH: a.body?.h,
  bubbles: a.bubbleCount,
  empty: a.emptyVisible,
  chatBack: a.chatBackDisplay,
  bubbleMaxW: a.bubbleMaxW,
  findings: (a.findings || []).length,
  info: a.info,
}));

const report = { summary, issues, screenshots, audits };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ summary, issues }, null, 2));
