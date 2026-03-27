import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'lumina_session_v1';
const SETTINGS_KEY = 'lumina_workspace_settings_v1';
const SETTINGS_UPDATED_AT_KEY = 'lumina_workspace_settings_updated_at_v1';

const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildPresenterState = (key: string, presenterExperience: 'classic' | 'next_gen_beta') => {
  const itemId = `item-${key}`;
  return {
    state: {
      schedule: [
        {
          id: itemId,
          title: 'Welcome Item',
          type: 'ANNOUNCEMENT',
          slides: [
            {
              id: `slide-${key}-1`,
              label: 'First',
              content: 'FIRST_PREVIEW_SENTINEL',
              backgroundUrl: '',
              mediaType: 'image',
            },
            {
              id: `slide-${key}-2`,
              label: 'Second',
              content: 'SECOND_PREVIEW_SENTINEL',
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
        },
      ],
      selectedItemId: itemId,
      viewMode: 'PRESENTER',
      activeItemId: itemId,
      activeSlideIndex: 0,
      blackout: false,
      isPlaying: true,
      outputMuted: false,
      routingMode: 'PROJECTOR',
      workspaceSettings: {
        presenterExperience,
        churchName: 'Beta Test Church',
        theme: 'dark',
        stageProfile: 'classic',
        stageFlowLayout: 'balanced',
        machineMode: false,
      },
      updatedAt: Date.now(),
    },
  };
};

const seedState = async (page: Page, payload: Record<string, unknown>) => {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: payload });
};

const seedWorkspaceSettings = async (page: Page, settings: Record<string, unknown>) => {
  await page.addInitScript(({ settingsKey, updatedAtKey, nextSettings }) => {
    localStorage.setItem(settingsKey, JSON.stringify(nextSettings));
    localStorage.setItem(updatedAtKey, String(Date.now()));
  }, {
    settingsKey: SETTINGS_KEY,
    updatedAtKey: SETTINGS_UPDATED_AT_KEY,
    nextSettings: settings,
  });
};

const seedElectronShell = async (page: Page) => {
  await page.addInitScript(() => {
    (window as any).electron = { isElectron: true };
  });
};

const waitForStudioEntryStep = async (page: Page) => {
  const startButton = page.getByRole('button', { name: /start your journey/i });
  const emailInput = page.locator('input[type="email"]');
  const studioShell = page.getByTestId('studio-shell');
  try {
    await Promise.race([
      startButton.waitFor({ state: 'visible', timeout: 8000 }),
      emailInput.waitFor({ state: 'visible', timeout: 8000 }),
      studioShell.waitFor({ state: 'visible', timeout: 8000 }),
    ]);
  } catch {
    // Let the explicit actions below surface any real failure.
  }
};

const enterStudio = async (page: Page, key: string) => {
  await page.goto('/');
  await waitForStudioEntryStep(page);

  if (await page.getByTestId('studio-shell').isVisible().catch(() => false)) {
    return;
  }

  const resumeButton = page.getByRole('button', { name: /^Use in Browser$|^Resume Session$/i }).first();
  if (await resumeButton.isVisible().catch(() => false)) {
    await resumeButton.click();
    await waitForStudioEntryStep(page);
  }

  const startButton = page.getByRole('button', { name: /start your journey/i });
  if (await startButton.isVisible().catch(() => false)) {
    await startButton.first().click();
    await waitForStudioEntryStep(page);
  }

  if (await page.getByTestId('studio-shell').isVisible().catch(() => false)) {
    return;
  }

  const email = `presenter-beta-${key}@lumina-e2e.local`;
  const password = 'LuminaE2E!234';
  const switchToSignup = page.getByText(/no account\? initialize setup/i);
  if (await switchToSignup.isVisible().catch(() => false)) {
    await switchToSignup.click();
  }

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await waitForStudioEntryStep(page);

  if (await startButton.isVisible().catch(() => false)) {
    await startButton.first().click();
  }

  await expect(page.getByTestId('studio-shell')).toBeVisible({ timeout: 30000 });
};

test('classic presenter remains the default workflow when presenter beta is off', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const { state } = buildPresenterState(key, 'classic');

  await seedElectronShell(page);
  await seedState(page, state);
  await enterStudio(page, key);

  await expect(page.getByTestId('presenter-beta-shell')).toHaveCount(0);
  await expect(page.getByText('Live Queue')).toBeVisible();
  await expect(page.getByRole('button', { name: 'BLACKOUT' })).toBeVisible();
  await expect(page.getByText('Presenter Beta')).toHaveCount(0);
});

test('presenter beta supports filmstrip go-live, context actions, and safe hold controls', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const { state } = buildPresenterState(key, 'next_gen_beta');

  await seedElectronShell(page);
  await seedState(page, state);
  await enterStudio(page, key);

  if (!(await page.getByTestId('presenter-beta-shell').isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^Settings$/i }).first().click();
    await page.getByText('Studio Preferences').click();
    const presenterExperienceSelect = page.locator('label:has-text("Presenter Experience")').locator('xpath=following-sibling::select[1]');
    await presenterExperienceSelect.selectOption('next_gen_beta');
    await page.getByRole('button', { name: /synchronize workspace/i }).click();
  }

  await expect(page.getByTestId('presenter-beta-shell')).toBeVisible();
  await expect(page.getByTestId('presenter-library-tray')).toBeVisible();
  await expect(page.getByTestId('presenter-beta-filmstrip')).toBeVisible();
  await expect(page.getByText('Presenter Beta')).toBeVisible();

  const filmstrip = page.getByTestId('presenter-beta-filmstrip');
  const secondSlide = filmstrip.getByRole('button').nth(1);

  await secondSlide.click({ button: 'right' });
  await expect(page.getByText('Preview Slide')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Slide Live' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Preview Slide')).toHaveCount(0);

  await secondSlide.dblclick();

  const livePane = page.getByTestId('presenter-beta-live-pane');
  await expect(livePane.locator('button').filter({ hasText: '2. Second' }).first()).toContainText('Live');

  await page.getByRole('button', { name: /^Clear$/ }).click();
  await expect(page.getByText('WAITING FOR LIVE CONTENT')).toBeVisible();

  await page.getByRole('button', { name: /^Logo$/ }).click();
  await expect(page.getByText('Logo Hold')).toBeVisible();
});
