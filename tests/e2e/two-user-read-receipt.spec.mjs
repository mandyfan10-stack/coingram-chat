import { test, expect } from '@playwright/test';
import {
  loadE2eAccounts,
  loginAndUnlock,
  openPersonalChat,
  completeE2eeIfNeeded,
  jumpToLatestMessages,
} from './helpers.mjs';

const accounts = loadE2eAccounts();

test.skip(
  accounts.missing.length > 0,
  `Live two-user E2E requires: ${accounts.missing.join(', ')}`,
);

test('read receipt survives reload for both users', async ({ browser }) => {
  test.setTimeout(120_000);
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
    await loginAndUnlock(sender, accounts.first);
    await loginAndUnlock(reader, accounts.second);
    await openPersonalChat(sender, accounts.second.username);
    await openPersonalChat(reader, accounts.first.username);

    await sender.locator('.chat-footer-input textarea, textarea').first().fill(marker);
    const sendBtn = sender.locator('.send-message-btn').first();
    if (await sendBtn.isVisible().catch(() => false)) await sendBtn.click();
    else await sender.keyboard.press('Enter');

    await expect(
      reader.locator('.message-row, .message-bubble, p').filter({ hasText: marker }).first(),
    ).toBeVisible({ timeout: 30_000 });

    await reader.bringToFront().catch(() => {});
    await jumpToLatestMessages(reader);
    await reader.locator('.chat-body').click({ timeout: 5_000 }).catch(() => {});

    const senderMessage = sender.locator('.message-row').filter({ hasText: marker }).last();
    await expect(senderMessage).toBeAttached({ timeout: 15_000 });
    await jumpToLatestMessages(sender);
    await senderMessage.scrollIntoViewIfNeeded();
    await expect(senderMessage.locator('.seen-check.blue')).toBeVisible({ timeout: 30_000 });

    await Promise.all([sender.reload(), reader.reload()]);
    await Promise.all([
      completeE2eeIfNeeded(sender, accounts.first.encryptionPassword),
      completeE2eeIfNeeded(reader, accounts.second.encryptionPassword),
    ]);

    await openPersonalChat(sender, accounts.second.username);
    await openPersonalChat(reader, accounts.first.username);

    const restored = sender.locator('.message-row').filter({ hasText: marker }).last();
    await expect(restored).toBeAttached({ timeout: 20_000 });
    await jumpToLatestMessages(sender);
    await restored.scrollIntoViewIfNeeded();
    await expect(restored).toBeVisible({ timeout: 20_000 });
    await expect(restored.locator('.seen-check.blue')).toBeVisible({ timeout: 20_000 });
    await expect(
      reader.locator('.message-row, .message-bubble, p').filter({ hasText: marker }).first(),
    ).toBeVisible();

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  } finally {
    await Promise.all([
      senderContext.close().catch(() => {}),
      readerContext.close().catch(() => {}),
    ]);
  }
});
