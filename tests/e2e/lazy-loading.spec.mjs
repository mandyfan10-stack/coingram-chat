import { test, expect } from '@playwright/test';
import { enterMockApp } from './helpers.mjs';

const loadedScripts = (page) => page.evaluate(() => (
  performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.js'))
));

test('secondary UI chunks load only when their surfaces open', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await enterMockApp(page);

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

  await page.locator('.settings-nav-item').filter({ hasText: 'Стикеры' }).click();
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
  await page.getByRole('button', { name: 'Звонок', exact: true }).click();
  await expect(page.locator('.call-overlay-wrapper.active')).toBeVisible();
  await expect.poll(async () => (
    (await loadedScripts(page)).some((name) => name.includes('CallOverlay-'))
  )).toBe(true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});

test('settings focus and presence remain stable during rapid mobile reopen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await enterMockApp(page);

  const menuButton = page.locator('.menu-btn[title="Настройки"]');
  const settingsItem = page.locator('.drawer-menu-item').filter({ hasText: 'Настройки' });
  const dialog = page.locator('.settings-container[role="dialog"]');
  const overlay = dialog.locator('..');
  const closeButton = dialog.locator('.settings-close-btn');
  const firstFocusable = dialog.locator('.settings-sidebar-profile');
  const saveButton = dialog.locator('.settings-btn.save');
  const settingsBody = dialog.locator('.settings-body');
  const settingsFooter = dialog.locator('.settings-footer');
  const settingsNav = dialog.locator('.settings-nav-list');

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

  const assertMobileSettingsGeometry = async () => {
    const geometry = await dialog.evaluate((element) => {
      const body = element.querySelector('.settings-body');
      const footer = element.querySelector('.settings-footer');
      const nav = element.querySelector('.settings-nav-list');
      const elementRect = element.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      return {
        dialogBottom: elementRect.bottom,
        bodyBottom: bodyRect.bottom,
        footerBottom: footerRect.bottom,
        bodyClientWidth: body.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        navClientWidth: nav.clientWidth,
        navScrollWidth: nav.scrollWidth,
      };
    });
    expect(geometry.bodyBottom).toBeLessThanOrEqual(geometry.footerBottom);
    expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.dialogBottom + 1);
    expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.bodyClientWidth);
    expect(geometry.navScrollWidth).toBeLessThanOrEqual(geometry.navClientWidth);
    await expect(settingsFooter).toBeVisible();
  };

  await assertMobileSettingsGeometry();
  await expect(settingsNav.locator('.settings-nav-item')).toHaveCount(4);

  for (const label of ['Оформление', 'Стикеры', 'Шифрование', 'Мой профиль']) {
    await settingsNav.locator('.settings-nav-item').filter({ hasText: label }).click();
    await assertMobileSettingsGeometry();
  }

  const inviteGeometry = await settingsBody.locator('.invite-link-wrapper').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(inviteGeometry.scrollWidth).toBeLessThanOrEqual(inviteGeometry.clientWidth);

  await firstFocusable.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(saveButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstFocusable).toBeFocused();

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
  await enterMockApp(page);

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
