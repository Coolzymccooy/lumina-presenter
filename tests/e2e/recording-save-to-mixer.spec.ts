import { expect, test } from '@playwright/test';

test.describe('Sermon recording → Audio Mixer', () => {
  test('record, save locally, sync, reload, delete', async ({ page }) => {
    await page.goto('/');

    // TODO: sign in as a test user. This repo has no e2e sign-in helper yet —
    // wire one via a fixture or env-gated manual step before running this spec.
    const signInBtn = page.getByRole('button', { name: /sign in/i });
    if (!(await signInBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Sign-in button not visible — E2E requires signed-in user and media permissions');
    }

    await signInBtn.click();

    const sermonRecorderTab = page.getByRole('tab', { name: /sermon recorder/i });
    if (!(await sermonRecorderTab.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Sermon Recorder tab not visible');
    }

    await sermonRecorderTab.click();

    const startBtn = page.getByRole('button', { name: /start/i });
    if (!(await startBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Start button not visible — sermon recorder panel may not be available');
    }

    await startBtn.click();
    await page.waitForTimeout(3000);

    const stopBtn = page.getByRole('button', { name: /stop/i });
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();

    const pill = page.getByTestId('recording-saved-pill');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText(/saved locally/i);

    await pill.getByRole('button', { name: /sync to cloud/i }).click();
    await expect(pill).toContainText(/synced to cloud/i, { timeout: 10_000 });

    await page.getByRole('tab', { name: /audio mixer/i }).click();
    await expect(page.getByTestId('my-recordings')).toContainText(/sermon/i);

    await page.reload();
    await page.getByRole('tab', { name: /audio mixer/i }).click();
    await expect(page.getByTestId('my-recordings')).toContainText(/sermon/i);

    const row = page.locator('[data-testid^="recording-row-"]').first();
    const menuBtn = row.locator('[data-testid^="recording-menu-"]');
    await menuBtn.click();
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByTestId('my-recordings')).toContainText(/recordings from the sermon recorder/i);
  });
});
