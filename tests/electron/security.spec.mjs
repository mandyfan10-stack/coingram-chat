import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('desktop rejects navigation escape and unauthorized display capture', async () => {
  const application = await electron.launch({ args: [projectRoot] });
  const window = await application.firstWindow();
  await expect.poll(() => window.url()).toMatch(/^app:\/\/coiny\/index\.html/);

  for (const target of ['file:///C:/Windows/System32/calc.exe', 'javascript:document.body.textContent="owned"', 'custom://escape']) {
    await window.evaluate((url) => { window.location.href = url; }, target).catch(() => undefined);
    await window.waitForTimeout(100);
    expect(window.url()).toMatch(/^app:\/\/coiny\//);
  }

  const captureResult = await window.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return 'granted';
    } catch {
      return 'rejected';
    }
  });
  expect(captureResult).toBe('rejected');
  await application.close();
});
