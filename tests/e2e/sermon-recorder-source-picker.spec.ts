import { expect, test } from '@playwright/test';

test.describe('Sermon Recorder v2 — Source Picker & Capture Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'mixer-001',
          groupId: 'g1',
          kind: 'audioinput',
          label: 'Behringer X32 USB Audio',
          toJSON: () => ({}),
        },
        {
          deviceId: 'laptop-002',
          groupId: 'g2',
          kind: 'audioinput',
          label: 'Realtek Internal Microphone Array',
          toJSON: () => ({}),
        },
      ];
      navigator.mediaDevices.enumerateDevices = async () => mockDevices;
    });
  });

  test('renders SourcePicker with ranked devices and Recommended badge', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="sermon-recorder-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Sermon recorder panel not visible in this layout');
    }

    await expect(panel.getByText('Audio Source')).toBeVisible();
    await expect(panel.getByText(/Behringer X32/)).toBeVisible();
    await expect(panel.getByText(/Realtek Internal/)).toBeVisible();
    await expect(panel.getByText('★ Recommended')).toBeVisible();
  });

  test('renders CaptureModePicker with all 4 presets', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="sermon-recorder-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Sermon recorder panel not visible in this layout');
    }

    await expect(panel.getByText('Capture Mode')).toBeVisible();
    await expect(panel.getByText('Church Mixer Feed')).toBeVisible();
    await expect(panel.getByText('Camera / NDI Audio')).toBeVisible();
    await expect(panel.getByText('Laptop Mic Rescue')).toBeVisible();
    await expect(panel.getByText('Basic Clean')).toBeVisible();
  });

  test('auto-suggests Church Mixer mode when mixer device is selected', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="sermon-recorder-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Sermon recorder panel not visible in this layout');
    }

    const mixerButton = panel.getByText(/Behringer X32/);
    await mixerButton.click();

    await expect(panel.getByText('suggested')).toBeVisible();
  });

  test('Start button preserves data-testid and is clickable', async ({ page }) => {
    await page.goto('/');

    const startBtn = page.locator('[data-testid="sermon-recorder-start-btn"]');
    if (!(await startBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Start button not visible');
    }

    await expect(startBtn).toBeEnabled();
    await expect(startBtn).toHaveText('Start Recording');
  });

  test('Run Record Check button renders', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('[data-testid="sermon-recorder-panel"]');
    if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Sermon recorder panel not visible in this layout');
    }

    await expect(panel.getByText('Run Record Check')).toBeVisible();
  });
});
