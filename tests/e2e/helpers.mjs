/**
 * Shared helpers for live two-user Playwright e2e.
 * Handles first-time E2EE setup as well as unlock on returning devices.
 */

export function loadE2eAccounts() {
  const first = {
    username: process.env.E2E_USER_A,
    password: process.env.E2E_PASSWORD_A,
    encryptionPassword: process.env.E2E_ENCRYPTION_PASSWORD_A,
  };
  const second = {
    username: process.env.E2E_USER_B,
    password: process.env.E2E_PASSWORD_B,
    encryptionPassword: process.env.E2E_ENCRYPTION_PASSWORD_B,
  };

  const missing = Object.entries({
    E2E_USER_A: first.username,
    E2E_PASSWORD_A: first.password,
    E2E_ENCRYPTION_PASSWORD_A: first.encryptionPassword,
    E2E_USER_B: second.username,
    E2E_PASSWORD_B: second.password,
    E2E_ENCRYPTION_PASSWORD_B: second.encryptionPassword,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return { first, second, missing };
}

/**
 * Complete E2EE setup wizard or unlock, then wait until the modal is gone.
 *
 * Important: the app mounts `.sidebar` before the profile-driven E2EE modal
 * appears, so we must wait for the overlay after auth, not only for sidebar.
 */
export async function completeE2eeIfNeeded(page, encryptionPassword) {
  const setupPassword = page.locator('#setup-password');
  const unlockPassword = page.locator('#unlock-password');
  const overlay = page.locator('.e2ee-modal-overlay');
  const sidebar = page.locator('.sidebar');

  // Auth finished when either the main shell or E2EE UI is present.
  await page
    .locator('#setup-password, #unlock-password, .sidebar')
    .first()
    .waitFor({ state: 'visible', timeout: 45_000 });

  // Profile fetch is async — give the setup/unlock modal a short window to mount.
  try {
    await overlay.waitFor({ state: 'visible', timeout: 4_000 });
  } catch {
    // No E2EE modal (already configured + key in IndexedDB, or mock mode).
  }

  if (await setupPassword.isVisible().catch(() => false)) {
    await setupPassword.fill(encryptionPassword);
    await page.locator('#setup-confirm-password').fill(encryptionPassword);
    await page.locator('.e2ee-setup-step-1 .e2ee-submit-btn').click();

    // Prefer recovery-code step; fall back if keys were saved and modal closed
    // (legacy bug before recovery-step mount fix).
    const step2 = page.locator('.e2ee-setup-step-2');
    try {
      await step2.waitFor({ state: 'visible', timeout: 45_000 });
      await page.locator('.e2ee-checkbox-group input[type="checkbox"]').check();
      await page.locator('.e2ee-setup-step-2 .e2ee-submit-btn').click();
    } catch {
      // Setup may have closed the overlay after persisting keys.
    }
  } else if (await unlockPassword.isVisible().catch(() => false)) {
    await unlockPassword.fill(encryptionPassword);
    await page.locator('.e2ee-unlock-password .e2ee-submit-btn, .e2ee-unlock-password button[type="submit"]').first().click();
  }

  // Block until the modal is fully gone so later clicks hit the chat UI.
  if ((await overlay.count()) > 0) {
    await overlay.waitFor({ state: 'hidden', timeout: 45_000 });
  }

  await sidebar.waitFor({ state: 'visible', timeout: 15_000 });
}

export async function loginAndUnlock(page, account) {
  await page.goto('/');
  await page.locator('#username').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await completeE2eeIfNeeded(page, account.encryptionPassword);
}

export async function openPersonalChat(page, username) {
  // Ensure no modal is blocking interactions.
  const overlay = page.locator('.e2ee-modal-overlay');
  if ((await overlay.count()) > 0) {
    await overlay.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  }

  const byData = page.locator(`[data-chat-username="${username}"]`).first();
  if (await byData.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await byData.click();
    await page.locator('.chat-header').waitFor({ state: 'visible' });
    return;
  }

  const existing = page.locator('.chat-item').filter({ hasText: username }).first();
  if (await existing.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await existing.click();
    await page.locator('.chat-header').waitFor({ state: 'visible' });
    return;
  }

  const search = page.locator('.sidebar-search input, .search-container input, input[placeholder*="Поиск"]').first();
  await search.fill(username);
  // Prefer the global-search profile result if present.
  const profileResult = page.locator('button, .chat-item').filter({ hasText: `@${username}` }).first();
  await profileResult.waitFor({ state: 'visible', timeout: 20_000 });
  await profileResult.click();
  await page.locator('.chat-header').waitFor({ state: 'visible', timeout: 20_000 });
}
