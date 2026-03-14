import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'lumina_session_v1';

const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildSchedule = (key: string, text: string) => {
  const itemId = `item-${key}`;
  return {
    itemId,
    schedule: [
      {
        id: itemId,
        title: 'Welcome',
        type: 'ANNOUNCEMENT',
        slides: [{ id: `slide-${key}`, label: 'Slide 1', content: text }],
        theme: {
          backgroundUrl: '',
          fontFamily: 'sans-serif',
          textColor: '#ffffff',
          shadow: true,
          fontSize: 'medium',
        },
      },
    ],
  };
};

test('output route shows explicit waiting slate when no active item @smoke', async ({ page }) => {
  const key = uniqueKey();
  const { schedule } = buildSchedule(key, 'OUTPUT_WAITING_SENTINEL');

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, {
    schedule,
    activeItemId: null,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    outputMuted: false,
    routingMode: 'PROJECTOR',
    updatedAt: Date.now(),
  });

  await page.goto(`/#/output?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await expect(page.getByText('WAITING FOR LIVE CONTENT')).toBeVisible();
});

test('output route shows blackout slate explicitly @smoke', async ({ page }) => {
  const key = uniqueKey();
  const { itemId, schedule } = buildSchedule(key, 'OUTPUT_BLACKOUT_SENTINEL');

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: true,
    isPlaying: true,
    outputMuted: false,
    routingMode: 'PROJECTOR',
    updatedAt: Date.now(),
  });

  await page.goto(`/#/output?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await expect(page.getByText('BLACKOUT ACTIVE')).toBeVisible();
});

test('stage timer widget can be dragged and resized in web route @smoke', async ({ page }) => {
  const key = uniqueKey();
  const { itemId, schedule } = buildSchedule(key, 'STAGE_TIMER_DRAG_SENTINEL');

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    timerMode: 'COUNTDOWN',
    timerSeconds: -95,
    timerDurationSec: 60,
    timerCueSpeaker: 'Pastor',
    timerCueAmberPercent: 25,
    timerCueRedPercent: 10,
    stageTimerFlash: {
      active: true,
      color: 'amber',
      updatedAt: Date.now(),
    },
    workspaceSettings: {
      stageProfile: 'classic',
      stageFlowLayout: 'balanced',
      stageTimerLayout: {
        x: 40,
        y: 40,
        width: 320,
        height: 140,
        fontScale: 1,
        variant: 'top-left',
        locked: false,
      },
    },
    updatedAt: Date.now(),
  });

  await page.goto(`/#/stage?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);

  await expect(page.getByText('STAGE_TIMER_DRAG_SENTINEL')).toBeVisible();
  await expect(page.getByText('OVERTIME')).toBeVisible();

  const widget = page.getByTestId('stage-timer-widget');
  const dragSurface = page.getByTestId('stage-timer-drag-surface');
  const resizeHandle = page.getByTestId('stage-timer-resize-handle');

  await expect(widget).toBeVisible();
  await expect(dragSurface).toBeVisible();
  await expect(resizeHandle).toBeVisible();
  await expect(widget).toHaveAttribute('data-timer-flash-active', 'true');
  await expect(widget).toHaveAttribute('data-timer-flash-color', 'amber');

  const beforeDrag = await widget.boundingBox();
  expect(beforeDrag).toBeTruthy();

  const dragBox = await dragSurface.boundingBox();
  expect(dragBox).toBeTruthy();
  if (!beforeDrag || !dragBox) {
    throw new Error('Unable to read timer widget bounds before drag');
  }

  await page.mouse.move(dragBox.x + 40, dragBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + 220, dragBox.y + 140, { steps: 18 });
  await page.mouse.up();

  await page.waitForTimeout(150);
  const afterDrag = await widget.boundingBox();
  expect(afterDrag).toBeTruthy();
  if (!afterDrag) {
    throw new Error('Unable to read timer widget bounds after drag');
  }
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 30);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 20);

  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).toBeTruthy();
  if (!resizeBox) {
    throw new Error('Unable to read resize handle bounds');
  }

  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 150, resizeBox.y + 110, { steps: 18 });
  await page.mouse.up();

  await page.waitForTimeout(150);
  const afterResize = await widget.boundingBox();
  expect(afterResize).toBeTruthy();
  if (!afterResize) {
    throw new Error('Unable to read timer widget bounds after resize');
  }
  expect(afterResize.width).toBeGreaterThan(afterDrag.width + 40);
  expect(afterResize.height).toBeGreaterThan(afterDrag.height + 25);
});

test('visionary semantic search fallback is context-aware when AI endpoint fails @smoke', async ({ page }) => {
  await page.route('**/api/ai/semantic-bible-search', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'FORCED_SMOKE_FAILURE' }),
    });
  });

  await page.goto('/');

  const peaceReference = await page.evaluate(async () => {
    const mod = await import('/services/geminiService.ts');
    return mod.semanticBibleSearch('i need peace and comfort');
  });
  expect(peaceReference).toBe('Philippians 4:6-7');

  const fearReference = await page.evaluate(async () => {
    const mod = await import('/services/geminiService.ts');
    return mod.semanticBibleSearch('i am afraid and in panic');
  });
  expect(fearReference).toBe('Isaiah 41:10');
});

test('cloud transcription client maps cooldown responses correctly @smoke', async ({ page }) => {
  await page.route('**/api/ai/transcribe-sermon-chunk', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'TRANSCRIBE_COOLDOWN',
        message: 'Cooling down',
        retryAfterMs: 1800,
      }),
    });
  });

  await page.goto('/');
  const result = await page.evaluate(async () => {
    const mod = await import('/services/geminiService.ts');
    return mod.transcribeSermonChunk({
      audioBase64: 'AA==',
      mimeType: 'audio/webm;codecs=opus',
      locale: 'en-GB',
      workspaceId: 'smoke-workspace',
      sessionId: 'smoke-session',
      clientId: 'smoke-client',
    });
  });

  expect(result.ok).toBeFalsy();
  expect(result.mode).toBe('cooldown');
  expect(Number(result.retryAfterMs || 0)).toBeGreaterThan(0);
});
