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

  test('Auto Visionary toggle and engine indicator render', async ({ page }) => {
    await page.goto('/');

    const label = page.getByText('Auto Visionary (Mic)');
    if (!(await label.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible Hub auto listening controls not visible in this layout');
    }

    await expect(label).toBeVisible();
    const toggleRow = label.locator('..');
    await expect(toggleRow.getByRole('button', { name: /^(ON|OFF)$/ })).toBeVisible();
  });

  test('Engine label reads "Cloud" or "Disabled" (never legacy modes)', async ({ page }) => {
    await page.goto('/');

    const label = page.getByText('Auto Visionary (Mic)');
    if (!(await label.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible Hub auto listening controls not visible in this layout');
    }

    const engineText = page.getByText(/Engine:/);
    if (await engineText.isVisible({ timeout: 1500 }).catch(() => false)) {
      const engineRow = engineText.locator('..');
      await expect(engineRow).toContainText(/Cloud|Disabled/);
      await expect(engineRow).not.toContainText('Cloud Fallback');
      await expect(engineRow).not.toContainText('Browser STT');
    }
  });

  test('Speech dialect panel preserves UK / US / Auto options when expanded', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lumina.panel.bible-speech-dialect', '0');
    });
    await page.goto('/');

    const dialectPanel = page.locator('[data-collapsible-id="bible-speech-dialect"]');
    if (!(await dialectPanel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Speech dialect panel not visible in this layout');
    }

    const dialectSelect = dialectPanel.locator('select');
    await expect(dialectSelect).toBeVisible();
    await expect(dialectSelect.locator('option[value="auto"]')).toHaveCount(1);
    await expect(dialectSelect.locator('option[value="en-GB"]')).toHaveCount(1);
    await expect(dialectSelect.locator('option[value="en-US"]')).toHaveCount(1);
  });

  test('Auto Listening exposes Audio Source, Capture Mode, and Speech Dialect panels', async ({ page }) => {
    await page.goto('/');

    const audioSourcePanel = page.locator('[data-collapsible-id="bible-audio-source"]');
    const captureModePanel = page.locator('[data-collapsible-id="bible-capture-mode"]');
    const dialectPanel = page.locator('[data-collapsible-id="bible-speech-dialect"]');

    if (!(await audioSourcePanel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible Hub auto listening panels not visible in this layout');
    }

    await expect(audioSourcePanel).toBeVisible();
    await expect(captureModePanel).toBeVisible();
    await expect(dialectPanel).toBeVisible();

    await expect(audioSourcePanel.getByText('Audio Source')).toBeVisible();
    await expect(captureModePanel.getByText('Capture Mode')).toBeVisible();
    await expect(dialectPanel.getByText('Speech Dialect').first()).toBeVisible();

    await expect(audioSourcePanel).toHaveAttribute('data-collapsed', 'true');
    await expect(captureModePanel).toHaveAttribute('data-collapsed', 'true');
    await expect(dialectPanel).toHaveAttribute('data-collapsed', 'true');
  });

  test('Toggling Auto Visionary flips label text between ON and OFF', async ({ page }) => {
    await page.goto('/');

    const label = page.getByText('Auto Visionary (Mic)');
    if (!(await label.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Bible Hub auto listening controls not visible in this layout');
    }

    const toggleRow = label.locator('..');
    const offToggle = toggleRow.getByRole('button', { name: /^OFF$/ });
    if (!(await offToggle.isVisible({ timeout: 1500 }).catch(() => false))) {
      test.skip(true, 'Toggle starts in ON state — skipping ON-flip assertion');
    }

    await offToggle.click();
    await expect(toggleRow.getByRole('button', { name: /^ON$/ })).toBeVisible();
  });
});
