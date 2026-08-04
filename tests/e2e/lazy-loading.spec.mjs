import { test, expect } from '@playwright/test';

const loadedScripts = (page) => page.evaluate(() => (
  performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.js'))
));

test('secondary UI chunks load only when their surfaces open', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('.auth-warning-alert button').click();
  await expect(page.locator('.sidebar')).toBeVisible();

  const initialScripts = await loadedScripts(page);
  expect(initialScripts.some((name) => name.includes('SettingsModal-'))).toBe(false);
  expect(initialScripts.some((name) => name.includes('StickersTab-'))).toBe(false);
  expect(initialScripts.some((name) => name.includes('PulsePanel-'))).toBe(false);
  expect(initialScripts.some((name) => name.includes('CallOverlay-'))).toBe(false);

  await page.locator('.menu-btn[title="Настройки"]').click();
  await page.locator('.drawer-menu-item').filter({ hasText: 'Настройки' }).click();
  await expect(page.locator('.settings-modal-overlay.open')).toBeVisible();
  await expect.poll(async () => (
    (await loadedScripts(page)).some((name) => name.includes('SettingsModal-'))
  )).toBe(true);

  await page.locator('.settings-tab-btn').filter({ hasText: 'Стикеры' }).click();
  await expect.poll(async () => (
    (await loadedScripts(page)).some((name) => name.includes('StickersTab-'))
  )).toBe(true);
  await page.locator('.settings-modal-overlay.open .settings-close-btn').click();

  await page.locator('[data-chat-username="echo_bot"]').click();
  await page.locator('.chat-header').click();
  await page.locator('.info-action-btn[title="Звонок"]').click();
  await expect(page.locator('.call-overlay-wrapper.active')).toBeVisible();
  await expect.poll(async () => (
    (await loadedScripts(page)).some((name) => name.includes('CallOverlay-'))
  )).toBe(true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
