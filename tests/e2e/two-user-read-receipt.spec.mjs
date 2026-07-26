import { test, expect } from '@playwright/test';

const accounts = {
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
  E2E_USER_A: accounts.first.username,
  E2E_PASSWORD_A: accounts.first.password,
  E2E_ENCRYPTION_PASSWORD_A: accounts.first.encryptionPassword,
  E2E_USER_B: accounts.second.username,
  E2E_PASSWORD_B: accounts.second.password,
  E2E_ENCRYPTION_PASSWORD_B: accounts.second.encryptionPassword,
})
  .filter(([, value]) => !value)
  .map(([name]) => name);

test.skip(
  missingVariables.length > 0,
  `Live two-user E2E requires: ${missingVariables.join(', ')}`,
);

async function unlockIfNeeded(page, encryptionPassword) {
  const unlockPassword = page.locator('#unlock-password');
  if (await unlockPassword.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await unlockPassword.fill(encryptionPassword);
    await page.locator('.e2ee-unlock-password button[type="submit"]').click();
  }
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30_000 });
}

async function login(page, account) {
  await page.goto('/');
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await unlockIfNeeded(page, account.encryptionPassword);
}

async function openPersonalChat(page, username) {
  const existingChat = page.locator(`[data-chat-username="${username}"]`).first();
  if (await existingChat.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await existingChat.click();
  } else {
    const search = page.locator('.search-container input').first();
    await search.fill(username);
    const result = page.locator('.chat-item').filter({ hasText: `@${username}` }).first();
    await expect(result).toBeVisible();
    await result.click();
  }
  await expect(page.locator('.chat-header')).toBeVisible();
}

test('read receipt survives reload for both users', async ({ browser }) => {
  const senderContext = await browser.newContext();
  const readerContext = await browser.newContext();
  const sender = await senderContext.newPage();
  const reader = await readerContext.newPage();
  const pageErrors = [];
  const marker = `E2E-READ-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  for (const [label, page] of [['sender', sender], ['reader', reader]]) {
    page.on('pageerror', error => pageErrors.push(`${label}: ${error.message}`));
  }

  try {
    await Promise.all([
      login(sender, accounts.first),
      login(reader, accounts.second),
    ]);
    await Promise.all([
      openPersonalChat(sender, accounts.second.username),
      openPersonalChat(reader, accounts.first.username),
    ]);

    await sender.locator('.chat-footer-input textarea').fill(marker);
    await sender.locator('.send-message-btn').click();

    const readerMessage = reader.locator('.message-row').filter({ hasText: marker }).last();
    await expect(readerMessage).toBeVisible({ timeout: 30_000 });

    const senderMessage = sender.locator('.message-row').filter({ hasText: marker }).last();
    await expect(senderMessage.locator('.seen-check.blue')).toBeVisible({ timeout: 30_000 });

    await Promise.all([sender.reload(), reader.reload()]);
    await Promise.all([
      unlockIfNeeded(sender, accounts.first.encryptionPassword),
      unlockIfNeeded(reader, accounts.second.encryptionPassword),
    ]);

    const readerChat = reader.locator(`[data-chat-username="${accounts.first.username}"]`).first();
    await expect(readerChat).toBeVisible();
    await expect(readerChat.locator('.unread-badge')).toHaveCount(0);

    await Promise.all([
      openPersonalChat(sender, accounts.second.username),
      openPersonalChat(reader, accounts.first.username),
    ]);

    const restoredSenderMessage = sender.locator('.message-row').filter({ hasText: marker }).last();
    await expect(restoredSenderMessage).toBeVisible();
    await expect(restoredSenderMessage.locator('.seen-check.blue')).toBeVisible();
    await expect(reader.locator('.message-row').filter({ hasText: marker }).last()).toBeVisible();
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);

    await restoredSenderMessage.hover();
    await restoredSenderMessage.locator('.hover-action-btn.delete').click();
    await expect(reader.locator('.message-row').filter({ hasText: marker })).toHaveCount(0);
  } finally {
    await Promise.all([senderContext.close(), readerContext.close()]);
  }
});