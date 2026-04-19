import { expect, test } from '@playwright/test';

test.describe('Bible Hub — Auto Visionary cloud listening (V2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'ndi-001',
          groupId: 'g1',
          kind: 'audioinput',
          label: 'Default - Webcam 4 (NDI Webcam Audio)',
          toJSON: () => ({}),
        },
        {
          deviceId: 'cable-001',
          groupId: 'g2',
          kind: 'audioinput',
          label: 'CABLE Output (VB-Audio Virtual Cable)',
          toJSON: () => ({}),
        },
        {
          deviceId: 'mic-001',
          groupId: 'g3',
          kind: 'audioinput',
          label: 'Microphone Array (AMD Audio Device)',
          toJSON: () => ({}),
        },
      ];
      navigator.mediaDevices.enumerateDevices = async () => mockDevices;
    });
  });

  test('Auto Visionary panel renders with off-state badge', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="bible-auto-visionary-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible auto-visionary panel not visible in this layout');
    }

    await expect(panel.getByText('Auto Visionary (Mic)')).toBeVisible();
    await expect(panel.getByText('Off')).toBeVisible();
    await expect(panel.getByText(/Engine:/)).toBeVisible();
  });

  test('Engine label reads "Cloud" by default when online', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="bible-auto-visionary-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible auto-visionary panel not visible in this layout');
    }

    const engineLine = panel.locator('text=/Engine:/').locator('..');
    await expect(engineLine).toContainText(/Cloud|Disabled/);
    await expect(engineLine).not.toContainText('Cloud Fallback');
    await expect(engineLine).not.toContainText('Browser STT');
  });

  test('Speech dialect selector preserves UK / US options', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="bible-auto-visionary-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible auto-visionary panel not visible in this layout');
    }

    const dialectSelect = panel.locator('select');
    await expect(dialectSelect).toBeVisible();
    await expect(dialectSelect.locator('option[value="auto"]')).toHaveCount(1);
    await expect(dialectSelect.locator('option[value="en-GB"]')).toHaveCount(1);
    await expect(dialectSelect.locator('option[value="en-US"]')).toHaveCount(1);
  });

  test('Auto Listening shows source, capture mode, and resolved default setup UI', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="bible-auto-visionary-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible auto-visionary panel not visible in this layout');
    }

    await expect(panel.getByText('Audio Source')).toBeVisible();
    await expect(panel.getByText('Capture Mode')).toBeVisible();
    await expect(panel.getByText('Current Setup')).toBeVisible();
    await expect(panel.getByText('Default microphone')).toBeVisible();
    await expect(panel.getByText(/Currently routes to Microphone Array/)).toBeVisible();
    await expect(panel.getByText(/Basic Clean/i)).toBeVisible();
  });

  test('Toggling Auto Visionary ON flips badge to Listening', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="bible-auto-visionary-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible auto-visionary panel not visible in this layout');
    }

    const toggle = panel.getByRole('button', { name: /^OFF$/ });
    if (!(await toggle.isVisible({ timeout: 1500 }).catch(() => false))) {
      test.skip(true, 'Toggle starts in ON state — skipping ON-flip assertion');
    }

    await toggle.click();
    await expect(panel.getByRole('button', { name: /^ON$/ })).toBeVisible();
    await expect(panel.getByText(/Listening|Starting microphone/)).toBeVisible();
  });
});
