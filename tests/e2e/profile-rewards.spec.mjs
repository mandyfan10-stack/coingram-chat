import { expect, test } from '@playwright/test';

async function enterMockApp(page) {
  await page.goto('/');
  await page.locator('.auth-warning-alert button').click();
  await expect(page.locator('.sidebar')).toBeVisible();
}

async function openProfileSettings(page) {
  const menuButton = page.locator('.menu-btn[title="Настройки"]');
  await menuButton.click();
  await page.locator('.drawer-menu-item').filter({ hasText: 'Мой профиль' }).click();
  const dialog = page.getByRole('dialog', { name: 'Профиль' });
  await expect(dialog).toBeVisible();
  return { dialog, menuButton };
}

test('custom profile styling is gone from mock settings', async ({ page }) => {
  await enterMockApp(page);
  const { dialog } = await openProfileSettings(page);

  await expect(page.locator('.drawer-menu-item').filter({ hasText: 'Оформление профиля' })).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Своё оформление' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /^(Загрузить|Заменить|Снять)$/ })).toHaveCount(0);
  await expect(dialog.getByText('Рамка')).toHaveCount(0);
  await expect(dialog.getByText('Значок')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Загрузить обложку' })).toBeVisible();
});

test('profile banner keeps fixed geometry and the form scrolls at 806x590', async ({ page }) => {
  await page.setViewportSize({ width: 806, height: 590 });
  await enterMockApp(page);
  const { dialog } = await openProfileSettings(page);
  const preview = dialog.getByTestId('live-profile-preview');
  const banner = dialog.getByTestId('profile-preview-banner');
  const avatar = dialog.getByTestId('profile-preview-avatar');
  await expect(preview).toBeVisible();

  const [previewBox, bannerBox, avatarBox] = await Promise.all([
    preview.boundingBox(), banner.boundingBox(), avatar.boundingBox(),
  ]);
  expect(previewBox.height).toBeGreaterThanOrEqual(230);
  expect(bannerBox.height).toBeGreaterThanOrEqual(110);
  expect(avatarBox.height).toBeGreaterThanOrEqual(80);
  await expect(avatar).toHaveCSS('overflow', 'visible');

  const bodyGeometry = await dialog.locator('.settings-body').evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }));
  expect(bodyGeometry.scrollHeight).toBeGreaterThan(bodyGeometry.clientHeight);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(806);
});
