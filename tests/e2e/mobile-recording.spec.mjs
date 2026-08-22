import { expect, test } from '@playwright/test';
import { enterMockApp } from './helpers.mjs';

async function installMobileRecorderMocks(page, permissionDelay = 0) {
  await page.addInitScript(({ delay }) => {
    window.__mediaPermissionDelay = delay;
    window.__recorderStarts = 0;
    window.__stoppedMediaTracks = 0;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          await new Promise((resolve) => setTimeout(resolve, window.__mediaPermissionDelay));
          const stream = new MediaStream();
          const track = { stop: () => { window.__stoppedMediaTracks += 1; } };
          Object.defineProperty(stream, 'getTracks', {
            configurable: true,
            value: () => [track],
          });
          return stream;
        },
      },
    });

    class MobileSafariMediaRecorder {
      static isTypeSupported(mimeType) {
        return mimeType === 'audio/mp4' || mimeType === 'video/mp4';
      }

      constructor(stream, options = {}) {
        this.stream = stream;
        this.mimeType = options.mimeType || 'audio/mp4';
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
      }

      start() {
        this.state = 'recording';
        window.__recorderStarts += 1;
      }

      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        const data = new Blob([new Uint8Array(2048)], { type: this.mimeType });
        queueMicrotask(() => {
          this.ondataavailable?.({ data });
          this.onstop?.();
        });
      }

      pause() {
        if (this.state === 'recording') this.state = 'paused';
      }

      resume() {
        if (this.state === 'paused') this.state = 'recording';
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MobileSafariMediaRecorder,
    });
  }, { delay: permissionDelay });
}

async function openMobileMockChat(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterMockApp(page);
  await page.getByText('Coiny Community 👥', { exact: true }).click();
  await expect(page.locator('.chat-footer-input')).toBeVisible();
}

async function dispatchRecordPointer(button, type, pointerId, point) {
  await button.dispatchEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: point.x,
    clientY: point.y,
  });
}

async function buttonCenter(button) {
  const box = await button.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('releasing during a mobile permission prompt does not start a ghost recording', async ({ page }) => {
  await installMobileRecorderMocks(page, 550);
  await openMobileMockChat(page);

  const recordButton = page.locator('.record-message-btn');
  await expect(recordButton).toHaveAttribute('aria-label', 'Голосовое сообщение');
  const point = await buttonCenter(recordButton);
  await dispatchRecordPointer(recordButton, 'pointerdown', 41, point);
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: 'Подготовка записи' })).toBeVisible();
  await dispatchRecordPointer(recordButton, 'pointerup', 41, point);
  await page.waitForTimeout(650);

  await expect(page.locator('.recording-panel')).toHaveCount(0);
  expect(await page.evaluate(() => window.__recorderStarts)).toBe(0);
  expect(await page.evaluate(() => window.__stoppedMediaTracks)).toBe(1);
});

test('mobile voice and round-video recording fit the viewport and preserve MP4', async ({ page }) => {
  await installMobileRecorderMocks(page);
  await openMobileMockChat(page);

  const recordButton = page.locator('.record-message-btn');
  await expect(recordButton).toHaveAttribute('aria-label', 'Голосовое сообщение');
  let point = await buttonCenter(recordButton);
  await dispatchRecordPointer(recordButton, 'pointerdown', 51, point);
  await page.waitForTimeout(300);
  await expect(page.locator('.recording-panel')).toBeVisible();

  await dispatchRecordPointer(recordButton, 'pointermove', 51, { x: point.x, y: point.y - 100 });
  await dispatchRecordPointer(recordButton, 'pointerup', 51, { x: point.x, y: point.y - 100 });
  const lockedPanel = page.locator('.recording-panel.locked');
  await expect(lockedPanel).toBeVisible();
  const lockedBounds = await lockedPanel.boundingBox();
  expect(lockedBounds.x).toBeGreaterThanOrEqual(0);
  expect(lockedBounds.x + lockedBounds.width).toBeLessThanOrEqual(390);
  await lockedPanel.locator('.record-control-btn.btn-send').click();

  const voice = page.locator('.voice-player-bubble').last();
  await expect(voice).toBeVisible();
  await expect(voice.locator('audio')).toHaveAttribute('src', /^data:audio\/mp4/);

  await expect(recordButton).toBeEnabled();
  point = await buttonCenter(recordButton);
  await dispatchRecordPointer(recordButton, 'pointerdown', 52, point);
  await dispatchRecordPointer(recordButton, 'pointerup', 52, point);
  await expect(recordButton).toHaveAttribute('aria-label', 'Видеосообщение');

  point = await buttonCenter(recordButton);
  await dispatchRecordPointer(recordButton, 'pointerdown', 53, point);
  await page.waitForTimeout(300);
  const preview = page.locator('.video-record-preview-overlay');
  await expect(preview).toBeVisible();
  const previewCircle = await preview.locator('.video-record-circle').boundingBox();
  expect(previewCircle.x).toBeGreaterThanOrEqual(0);
  expect(previewCircle.x + previewCircle.width).toBeLessThanOrEqual(390);
  await dispatchRecordPointer(recordButton, 'pointerup', 53, point);

  const videoNote = page.locator('.round-video-wrapper').last();
  await expect(videoNote).toBeVisible();
  await expect(videoNote.locator('video')).toHaveAttribute('src', /^data:video\/mp4/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
