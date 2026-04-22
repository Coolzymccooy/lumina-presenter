// tests/e2e/ai-engine-web-search.spec.ts
import { test, expect, type Page } from '@playwright/test';

async function enterStudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lumina_onboarding_v2.2.0', 'true');
    (window as unknown as {
      electron: {
        isElectron: boolean;
        lyricClipboard: {
          arm: () => Promise<{ ok: boolean }>;
          disarm: () => Promise<{ ok: boolean }>;
          onCaptured: () => () => void;
        };
      };
    }).electron = {
      isElectron: true,
      lyricClipboard: {
        arm: async () => ({ ok: false }),
        disarm: async () => ({ ok: true }),
        onCaptured: () => () => {},
      },
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('studio-canvas-root')).toBeVisible({ timeout: 30_000 });
}

async function openAiAssist(page: Page): Promise<void> {
  await page.getByTestId('header-right-dock-btn').click();
  await expect(page.getByTestId('quick-actions-menu')).toBeVisible();
  await page.getByTestId('quick-actions-ai-btn').click();
  await expect(page.getByText(/LUMINA AI ENGINE/i)).toBeVisible();
}

test.describe('AI Engine web lyric search', () => {
  test.skip(
    process.env.AI_WEB_LYRICS_FETCH !== 'true' || process.env.VITE_AI_WEB_LYRICS_FETCH !== 'true',
    'AI_WEB_LYRICS_FETCH and VITE_AI_WEB_LYRICS_FETCH must be ON for this E2E',
  );

  test('LRCLIB hit renders the validated source card @ai-engine', async ({ page }) => {
    await page.route('**/api/lyrics/lrclib', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            hit: {
              id: 1,
              trackName: 'Xqjv Nolumina',
              artistName: 'Lumina Test',
              plainLyrics: 'Line one\nLine two\nLine three',
            },
          },
        }),
      }),
    );

    await enterStudio(page);
    await openAiAssist(page);
    await page.getByPlaceholder(/Amazing Grace lyrics/i).fill('Xqjv Nolumina lyrics');

    await expect(page.getByText(/Lyrics via LRCLIB/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Generate slides from LRCLIB lyrics/i })).toBeEnabled();
  });

  test('Tavily batch source cards require pasted lyrics before slide generation @ai-engine', async ({ page }) => {
    await page.route('**/api/lyrics/lrclib', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { hit: null } }) }),
    );
    await page.route('**/api/lyrics/tavily-search', async (route) => {
      const body = route.request().postDataJSON() as { query?: string };
      const query = String(body?.query || 'Nigerian gospel song').trim();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            results: [{
              title: `${query} Lyrics`,
              url: `https://lyrics.example/${encodeURIComponent(query)}`,
              domain: 'lyrics.example',
              snippet: `Structured source for ${query}`,
              provider: 'tavily',
              score: 0.91,
            }],
          },
        }),
      });
    });
    await page.route('**/api/lyrics/web-search', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { results: [] } }) }),
    );
    await page.route('**/api/ai/generate-slides', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { slides: [{ label: 'Verse 1', content: 'Wetin I go give to you\nYou have done so much' }] } }),
      }),
    );
    await page.route('**/api/ai/suggest-visual-theme', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, keyword: 'worship' }) }),
    );

    await enterStudio(page);
    await openAiAssist(page);

    await page.getByTestId('batch-service-list-input').fill(`Offering
1) Olowogbogboro
2) Ekwueme by Prospa Ochimana`);
    await page.getByRole('button', { name: /^Resolve$/i }).click();

    await expect(page.getByText(/Olowogbogboro Lyrics/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Ekwueme by Prospa Ochimana Lyrics/i)).toBeVisible();

    const firstGenerate = page.locator('button[data-testid="batch-generate"]').first();
    await expect(firstGenerate).toBeDisabled();

    await page.locator('textarea[data-testid^="batch-lyrics-paste"]').first().fill('Olowogbogboro\nThe outstretched hand of God');
    await expect(firstGenerate).toBeEnabled();
    const generateSlidesRequest = page.waitForRequest('**/api/ai/generate-slides', { timeout: 5_000 }).catch(() => null);
    const generateSlidesResponse = page.waitForResponse('**/api/ai/generate-slides', { timeout: 5_000 }).catch(() => null);
    await firstGenerate.scrollIntoViewIfNeeded();
    await firstGenerate.click({ force: true });
    expect(await generateSlidesRequest).not.toBeNull();
    expect((await generateSlidesResponse)?.ok()).toBe(true);
  });
});
