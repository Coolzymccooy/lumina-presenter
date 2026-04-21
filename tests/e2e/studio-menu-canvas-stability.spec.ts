import { test, expect, type Page } from '@playwright/test';

const TABS: Array<{ id: string; label: RegExp }> = [
  { id: 'SCHEDULE', label: /schedule|run sheet/i },
  { id: 'HYMNS', label: /hymns/i },
  { id: 'FILES', label: /files/i },
  { id: 'AUDIO', label: /audio mixer/i },
  { id: 'BIBLE', label: /bible hub/i },
  { id: 'AUDIENCE', label: /audience/i },
  { id: 'MACROS', label: /macros/i },
];

async function enterStudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { electron: { isElectron: boolean } }).electron = { isElectron: true };
  });
  await page.goto('/');
  await expect(page.getByTestId('studio-canvas-root')).toBeVisible({ timeout: 30_000 });
}

async function canvasWidth(page: Page): Promise<number> {
  const handle = await page.getByTestId('studio-canvas-root');
  const box = await handle.boundingBox();
  if (!box) throw new Error('canvas bounding box not available');
  return box.width;
}

test.describe('Studio menu canvas stability', () => {
  test('opening/closing each tab 5x does not shrink the canvas', async ({ page }) => {
    test.setTimeout(120_000);
    await enterStudio(page);
    await page.waitForSelector('[data-testid="studio-menu-button"]');

    const baseline = await canvasWidth(page);

    for (let cycle = 0; cycle < 5; cycle++) {
      for (const tab of TABS) {
        await page.getByTestId('studio-menu-button').click();
        await page.getByRole('menuitem', { name: tab.label }).click();
        await page.getByTestId('studio-menu-button').click();
        await page.getByRole('menuitem', { name: tab.label }).click();
        const width = await canvasWidth(page);
        expect(Math.abs(width - baseline)).toBeLessThanOrEqual(1);
      }
    }
  });

  test('QuickActionsMenu does not affect canvas width', async ({ page }) => {
    await enterStudio(page);
    await page.waitForSelector('[data-testid="header-right-dock-btn"]');
    const baseline = await canvasWidth(page);

    await page.getByTestId('header-right-dock-btn').click();
    await expect(page.getByTestId('quick-actions-menu')).toBeVisible();
    const openWidth = await canvasWidth(page);
    expect(Math.abs(openWidth - baseline)).toBeLessThanOrEqual(1);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('quick-actions-menu')).not.toBeVisible();
    const closedWidth = await canvasWidth(page);
    expect(Math.abs(closedWidth - baseline)).toBeLessThanOrEqual(1);
  });

  test('rapid open/close leaves no stuck overlay', async ({ page }) => {
    await enterStudio(page);
    await page.waitForSelector('[data-testid="studio-menu-button"]');

    for (let i = 0; i < 10; i++) {
      await page.getByTestId('studio-menu-button').click();
      await page.getByTestId('studio-menu-button').click();
    }
    await expect(page.getByTestId('studio-menu-dropdown')).not.toBeVisible();
    await expect(page.getByTestId('quick-actions-menu')).not.toBeVisible();
  });
});
