// tests/e2e/ai-engine-web-search.spec.ts
import { test, expect } from '@playwright/test';

test.describe('AI Engine — web lyric search (Tier 2 + 3)', () => {
  test.skip(
    !process.env.AI_WEB_LYRICS_FETCH || process.env.AI_WEB_LYRICS_FETCH !== 'true',
    'AI_WEB_LYRICS_FETCH flag must be ON for this E2E',
  );

  test('LRCLIB hit renders the Tier-2 card @ai-engine', async ({ page }) => {
    await page.route('**/api/lyrics/lrclib', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { hit: { id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...\nPromise keeper...\nMy God...\nThat is who you are' } },
        }),
      }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: /AI Engine/i }).click();
    await page.getByPlaceholder(/search/i).fill('Way Maker Sinach');
    await expect(page.getByText(/Lyrics via LRCLIB/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Generate slides from LRCLIB lyrics/i })).toBeEnabled();
  });

  test('Brave miss surfaces manual-paste hint @ai-engine', async ({ page }) => {
    await page.route('**/api/lyrics/lrclib', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { hit: null } }) }),
    );
    await page.route('**/api/lyrics/web-search', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { results: [] } }) }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: /AI Engine/i }).click();
    await page.getByPlaceholder(/search/i).fill('totally-unknown-song-xyz');
    await expect(page.getByText(/paste/i)).toBeVisible({ timeout: 8000 });
  });
});
