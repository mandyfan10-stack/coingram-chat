import { test, expect } from '@playwright/test';

const qa = {
  first: {
    username: process.env.E2E_USER_A,
    password: process.env.E2E_PASSWORD_A,
    encryptionPassword: process.env.E2E_ENCRYPTION_PASSWORD_A,
  },
  second: {
    username: process.env.E2E_USER_B,
    password: process.env.E2E_PASSWORD_B,
    encryptionPassword: process.env.E2E_ENCRYPTION_PASSWORD_B,
  },
};

const missingVariables = Object.entries({
  E2E_USER_A: qa.first.username,
  E2E_PASSWORD_A: qa.first.password,
  E2E_ENCRYPTION_PASSWORD_A: qa.first.encryptionPassword,
  E2E_USER_B: qa.second.username,
  E2E_PASSWORD_B: qa.second.password,
  E2E_ENCRYPTION_PASSWORD_B: qa.second.encryptionPassword,
})
  .filter(([, value]) => !value)
  .map(([name]) => name);

test.skip(
  missingVariables.length > 0,
  `Live two-user E2E requires: ${missingVariables.join(', ')}`,
);

async function loginAndUnlock(page, account) {
  await page.goto('/');
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('button[type="submit"]').click();

  const unlockPassword = page.locator('#unlock-password');
  if (await unlockPassword.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await unlockPassword.fill(account.encryptionPassword);
    await page.locator('.e2ee-unlock-password button[type="submit"]').click();
  }

  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
}

async function openPersonalChat(page, username) {
  const existingChat = page.locator('.chat-item').filter({ hasText: username }).first();
  if (await existingChat.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await existingChat.click();
    return;
  }

  const search = page.locator('.sidebar-search input, .search-container input').first();
  await search.fill(username);
  const result = page.locator('.chat-item').filter({ hasText: `@${username}` }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.locator('.chat-header')).toBeVisible();
}

/**
 * Count live remote audio tracks attached by CallContext
 * (hidden <audio class="webrtc-remote-audio-feed"> elements).
 */
async function countRemoteAudioFeeds(page) {
  return page.evaluate(() => {
    const feeds = [...document.querySelectorAll('audio.webrtc-remote-audio-feed')];
    return feeds.filter((el) => {
      const stream = el.srcObject;
      if (!stream || typeof stream.getAudioTracks !== 'function') return false;
      return stream.getAudioTracks().some((track) => track.readyState === 'live');
    }).length;
  });
}

test('two users establish and finish a WebRTC audio call with remote media', async ({ browser }) => {
  const contextOptions = {
    permissions: ['microphone', 'camera'],
  };
  const firstContext = await browser.newContext(contextOptions);
  const secondContext = await browser.newContext(contextOptions);
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();
  const pageErrors = [];

  for (const [label, page] of [['A', firstPage], ['B', secondPage]]) {
    page.on('pageerror', (error) => pageErrors.push(`${label}: ${error.message}`));
  }

  try {
    await Promise.all([
      loginAndUnlock(firstPage, qa.first),
      loginAndUnlock(secondPage, qa.second),
    ]);

    await openPersonalChat(firstPage, qa.second.username);
    await firstPage.locator('.chat-header-btn[title="Информация"]').click();
    await firstPage.locator('.info-action-btn[title="Звонок"]').click();

    const accept = secondPage.locator('.call-accept[title="Ответить на звонок"]');
    await expect(accept).toBeVisible({ timeout: 30_000 });
    await accept.click();

    // Connected UI: duration timer (MM:SS or H:MM:SS)
    const connectedTimer = /^(\d{1,2}:)?\d{2}:\d{2}$/;
    await expect(firstPage.locator('.call-status-subtitle')).toHaveText(connectedTimer, { timeout: 45_000 });
    await expect(secondPage.locator('.call-status-subtitle')).toHaveText(connectedTimer, { timeout: 45_000 });

    // Media path: at least one side should attach a live remote audio feed
    // (fake media devices are enabled in playwright.config.mjs).
    await expect
      .poll(async () => {
        const a = await countRemoteAudioFeeds(firstPage);
        const b = await countRemoteAudioFeeds(secondPage);
        return a + b;
      }, { timeout: 30_000, message: 'expected live webrtc-remote-audio-feed tracks' })
      .toBeGreaterThan(0);

    // Overlay stays active while connected
    await expect(firstPage.locator('.call-overlay-wrapper.active')).toBeVisible();
    await expect(secondPage.locator('.call-overlay-wrapper.active')).toBeVisible();

    await firstPage.locator('.call-hangup[title="Завершить звонок"]').click();
    await expect(secondPage.locator('.call-overlay-wrapper.active')).toBeHidden({ timeout: 15_000 });
    await expect(firstPage.locator('.call-overlay-wrapper.active')).toBeHidden({ timeout: 15_000 });

    // Remote audio elements cleaned up after hangup
    await expect
      .poll(async () => (await countRemoteAudioFeeds(firstPage)) + (await countRemoteAudioFeeds(secondPage)), {
        timeout: 10_000,
      })
      .toBe(0);

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});
