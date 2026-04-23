import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const STORAGE_KEY = 'lumina_session_v1';

async function openStudioTab(page: Page, tabName: string) {
  const menuButton = page.getByTestId('studio-menu-button');
  if (await menuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await menuButton.click();
    await page.getByRole('menuitem', { name: new RegExp(tabName, 'i') }).click();
    return;
  }
  if (/schedule/i.test(tabName)) {
    await expect(page.getByTestId('builder-desktop-shell')).toBeVisible();
    return;
  }
  throw new Error(`Studio tab "${tabName}" is not available in the Builder desktop shell`);
}
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
      activeItemId: null as string | null,
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

const seedElectronShell = async (page: Page) => {
  await page.addInitScript(() => {
    (window as any).electron = { isElectron: true };
  });
};

const enterStudio = async (page: Page, key: string) => {
  // Inject Electron shell so the auth gate is skipped (App.tsx bypasses the
  // !user guard when window.electron.isElectron is true) and viewState starts
  // as 'studio' directly without going through the LandingPage.
  await page.addInitScript(() => {
    (window as any).electron = { isElectron: true };
    localStorage.setItem('lumina_guide_state_v1', JSON.stringify({
      completedJourneyIds: ['adding-new-slide'],
      skippedJourneyIds: ['adding-new-slide'],
      dismissedHints: ['auto-adding-new-slide'],
    }));
  });
  void key; // key retained for call-site compatibility
  await page.goto('/');
  await expect(page.locator('[data-testid="studio-menu-button"], [data-testid="builder-desktop-shell"]')).toBeVisible({ timeout: 30_000 });
};

test('uploaded local PNG renders as an image in builder', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const { state } = buildBuilderState(key);

  await seedState(page, state);
  await enterStudio(page, key);
  await openStudioTab(page, 'Schedule');

  await page.getByRole('button', { name: /full editor/i }).click();
  await expect(page.getByText('Add New Slide')).toBeVisible();

  await page.getByTestId('slide-editor-upload-input').setInputFiles({
    name: 'test-image.png',
    mimeType: 'image/png',
    buffer: ICON_PNG,
  });
  await page.getByTestId('slide-editor-confirm').click();

  await expect(page.getByText('Add New Slide')).not.toBeVisible();
  await expect(page.locator('[data-testid^="runsheet-slide-label-"]').first()).toHaveText('test-image');
});

test('multi-image upload inserts multiple image slides with labels', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const { state } = buildBuilderState(key);

  await seedState(page, state);
  await enterStudio(page, key);
  await openStudioTab(page, 'Schedule');

  await page.getByRole('button', { name: /full editor/i }).click();
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

  await page.getByTestId('slide-editor-confirm').click();
  await expect(page.getByText('Add New Slide')).not.toBeVisible();
  const labels = page.locator('[data-testid^="runsheet-slide-label-"]');
  await expect.poll(async () => {
    const texts = await labels.allTextContents();
    return texts.map((text) => text.trim()).filter(Boolean).slice(-3);
  }).toEqual(['test-1', 'test-2', 'test-3']);
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
  await openStudioTab(page, 'Schedule');

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
  await openStudioTab(page, 'Schedule');

  await page.getByTestId(`runsheet-slide-rename-${slideId}`).click();
  await page.getByTestId(`runsheet-slide-rename-input-${slideId}`).fill('Grid Renamed');
  await page.getByTestId(`runsheet-slide-rename-input-${slideId}`).press('Enter');

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
  await openStudioTab(page, 'Schedule');

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

  const expectAllTabsInDropdown = async () => {
    await page.getByTestId('studio-menu-button').click();
    const dropdown = page.getByTestId('studio-menu-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(page.getByTestId('studio-menu-item-schedule')).toBeVisible();
    await expect(page.getByTestId('studio-menu-item-files')).toBeVisible();
    await expect(page.getByTestId('studio-menu-item-audio')).toBeVisible();
    await expect(page.getByTestId('studio-menu-item-bible')).toBeVisible();
    await expect(page.getByTestId('studio-menu-item-audience')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dropdown).toBeHidden();
  };

  await openStudioTab(page, 'Schedule');
  await expect(page.getByRole('heading', { name: 'Run Sheet' })).toBeVisible();
  await expectAllTabsInDropdown();

  await page.getByRole('button', { name: 'PRESENT' }).click();
  await expect(page.getByText('Live Queue')).toBeVisible();
  await expectAllTabsInDropdown();

  await page.getByRole('button', { name: 'BUILD' }).click();
  await expect(page.getByRole('heading', { name: 'Run Sheet' })).toBeVisible();
  await expectAllTabsInDropdown();

  const shellMetrics = await page.getByTestId('studio-shell').evaluate((node) => ({
    scrollLeft: node.scrollLeft,
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(shellMetrics.scrollLeft).toBe(0);

  const railMetrics = await page.getByTestId('studio-menu-root').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  expect(railMetrics.left).toBeGreaterThanOrEqual(0);
  expect(railMetrics.width).toBeGreaterThan(40);
});

test('compact electron presenter keeps the sidebar recoverable on narrow widths', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 820 });
  await seedElectronShell(page);

  const key = uniqueKey();
  const { itemId, state } = buildBuilderState(key, Array.from({ length: 12 }, (_, idx) => ({
    id: `slide-${key}-${idx}`,
    label: `Verse ${idx + 1}`,
    content: `Narrow presenter shell ${idx + 1}`,
    backgroundUrl: '',
    mediaType: 'image',
  })));
  state.activeItemId = itemId;
  state.activeSlideIndex = 0;

  await seedState(page, state);
  await enterStudio(page, key);

  await openStudioTab(page, 'Schedule');
  await expect(page.getByRole('heading', { name: 'Run Sheet' })).toBeVisible();

  await page.getByRole('button', { name: 'PRESENT' }).click();
  await expect(page.getByText('Live Queue')).toBeVisible();
  const transportNextButton = page.getByRole('button', { name: 'NEXT', exact: true });
  await expect(transportNextButton).toBeVisible();

  const menuButton = page.getByTestId('studio-menu-button');
  await expect(menuButton).toBeVisible();

  const railMetrics = await page.getByTestId('studio-menu-root').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  expect(railMetrics.left).toBeGreaterThanOrEqual(0);

  await openStudioTab(page, 'Audio Mixer');
  await expect(transportNextButton).toBeVisible();

  await openStudioTab(page, 'Schedule');
  await expect(transportNextButton).toBeVisible();

  const shellMetrics = await page.getByTestId('studio-shell').evaluate((node) => ({
    scrollLeft: node.scrollLeft,
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(shellMetrics.scrollLeft).toBe(0);

  const nextButtonBox = await transportNextButton.boundingBox();
  expect(nextButtonBox).toBeTruthy();
  if (!nextButtonBox) {
    throw new Error('Unable to read NEXT button bounds');
  }
  expect(nextButtonBox.x).toBeGreaterThan(0);
  expect(nextButtonBox.x + nextButtonBox.width).toBeLessThanOrEqual(1366);
});

test('electron medium presenter keeps runsheet visible without hiding transport controls', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1536, height: 864 });
  await seedElectronShell(page);

  const key = uniqueKey();
  const { itemId, state } = buildBuilderState(key, Array.from({ length: 8 }, (_, idx) => ({
    id: `slide-${key}-${idx}`,
    label: `Verse ${idx + 1}`,
    content: `Medium presenter shell ${idx + 1}`,
    backgroundUrl: '',
    mediaType: 'image',
  })));
  state.activeItemId = itemId;
  state.activeSlideIndex = 0;

  await seedState(page, state);
  await enterStudio(page, key);
  await openStudioTab(page, 'Schedule');

  const panel = page.getByTestId('studio-sidebar-panel');
  const transportNextButton = page.getByRole('button', { name: 'NEXT', exact: true });

  await expect(panel).toBeVisible();

  await page.getByRole('button', { name: 'PRESENT' }).click();
  await expect(panel).toBeVisible();
  await expect(transportNextButton).toBeVisible();

  await page.getByRole('button', { name: 'BUILD' }).click();
  await expect(panel).toBeVisible();

  await page.getByRole('button', { name: 'PRESENT' }).click();
  await expect(panel).toBeVisible();
  await expect(transportNextButton).toBeVisible();

  const panelRect = await panel.boundingBox();
  const nextRect = await transportNextButton.boundingBox();
  expect(panelRect).toBeTruthy();
  expect(nextRect).toBeTruthy();
  if (!panelRect || !nextRect) {
    throw new Error('Unable to read presenter panel or transport button bounds');
  }
  expect(nextRect.x).toBeGreaterThan(panelRect.x + panelRect.width - 4);
});

test('workspace identity fields stay stable through blank hydration until explicitly cleared', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const customSession = `service-${key}`;
  const customEmails = `pastor-${key}@church.org:owner`;
  let servedUpdatedAt = 1000;

  await page.route('**/api/workspaces/*/settings', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          settings: {
            remoteAdminEmails: '',
            sessionId: 'live',
          },
          updatedAt: servedUpdatedAt,
        }),
      });
      return;
    }
    if (method === 'PATCH') {
      servedUpdatedAt = servedUpdatedAt === 1000 ? 2000 : 3000;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          updatedAt: servedUpdatedAt,
        }),
      });
      return;
    }
    await route.fallback();
  });

  const { state } = buildBuilderState(key);
  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Studio Preferences' }).click();
  await page.getByTestId('profile-settings-session-id').fill(customSession);
  await page.getByRole('heading', { name: 'Studio Preferences' }).click();
  await page.getByRole('heading', { name: 'Remote Intelligence' }).click();
  await page.getByTestId('profile-settings-remote-admin-emails').fill(customEmails);
  await page.getByRole('button', { name: /save settings/i }).click();

  await expect(page.getByTestId('studio-session-id-button')).toContainText(customSession);

  await page.reload();
  await enterStudio(page, key);
  await expect(page.getByTestId('studio-session-id-button')).toContainText(customSession);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Studio Preferences' }).click();
  await expect(page.getByTestId('profile-settings-session-id')).toHaveValue(customSession);
  await page.getByRole('heading', { name: 'Studio Preferences' }).click();
  await page.getByRole('heading', { name: 'Remote Intelligence' }).click();
  await expect(page.getByTestId('profile-settings-remote-admin-emails')).toHaveValue(customEmails);

  await page.getByRole('heading', { name: 'Studio Preferences' }).click();
  await page.getByTestId('profile-settings-session-id').fill('live');
  await page.getByRole('heading', { name: 'Studio Preferences' }).click();
  await page.getByRole('heading', { name: 'Remote Intelligence' }).click();
  await page.getByTestId('profile-settings-remote-admin-emails').fill('');
  await page.getByRole('button', { name: /save settings/i }).click();

  await expect(page.getByTestId('studio-session-id-button')).toContainText('live');

  await page.reload();
  await enterStudio(page, key);
  await expect(page.getByTestId('studio-session-id-button')).toContainText('live');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Studio Preferences' }).click();
  await expect(page.getByTestId('profile-settings-session-id')).toHaveValue('live');
  await page.getByRole('heading', { name: 'Studio Preferences' }).click();
  await page.getByRole('heading', { name: 'Remote Intelligence' }).click();
  await expect(page.getByTestId('profile-settings-remote-admin-emails')).toHaveValue('');
});

test('public domain hymn library stays inside the sidebar and inserts into the run sheet', async ({ page }) => {
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

  await openStudioTab(page, 'Hymns');
  await expect(page.getByTestId('hymn-library')).toBeVisible();

  const searchInput = page.getByPlaceholder('Search title, first line, author, tune, theme...');
  await searchInput.fill('Abide with Me');
  await page.getByTestId('hymn-result-abide-with-me-fast-falls-the-eventide').click();
  await expect(page.getByTestId('hymn-insert-button')).toBeVisible();

  const layoutMetrics = await page.locator('[data-testid="hymn-library"]').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      left: rect.left,
      right: rect.right,
    };
  });
  const panelMetrics = await page.getByTestId('studio-sidebar-panel').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
    };
  });

  expect(layoutMetrics.scrollWidth).toBeLessThanOrEqual(layoutMetrics.clientWidth + 1);
  expect(layoutMetrics.left).toBeGreaterThanOrEqual(panelMetrics.left - 1);
  expect(layoutMetrics.right).toBeLessThanOrEqual(panelMetrics.right + 1);
  expect(panelMetrics.width).toBeGreaterThan(240);

  await page.getByTestId('hymn-insert-button').click();
  await openStudioTab(page, 'Schedule');
  await expect(page.getByTestId('studio-sidebar-panel').getByText('Abide with me! fast falls the eventide', { exact: true }).first()).toBeVisible();
});

test('speaker timer studio stays open after save, drags freely, and leaves the studio interactive', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const { state } = buildBuilderState(key, [
    {
      id: `slide-${key}`,
      label: 'Timer Source',
      content: 'Speaker preset studio test',
      backgroundUrl: '',
      mediaType: 'image',
    },
  ]);

  await seedState(page, state);
  await enterStudio(page, key);
  await page.getByRole('button', { name: 'PRESENT' }).click();
  await expect(page.getByText('Live Queue')).toBeVisible();

  // Rundown + Output panel is collapsed by default — expand it to reveal the
  // speaker preset studio open button.
  const rundownPanel = page.getByTestId('presenter-panel-rundown-output');
  if ((await rundownPanel.getAttribute('data-collapsed')) !== 'false') {
    await page.getByTestId('presenter-panel-rundown-output-header').click();
  }
  await expect(rundownPanel).toHaveAttribute('data-collapsed', 'false');

  await page.getByTestId('speaker-preset-studio-open').click();

  const studio = page.getByTestId('speaker-preset-studio');
  const dragHandle = page.getByTestId('speaker-preset-studio-drag-handle');
  const hero = page.getByTestId('speaker-preset-studio-hero');
  const heroTimer = page.getByTestId('speaker-preset-hero-timer');
  const editorScroll = page.getByTestId('speaker-preset-studio-editor-scroll');
  const saveButton = page.getByTestId('speaker-preset-save');
  const standardViewButton = page.getByTestId('speaker-preset-width-standard');
  const wideViewButton = page.getByTestId('speaker-preset-width-wide');

  await expect(studio).toBeVisible();
  await expect(hero).toBeVisible();
  await expect(heroTimer).toBeVisible();
  await expect(saveButton).toBeVisible();
  await studio.getByTestId('speaker-preset-new-draft').click();

  const beforeWide = await studio.boundingBox();
  expect(beforeWide).toBeTruthy();
  await wideViewButton.click();
  await page.waitForTimeout(120);
  const afterWide = await studio.boundingBox();
  expect(afterWide).toBeTruthy();
  if (!beforeWide || !afterWide) {
    throw new Error('Unable to read speaker preset studio width change');
  }
  expect(afterWide.width).toBeGreaterThan(beforeWide.width + 20);
  await standardViewButton.click();
  await page.waitForTimeout(120);

  const beforeDrag = await studio.boundingBox();
  const handleBox = await dragHandle.boundingBox();
  expect(beforeDrag).toBeTruthy();
  expect(handleBox).toBeTruthy();
  if (!beforeDrag || !handleBox) {
    throw new Error('Unable to read speaker preset studio bounds');
  }

  await page.mouse.move(handleBox.x + 60, handleBox.y + 24);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 220, handleBox.y + 120, { steps: 20 });
  await page.mouse.up();

  await page.waitForTimeout(120);
  const afterDrag = await studio.boundingBox();
  expect(afterDrag).toBeTruthy();
  if (!afterDrag) {
    throw new Error('Unable to read speaker preset studio bounds after drag');
  }
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 40);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 25);

  await openStudioTab(page, 'Schedule');
  await expect(page.getByText('Schedule')).toBeVisible();
  await expect(studio).toBeVisible();

  await editorScroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page.waitForTimeout(120);
  await expect(hero).toBeVisible();
  await expect(saveButton).toBeVisible();

  await page.getByTestId('speaker-preset-name-input').fill(`Preset ${key}`);
  await saveButton.click();

  await expect(studio).toBeVisible();
  await expect(saveButton).toContainText(/update/i);
  await expect(page.getByTestId('speaker-preset-studio-status')).toHaveText(/saved just now/i);
  await expect(hero.getByText(`Preset ${key}`)).toBeVisible();
});

test('present mode can launch a queued item without tripping React hook order', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1536, height: 900 });
  const key = uniqueKey();
  const hookErrors: string[] = [];
  const captureHookError = (text: string) => {
    if (text.includes('React error #300') || text.includes('Rendered fewer hooks than expected')) {
      hookErrors.push(text);
    }
  };

  page.on('pageerror', (error) => captureHookError(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      captureHookError(message.text());
    }
  });

  const { state, itemId } = buildBuilderState(key, [
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
  await page.getByRole('button', { name: 'PRESENTER' }).click();
  await openStudioTab(page, 'Schedule');

  await page.locator(`[data-testid="schedule-item-${itemId}"]`).click();
  await expect(page.getByRole('button', { name: /Welcome to service 1\. Intro/i })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  expect(hookErrors).toEqual([]);
});

test('present mode preserves runsheet scroll while hydration settles', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1536, height: 900 });
  const key = uniqueKey();
  const schedule = Array.from({ length: 24 }, (_, idx) => ({
    id: `item-${key}-${idx}`,
    title: `Item ${idx + 1}`,
    type: idx % 2 === 0 ? 'ANNOUNCEMENT' : 'SONG',
    slides: [
      {
        id: `slide-${key}-${idx}`,
        label: `Slide ${idx + 1}`,
        content: `Content ${idx + 1}`,
        backgroundUrl: '',
        mediaType: 'image',
      },
    ],
    theme: {
      backgroundUrl: '',
      mediaType: 'image',
      fontFamily: 'sans-serif',
      textColor: '#ffffff',
      shadow: true,
      fontSize: 'medium',
    },
  }));
  const state = {
    schedule,
    selectedItemId: schedule[0].id,
    activeItemId: schedule[0].id,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    outputMuted: false,
    routingMode: 'PROJECTOR',
    updatedAt: Date.now(),
  };

  await seedState(page, state);
  await enterStudio(page, key);
  await openStudioTab(page, 'Schedule');
  await page.getByRole('button', { name: 'PRESENTER' }).click();

  const runsheet = page.getByTestId('runsheet-list');
  const runsheetMetrics = await runsheet.evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }));
  expect(runsheetMetrics.scrollHeight).toBeGreaterThan(runsheetMetrics.clientHeight);

  await runsheet.evaluate((node) => {
    node.scrollTop = 900;
  });
  await page.waitForTimeout(2500);

  const scrollTop = await runsheet.evaluate((node) => node.scrollTop);
  expect(scrollTop).toBeGreaterThan(400);
});

test('smart slide editor supports preset selection, typing into inspector, and saving', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const key = uniqueKey();
  const { state } = buildBuilderState(key, []);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByRole('button', { name: /full editor/i }).click();
  await expect(page.getByText('Smart Layout Slide Editor')).toBeVisible();

  await page.getByTestId('smart-preset-title-body').click();
  await expect(page.getByTestId('smart-element-content')).toBeVisible();
  await expect(page.getByTestId('smart-element-content')).toHaveValue(/Slide Title/i);

  await page.getByTestId('smart-slide-label').fill('Sunday Welcome');
  await page.getByTestId('smart-element-content').fill('Welcome to Sunday Service');
  await page.getByTestId('smart-element-font-family').selectOption({ label: 'Georgia' });
  await page.getByTestId('smart-element-font-size').fill('72');
  await page.getByTestId('smart-element-italic').click();
  await page.getByTestId('smart-element-underline').click();
  await page.getByTestId('smart-element-line-height').fill('1.3');
  await page.getByTestId('smart-element-letter-spacing').fill('1.5');
  await page.getByTestId('smart-element-text-align').selectOption('center');

  const canvasText = page.getByText('Welcome to Sunday Service', { exact: true }).first();
  await expect(canvasText).toHaveCSS('font-style', 'italic');
  await expect(canvasText).toHaveCSS('text-decoration-line', 'underline');
  await expect.poll(async () => canvasText.evaluate((node) => window.getComputedStyle(node).fontFamily)).toContain('Georgia');

  await page.getByTestId('slide-editor-confirm').click();

  await expect(page.getByText('Smart Layout Slide Editor')).not.toBeVisible();
  await openStudioTab(page, 'Schedule');
  await expect(page.locator('[data-testid^="runsheet-slide-label-"]').first()).toHaveText('Sunday Welcome');
  await expect(page.getByText('Welcome to Sunday Service').first()).toBeVisible();
});

test('smart slide editor supports multiple bullet points and numbered lists', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const key = uniqueKey();
  const { state } = buildBuilderState(key, []);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByRole('button', { name: /full editor/i }).click();
  await expect(page.getByText('Smart Layout Slide Editor')).toBeVisible();

  await page.getByTestId('smart-preset-title-body').click();
  await page.getByTestId('smart-element-content').fill('Prayer\nWorship\nOffering');
  await page.getByTestId('smart-element-bullets').click();
  const bulletList = page.locator('[data-testid^="slide-text-list-"]').first();
  await expect(bulletList.locator('li')).toHaveCount(3);

  await page.getByTestId('smart-element-numbered').click();
  await expect.poll(async () => bulletList.evaluate((node) => window.getComputedStyle(node).listStyleType)).toBe('decimal');

  await page.getByTestId('slide-editor-confirm').click();
  await expect(page.getByText('Smart Layout Slide Editor')).not.toBeVisible();
  await expect(page.getByText('Prayer').first()).toBeVisible();
  await expect(page.getByText('Worship').first()).toBeVisible();
  await expect(page.getByText('Offering').first()).toBeVisible();
});

test('smart slide editor keeps uploaded media slides free of auto text blocks', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const key = uniqueKey();
  const { state } = buildBuilderState(key, []);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByRole('button', { name: /full editor/i }).click();
  await expect(page.getByText('Smart Layout Slide Editor')).toBeVisible();

  await page.getByTestId('slide-editor-upload-input').setInputFiles({
    name: 'smart-media.png',
    mimeType: 'image/png',
    buffer: ICON_PNG,
  });

  await expect(page.getByText('Select a text block to edit its content and style.')).toBeVisible();
  await expect(page.getByTestId('smart-element-content')).toHaveCount(0);
  await page.getByRole('button', { name: 'SAVE' }).click();

  await expect(page.getByText('Smart Layout Slide Editor')).not.toBeVisible();
  await openStudioTab(page, 'Schedule');
  await expect(page.locator('[data-testid^="runsheet-slide-label-"]').first()).toHaveText('smart-media');
});

test('smart slide editor stacked layout keeps inspector visible and editable on tighter screens', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1500, height: 900 });
  const key = uniqueKey();
  const { state } = buildBuilderState(key, []);

  await seedState(page, state);
  await enterStudio(page, key);

  await page.getByRole('button', { name: /full editor/i }).click();
  await expect(page.getByText('Smart Layout Slide Editor')).toBeVisible();
  await page.getByTestId('smart-preset-title-body').click();
  await expect(page.getByTestId('smart-slide-label')).toBeVisible();
  await expect(page.getByTestId('smart-element-content')).toBeVisible();
  await page.getByTestId('smart-slide-label').fill('Stacked Layout');
  await page.getByTestId('smart-element-content').fill('Inspector remains usable.');
  await expect(page.getByTestId('smart-slide-label')).toHaveValue('Stacked Layout');
  await expect(page.getByTestId('smart-element-content')).toHaveValue('Inspector remains usable.');
});



