import { expect, test } from '@playwright/test';

/**
 * E2E coverage for the NDI fill+key routes (#/lyrics-ndi, #/lower-thirds-ndi)
 * and for the structured-slide lowerThirds short-circuit in SlideRenderer.
 *
 * Strategy: seed localStorage['lumina_session_v1'] (polled every 1.2s by
 * useNdiSceneState) and navigate the browser directly to the hash route.
 * No Electron or real NDI senders needed — we're asserting the renderer
 * side of the contract, not the offscreen paint pump.
 */

const STORAGE_KEY = 'lumina_session_v1';
const STATE_POLL_GRACE_MS = 1600; // hook polls localStorage every 1.2s

const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type SlideThemeLike = {
  backgroundUrl: string;
  fontFamily: string;
  textColor: string;
  shadow: boolean;
  fontSize: 'small' | 'medium' | 'large';
};

const defaultTheme = (): SlideThemeLike => ({
  backgroundUrl: '',
  fontFamily: 'serif',
  textColor: '#ffffff',
  shadow: true,
  fontSize: 'medium',
});

type BuildOpts = {
  key: string;
  itemType: 'HYMN' | 'SONG' | 'ANNOUNCEMENT';
  slideContent: string;
  /** When true, also populate slide.elements to simulate an AI-structured hymn. */
  structured?: boolean;
};

const buildSchedule = (opts: BuildOpts) => {
  const itemId = `item-${opts.key}`;
  const slideId = `slide-${opts.key}`;
  const elements = opts.structured
    ? [
        {
          id: `el-text-${opts.key}`,
          type: 'text',
          content: opts.slideContent,
          visible: true,
          zIndex: 1,
          x: 0.1,
          y: 0.4,
          width: 0.8,
          height: 0.2,
          fontSize: 'medium',
          textAlign: 'center',
          color: '#ffffff',
        },
      ]
    : undefined;
  return {
    itemId,
    schedule: [
      {
        id: itemId,
        title: opts.itemType === 'HYMN' ? 'Amazing Grace' : opts.itemType === 'SONG' ? 'Great Is Thy Faithfulness' : 'Welcome',
        type: opts.itemType,
        slides: [{
          id: slideId,
          label: 'Verse 1',
          content: opts.slideContent,
          ...(elements ? { elements } : {}),
        }],
        theme: defaultTheme(),
      },
    ],
  };
};

const seedLocalState = (
  page: import('@playwright/test').Page,
  payload: Record<string, unknown>
) =>
  page.addInitScript(
    ([key, data]) => {
      localStorage.setItem(key as string, JSON.stringify(data));
    },
    [STORAGE_KEY, payload]
  );

// ─── #/lower-thirds-ndi route ────────────────────────────────────────────────

test('lower-thirds NDI route renders nothing when LOWER THIRDS toggle is off', async ({ page }) => {
  const key = uniqueKey();
  const sentinel = `LT_OFF_SENTINEL_${key}`;
  const { itemId, schedule } = buildSchedule({ key, itemType: 'HYMN', slideContent: sentinel });

  await seedLocalState(page, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    lowerThirdsEnabled: false,
    holdScreenMode: 'none',
    routingMode: 'STREAM',
    updatedAt: Date.now(),
  });

  await page.goto(`/#/lower-thirds-ndi?session=ndi-${key}&ndi=1&fillKey=1`);
  await page.waitForTimeout(STATE_POLL_GRACE_MS);

  // Route is gated on lowerThirdsEnabled — with it off, the hymn text must
  // not appear anywhere in the DOM. The wrapper div stays transparent.
  await expect(page.getByText(sentinel)).toHaveCount(0);
});

test('lower-thirds NDI route renders bottom chip when LOWER THIRDS toggle is on', async ({ page }) => {
  const key = uniqueKey();
  const sentinel = `LT_ON_SENTINEL_${key}`;
  const { itemId, schedule } = buildSchedule({ key, itemType: 'HYMN', slideContent: sentinel });

  await seedLocalState(page, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    lowerThirdsEnabled: true,
    holdScreenMode: 'none',
    routingMode: 'STREAM',
    updatedAt: Date.now(),
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/lower-thirds-ndi?session=ndi-${key}&ndi=1&fillKey=1`);
  await page.waitForTimeout(STATE_POLL_GRACE_MS);

  const chip = page.getByText(sentinel);
  await expect(chip).toBeVisible();

  // Chip must sit in the bottom third of the viewport — this is what makes it
  // a "lower third" and distinguishes it from the centered default layout.
  const box = await chip.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.y).toBeGreaterThan(720 * 0.55);
  }
});

test('lower-thirds NDI route honors the toggle even for structured hymn slides', async ({ page }) => {
  // Regression lock for 2d6323a: AI-generated hymns carry slide.elements,
  // which pre-fix routed through ElementRenderer (absolute layout) and
  // bypassed the lowerThirds prop. Verify the short-circuit still fires.
  const key = uniqueKey();
  const sentinel = `LT_STRUCTURED_SENTINEL_${key}`;
  const { itemId, schedule } = buildSchedule({
    key,
    itemType: 'HYMN',
    slideContent: sentinel,
    structured: true,
  });

  await seedLocalState(page, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    lowerThirdsEnabled: true,
    holdScreenMode: 'none',
    routingMode: 'STREAM',
    updatedAt: Date.now(),
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/lower-thirds-ndi?session=ndi-${key}&ndi=1&fillKey=1`);
  await page.waitForTimeout(STATE_POLL_GRACE_MS);

  const chip = page.getByText(sentinel);
  await expect(chip).toBeVisible();
  const box = await chip.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.y).toBeGreaterThan(720 * 0.55);
  }
});

// ─── #/lyrics-ndi route ──────────────────────────────────────────────────────

test('lyrics NDI route renders centered text when an active SONG is live', async ({ page }) => {
  const key = uniqueKey();
  const sentinel = `LYRICS_SONG_SENTINEL_${key}`;
  const { itemId, schedule } = buildSchedule({ key, itemType: 'SONG', slideContent: sentinel });

  await seedLocalState(page, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    lowerThirdsEnabled: false,
    holdScreenMode: 'none',
    routingMode: 'STREAM',
    updatedAt: Date.now(),
  });

  await page.goto(`/#/lyrics-ndi?session=ndi-${key}&ndi=1&fillKey=1`);
  await page.waitForTimeout(STATE_POLL_GRACE_MS);

  await expect(page.getByText(sentinel)).toBeVisible();
});

test('lyrics NDI route renders nothing for a non-lyric item (ANNOUNCEMENT)', async ({ page }) => {
  const key = uniqueKey();
  const sentinel = `LYRICS_ANNOUNCEMENT_SENTINEL_${key}`;
  const { itemId, schedule } = buildSchedule({ key, itemType: 'ANNOUNCEMENT', slideContent: sentinel });

  await seedLocalState(page, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    lowerThirdsEnabled: false,
    holdScreenMode: 'none',
    routingMode: 'STREAM',
    updatedAt: Date.now(),
  });

  await page.goto(`/#/lyrics-ndi?session=ndi-${key}&ndi=1&fillKey=1`);
  await page.waitForTimeout(STATE_POLL_GRACE_MS);

  // Lyrics route intentionally only renders for SONG/HYMN — ANNOUNCEMENT
  // content must never leak onto a fill+key feed destined for a switcher.
  await expect(page.getByText(sentinel)).toHaveCount(0);
});

test('lyrics NDI route stays blank during blackout', async ({ page }) => {
  const key = uniqueKey();
  const sentinel = `LYRICS_BLACKOUT_SENTINEL_${key}`;
  const { itemId, schedule } = buildSchedule({ key, itemType: 'HYMN', slideContent: sentinel });

  await seedLocalState(page, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: true,
    isPlaying: true,
    lowerThirdsEnabled: false,
    holdScreenMode: 'none',
    routingMode: 'STREAM',
    updatedAt: Date.now(),
  });

  await page.goto(`/#/lyrics-ndi?session=ndi-${key}&ndi=1&fillKey=1`);
  await page.waitForTimeout(STATE_POLL_GRACE_MS);

  await expect(page.getByText(sentinel)).toHaveCount(0);
});

// ─── #/output route — structured-slide lowerThirds regression ────────────────

test('output route puts structured hymn text in bottom band when LOWER THIRDS is on', async ({ page }) => {
  // This is the full-output counterpart to the NDI test — validates that
  // the SlideRenderer short-circuit also fires for the actual projector
  // output, not only the fill+key scene.
  const key = uniqueKey();
  const sentinel = `OUTPUT_STRUCTURED_SENTINEL_${key}`;
  const { itemId, schedule } = buildSchedule({
    key,
    itemType: 'HYMN',
    slideContent: sentinel,
    structured: true,
  });

  await seedLocalState(page, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    lowerThirdsEnabled: true,
    holdScreenMode: 'none',
    routingMode: 'STREAM',
    updatedAt: Date.now(),
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/output?session=output-${key}&workspace=output-ws-${key}`);

  const chip = page.getByText(sentinel);
  await expect(chip).toBeVisible();
  const box = await chip.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.y).toBeGreaterThan(720 * 0.55);
  }
});
