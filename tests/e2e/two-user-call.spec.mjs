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

test('two users establish and finish a WebRTC audio call', async ({ browser }) => {
  const firstContext = await browser.newContext({ permissions: ['microphone', 'camera'] });
  const secondContext = await browser.newContext({ permissions: ['microphone', 'camera'] });
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

    const connectedTimer = /^(\d{1,2}:)?\d{2}:\d{2}$/;
    await expect(firstPage.locator('.call-status-subtitle')).toHaveText(connectedTimer, { timeout: 45_000 });
    await expect(secondPage.locator('.call-status-subtitle')).toHaveText(connectedTimer, { timeout: 45_000 });

    await firstPage.locator('.call-hangup[title="Завершить звонок"]').click();
    await expect(secondPage.locator('.call-overlay-wrapper.active')).toBeHidden({ timeout: 15_000 });
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});
