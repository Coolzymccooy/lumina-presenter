import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'lumina_session_v1';
const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test('output route advances between visual slides and then text slides without keeping the previous image', async ({ page }) => {
  test.setTimeout(120_000);
  const key = uniqueKey();
  const itemId = `visual-item-${key}`;

  const state = {
    schedule: [
      {
        id: itemId,
        title: 'Visual Deck',
        type: 'MEDIA',
        slides: [
          {
            id: `image-a-${key}`,
            label: 'Image A',
            content: '',
            backgroundUrl: `/icon.png?${key}-a`,
            mediaType: 'image',
          },
          {
            id: `image-b-${key}`,
            label: 'Image B',
            content: '',
            backgroundUrl: `/welcome_bg.png?${key}-b`,
            mediaType: 'image',
          },
          {
            id: `text-${key}`,
            label: 'Text',
            content: 'The Lord is good',
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
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    outputMuted: false,
    routingMode: 'PROJECTOR',
    updatedAt: Date.now(),
  };

  await page.addInitScript(({ storageKey, payload }) => {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, { storageKey: STORAGE_KEY, payload: state });

  await page.goto(`/#/output?session=${encodeURIComponent(`visual-${key}`)}`);

  const renderedImage = page.getByTestId('slide-renderer-image').first();
  await expect(renderedImage).toHaveAttribute('src', new RegExp(`icon\\.png\\?${key}-a`));

  await page.evaluate((storageKey) => {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
    parsed.activeSlideIndex = 1;
    parsed.updatedAt = Date.now();
    localStorage.setItem(storageKey, JSON.stringify(parsed));
  }, STORAGE_KEY);

  await expect(renderedImage).toHaveAttribute('src', new RegExp(`welcome_bg\\.png\\?${key}-b`), { timeout: 5_000 });

  await page.evaluate((storageKey) => {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
    parsed.activeSlideIndex = 2;
    parsed.updatedAt = Date.now();
    localStorage.setItem(storageKey, JSON.stringify(parsed));
  }, STORAGE_KEY);

  await expect(page.getByText('The Lord is good')).toBeVisible({ timeout: 5_000 });
});
