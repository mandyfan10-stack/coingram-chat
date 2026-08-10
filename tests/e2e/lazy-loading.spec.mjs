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
  await expect.poll(() => page.evaluate(() => document.activeElement?.className || '')).toContain('settings-close-btn');

  await page.locator('.settings-tab-btn').filter({ hasText: 'Стикеры' }).click();
  await expect.poll(async () => (
    (await loadedScripts(page)).some((name) => name.includes('StickersTab-'))
  )).toBe(true);
  const settingsOverlay = page.locator('.settings-container[role="dialog"]').locator('..');
  const settingsCloseButton = page.locator('.settings-modal-overlay.open .settings-close-btn');
  await settingsCloseButton.click();
  await expect(settingsOverlay).toBeHidden();
  await expect(page.locator('.menu-btn[title="Настройки"]')).toBeFocused();

  await page.locator('[data-chat-username="echo_bot"]').click();
  await page.locator('.chat-header').click();
  await page.locator('.info-action-btn[title="Звонок"]').click();
  await expect(page.locator('.call-overlay-wrapper.active')).toBeVisible();
  await expect.poll(async () => (
    (await loadedScripts(page)).some((name) => name.includes('CallOverlay-'))
  )).toBe(true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});

test('settings focus and presence remain stable during rapid mobile reopen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.locator('.auth-warning-alert button').click();
  await expect(page.locator('.sidebar')).toBeVisible();

  const menuButton = page.locator('.menu-btn[title="Настройки"]');
  const settingsItem = page.locator('.drawer-menu-item').filter({ hasText: 'Настройки' });
  const dialog = page.locator('.settings-container[role="dialog"]');
  const overlay = dialog.locator('..');
  const closeButton = dialog.locator('.settings-close-btn');
  const saveButton = dialog.locator('.settings-btn.save');

  await menuButton.click();
  await settingsItem.click();
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();

  const bounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(360);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(800);

  await page.keyboard.press('Shift+Tab');
  await expect(saveButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();

  await closeButton.click();
  await menuButton.click();
  await settingsItem.click();
  await expect(overlay).toBeVisible();
  await page.waitForTimeout(350);
  await expect(overlay).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test('settings honors reduced motion without delayed focus restoration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.auth-warning-alert button').click();

  const menuButton = page.locator('.menu-btn[title="Настройки"]');
  await menuButton.click();
  await page.locator('.drawer-menu-item').filter({ hasText: 'Настройки' }).click();

  const dialog = page.locator('.settings-container[role="dialog"]');
  const overlay = dialog.locator('..');
  await expect(dialog.locator('.settings-close-btn')).toBeFocused();

  const motion = await dialog.evaluate((element) => ({
    transform: getComputedStyle(element).transform,
    transitionDuration: getComputedStyle(element).transitionDuration,
  }));
  expect(motion.transform).toBe('none');
  expect(motion.transitionDuration.split(',').every((value) => Number.parseFloat(value) <= 0.001)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(menuButton).toBeFocused();
});
