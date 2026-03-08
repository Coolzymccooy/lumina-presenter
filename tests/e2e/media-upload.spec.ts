import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const STORAGE_KEY = 'lumina_session_v1';
const ICON_PNG = readFileSync(path.resolve(process.cwd(), 'public/icon.png'));
const WELCOME_PNG = readFileSync(path.resolve(process.cwd(), 'public/welcome_bg.png'));

const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildBuilderState = (key: string, slides: Array<Record<string, unknown>> = []) => {
  const itemId = `item-${key}`;
  return {
    itemId,
    slideIds: slides.map((slide) => String(slide.id)),
    state: {
      schedule: [
        {
          id: itemId,
          title: 'Media Item',
          type: 'ANNOUNCEMENT',
          slides,
          theme: {
            backgroundUrl: '',
            mediaType: 'image',
            fontFamily: 'sans-serif',
            textColor: '#ffffff',
            shadow: true,
            fontSize: 'medium',
          },
        },
      ],
      selectedItemId: itemId,
      viewMode: 'BUILDER',
      activeItemId: null,
      activeSlideIndex: 0,
      blackout: false,
      isPlaying: true,
      outputMuted: false,
      routingMode: 'PROJECTOR',
      updatedAt: Date.now(),
    },
  };
};

const seedState = async (page: Page, payload: Record<string, unknown>) => {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: payload });
};

const waitForStudioEntryStep = async (page: Page) => {
  const startButton = page.getByRole('button', { name: /start your journey/i });
  const emailInput = page.locator('input[type="email"]');
  const runSheet = page.getByText('RUN SHEET');
  try {
    await Promise.race([
      startButton.waitFor({ state: 'visible', timeout: 8000 }),
      emailInput.waitFor({ state: 'visible', timeout: 8000 }),
      runSheet.waitFor({ state: 'visible', timeout: 8000 }),
    ]);
  } catch {
    // fall through and let the next explicit locator surface the failure
  }
};

const enterStudio = async (page: Page, key: string) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Use in Browser$|^Resume Session$/i }).first().click();

  await waitForStudioEntryStep(page);

  const startButton = page.getByRole('button', { name: /start your journey/i });
  if (await startButton.isVisible().catch(() => false)) {
    await startButton.first().click();
    await waitForStudioEntryStep(page);
  }

  if (await page.getByText('RUN SHEET').isVisible().catch(() => false)) {
    return;
  }

  const email = `playwright-${key}@lumina-e2e.local`;
  const password = 'LuminaE2E!234';

  if (await page.getByText(/no account\? initialize setup/i).isVisible()) {
    await page.getByText(/no account\? initialize setup/i).click();
  }

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await waitForStudioEntryStep(page);

  if (await startButton.isVisible().catch(() => false)) {
    await startButton.first().click();
  }
  await expect(page.getByText('RUN SHEET')).toBeVisible({ timeout: 30000 });
};

test('uploaded local PNG renders as an image in builder', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const { state } = buildBuilderState(key);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByRole('button', { name: /add slide/i }).click();
  await expect(page.getByText('Add New Slide')).toBeVisible();

  await page.getByTestId('slide-editor-upload-input').setInputFiles({
    name: 'test-image.png',
    mimeType: 'image/png',
    buffer: ICON_PNG,
  });
  await page.getByTestId('slide-editor-confirm').click();

  await expect(page.getByText('Add New Slide')).not.toBeVisible();
  await expect(page.locator('[data-testid^="runsheet-slide-label-"]').first()).toHaveText('test-image');
  const renderedImage = page.locator('[data-testid="slide-renderer-image"]').first();
  await expect(renderedImage).toBeVisible();
  await expect(renderedImage).toHaveAttribute('data-media-fit', 'contain');
  await expect(page.locator('[data-testid="slide-renderer-image-backdrop"]').first()).toBeVisible();

  await page.waitForFunction((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const slideUrl = parsed?.schedule?.[0]?.slides?.[0]?.backgroundUrl || '';
    return typeof slideUrl === 'string' && slideUrl.includes('/media/workspaces/');
  }, STORAGE_KEY);

  await expect(page.locator('[data-testid="slide-renderer-video"]')).toHaveCount(0);
});

test('multi-image upload inserts multiple image slides with labels', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const { state } = buildBuilderState(key);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByRole('button', { name: /add slide/i }).click();
  await expect(page.getByText('Add New Slide')).toBeVisible();

  await page.getByTestId('slide-editor-upload-input').setInputFiles([
    {
      name: 'test-1.png',
      mimeType: 'image/png',
      buffer: ICON_PNG,
    },
    {
      name: 'test-2.png',
      mimeType: 'image/png',
      buffer: WELCOME_PNG,
    },
    {
      name: 'test-3.jpeg',
      mimeType: 'image/jpeg',
      buffer: WELCOME_PNG,
    },
  ]);

  await expect(page.getByText('Add New Slide')).not.toBeVisible();
  const labels = page.locator('[data-testid^="runsheet-slide-label-"]');
  await expect(labels).toHaveCount(3);
  await expect(labels).toHaveText(['test-1', 'test-2', 'test-3']);
  await expect(page.locator('[data-testid="slide-renderer-image"]')).toHaveCount(3);
});

test('runsheet slide rename responds directly from the nested list', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const slideId = `slide-${key}`;
  const { state } = buildBuilderState(key, [
    {
      id: slideId,
      label: 'Original Name',
      content: '',
      backgroundUrl: '',
      mediaType: 'image',
    },
  ]);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByTestId(`runsheet-slide-rename-${slideId}`).click();
  await page.getByTestId(`runsheet-slide-rename-input-${slideId}`).fill('Renamed Image');
  await page.getByTestId(`runsheet-slide-rename-input-${slideId}`).press('Enter');

  await expect(page.getByTestId(`runsheet-slide-label-${slideId}`)).toHaveText('Renamed Image');
});

test('thumbnail grid rename is inline on the card label', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const slideId = `slide-${key}`;
  const { state } = buildBuilderState(key, [
    {
      id: slideId,
      label: 'Grid Original',
      content: '',
      backgroundUrl: '',
      mediaType: 'image',
    },
  ]);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByTestId(`thumbnail-slide-rename-${slideId}`).click();
  await page.getByTestId(`thumbnail-slide-rename-input-${slideId}`).fill('Grid Renamed');
  await page.getByTestId(`thumbnail-slide-rename-input-${slideId}`).press('Enter');

  await expect(page.getByTestId(`thumbnail-slide-label-${slideId}`)).toHaveText('Grid Renamed');
  await expect(page.getByTestId(`runsheet-slide-label-${slideId}`)).toHaveText('Grid Renamed');
});

test('runsheet inner collection reorders slides without leaving the item', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const slideA = `slide-a-${key}`;
  const slideB = `slide-b-${key}`;
  const slideC = `slide-c-${key}`;
  const { state } = buildBuilderState(key, [
    {
      id: slideA,
      label: 'Alpha',
      content: '',
      backgroundUrl: '',
      mediaType: 'image',
    },
    {
      id: slideB,
      label: 'Bravo',
      content: '',
      backgroundUrl: '',
      mediaType: 'image',
    },
    {
      id: slideC,
      label: 'Charlie',
      content: '',
      backgroundUrl: '',
      mediaType: 'image',
    },
  ]);

  await seedState(page, state);
  await enterStudio(page, key);

  const labels = page.locator('[data-testid^="runsheet-slide-label-"]');
  await expect(labels).toHaveText(['Alpha', 'Bravo', 'Charlie']);

  await page.getByTestId(`runsheet-slide-down-${slideA}`).click();
  await expect(labels).toHaveText(['Bravo', 'Alpha', 'Charlie']);

  await page.getByTestId(`runsheet-slide-up-${slideC}`).click();
  await expect(labels).toHaveText(['Bravo', 'Charlie', 'Alpha']);
});

test('pinned studio sidebar remains accessible across present and build mode switches', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const { state } = buildBuilderState(key, [
    {
      id: `slide-${key}`,
      label: 'Intro',
      content: 'Welcome to service',
      backgroundUrl: '',
      mediaType: 'image',
    },
  ]);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByTestId('studio-sidebar-pin').click();
  await expect(page.getByText('Schedule')).toBeVisible();
  await expect(page.getByText('Files')).toBeVisible();
  await expect(page.getByText('Audio Mixer')).toBeVisible();
  await expect(page.getByText('Bible Hub')).toBeVisible();
  await expect(page.getByText('Audience')).toBeVisible();

  await page.getByRole('button', { name: 'PRESENT' }).click();
  await expect(page.getByText('Live Queue')).toBeVisible();
  await expect(page.getByText('Schedule')).toBeVisible();
  await expect(page.getByText('Files')).toBeVisible();
  await expect(page.getByText('Audio Mixer')).toBeVisible();

  await page.getByRole('button', { name: 'BUILD' }).click();
  await expect(page.getByText('Run Sheet')).toBeVisible();
  await expect(page.getByText('Schedule')).toBeVisible();
  await expect(page.getByText('Files')).toBeVisible();
  await expect(page.getByText('Audio Mixer')).toBeVisible();
  await expect(page.getByText('Bible Hub')).toBeVisible();
  await expect(page.getByText('Audience')).toBeVisible();

  const shellMetrics = await page.getByTestId('studio-shell').evaluate((node) => ({
    scrollLeft: node.scrollLeft,
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(shellMetrics.scrollLeft).toBe(0);

  const railMetrics = await page.getByTestId('studio-sidebar-rail').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  expect(railMetrics.left).toBeGreaterThanOrEqual(0);
  expect(railMetrics.width).toBeGreaterThan(120);
});
