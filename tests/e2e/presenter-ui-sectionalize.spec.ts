import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'lumina_session_v1';
const ONBOARDING_KEY = 'lumina_onboarding_v2.2.0';

const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface SeedOptions {
  panelOverrides?: Record<string, '1' | '0'>;
}

const seedPresenterSession = async (
  page: import('@playwright/test').Page,
  options: SeedOptions = {},
) => {
  const key = uniqueKey();
  const itemId = `item-${key}`;
  const slideId = `slide-${key}`;

  await page.addInitScript(
    (payload: {
      session: unknown;
      onboardingKey: string;
      panelOverrides: Record<string, '1' | '0'>;
    }) => {
      // Clear any existing CollapsiblePanel persistence so defaults apply.
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith('lumina.panel.')) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      localStorage.setItem('lumina_session_v1', JSON.stringify(payload.session));
      localStorage.setItem(payload.onboardingKey, 'true');

      Object.entries(payload.panelOverrides).forEach(([panelId, value]) => {
        localStorage.setItem(`lumina.panel.${panelId}`, value);
      });
    },
    {
      session: {
        viewMode: 'PRESENTER',
        schedule: [
          {
            id: itemId,
            title: 'Welcome',
            type: 'ANNOUNCEMENT',
            slides: [{ id: slideId, label: 'Slide 1', content: 'Welcome to Lumina' }],
            theme: {
              backgroundUrl: '',
              fontFamily: 'sans-serif',
              textColor: '#ffffff',
              shadow: true,
              fontSize: 'medium',
            },
          },
        ],
        selectedItemId: itemId,
        activeItemId: itemId,
        activeSlideIndex: 0,
        blackout: false,
        isPlaying: false,
        outputMuted: false,
        routingMode: 'PROJECTOR',
        updatedAt: Date.now(),
      },
      onboardingKey: ONBOARDING_KEY,
      panelOverrides: options.panelOverrides ?? {},
    },
  );

  return {
    sessionParam: `presenter-session-${key}`,
    workspaceParam: `presenter-workspace-${key}`,
  };
};

const presenterUrl = (sessionParam: string, workspaceParam: string) =>
  `/?session=${encodeURIComponent(sessionParam)}&workspace=${encodeURIComponent(workspaceParam)}`;

test.describe('Presenter UI sectionalization', () => {
  test('renders Status Hub pill and preserves header live toggles', async ({ page }) => {
    const { sessionParam, workspaceParam } = await seedPresenterSession(page);
    await page.goto(presenterUrl(sessionParam, workspaceParam));

    await expect(page.getByTestId('studio-session-id-button')).toBeVisible();
    await expect(page.getByTestId('header-launch-live-btn')).toBeVisible();
    await expect(page.getByTestId('header-stage-btn')).toBeVisible();
  });

  test('removes BLACKOUT from header rack but keeps it inside Rundown + Output panel', async ({ page }) => {
    const { sessionParam, workspaceParam } = await seedPresenterSession(page);
    await page.goto(presenterUrl(sessionParam, workspaceParam));

    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    // BLACKOUT must NOT exist anywhere in the header rack.
    await expect(header.getByRole('button', { name: /BLACKOUT/i })).toHaveCount(0);

    // Rundown + Output panel is collapsed by default — expand to reveal BLACKOUT.
    const rundownPanel = page.getByTestId('presenter-panel-rundown-output');
    await expect(rundownPanel).toHaveAttribute('data-collapsed', 'true');

    await page.getByTestId('presenter-panel-rundown-output-header').click();
    await expect(rundownPanel).toHaveAttribute('data-collapsed', 'false');

    // BLACKOUT button now visible inside the panel.
    await expect(rundownPanel.getByRole('button', { name: /BLACKOUT/i })).toBeVisible();
  });

  test('applies smart defaults: Transport + Timer/Cue expanded, Rundown + Output collapsed', async ({ page }) => {
    const { sessionParam, workspaceParam } = await seedPresenterSession(page);
    await page.goto(presenterUrl(sessionParam, workspaceParam));

    await expect(page.getByTestId('presenter-panel-transport')).toHaveAttribute('data-collapsed', 'false');
    await expect(page.getByTestId('presenter-panel-timer-cue')).toHaveAttribute('data-collapsed', 'false');
    await expect(page.getByTestId('presenter-panel-rundown-output')).toHaveAttribute('data-collapsed', 'true');
  });

  test('Rundown + Output expansion persists across reload via localStorage', async ({ page }) => {
    const { sessionParam, workspaceParam } = await seedPresenterSession(page);
    await page.goto(presenterUrl(sessionParam, workspaceParam));

    const rundownPanel = page.getByTestId('presenter-panel-rundown-output');
    await expect(rundownPanel).toHaveAttribute('data-collapsed', 'true');

    await page.getByTestId('presenter-panel-rundown-output-header').click();
    await expect(rundownPanel).toHaveAttribute('data-collapsed', 'false');

    // Confirm the panel wrote its preference to localStorage.
    const storedValue = await page.evaluate(() => localStorage.getItem('lumina.panel.rundown-output'));
    expect(storedValue).toBe('0');

    await page.reload();
    await expect(page.getByTestId('presenter-panel-rundown-output')).toHaveAttribute('data-collapsed', 'false');
  });

  test('Status Hub pill opens popover; Escape and outside click close it', async ({ page }) => {
    const { sessionParam, workspaceParam } = await seedPresenterSession(page);
    await page.goto(presenterUrl(sessionParam, workspaceParam));

    const pill = page.getByTestId('studio-session-id-button');
    await expect(pill).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await pill.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Inner Session row preserves the legacy data-testid.
    await expect(page.getByTestId('status-hub-row-session')).toBeVisible();
    await expect(page.getByTestId('studio-session-id')).toBeVisible();

    // Escape closes the popover.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Reopen and dismiss via outside pointerdown on the page body.
    await pill.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('clicking Session row inside Status Hub closes the popover', async ({ page }) => {
    const { sessionParam, workspaceParam } = await seedPresenterSession(page);
    await page.goto(presenterUrl(sessionParam, workspaceParam));

    await page.getByTestId('studio-session-id-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByTestId('status-hub-row-session').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
