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

test('output route shows clear hold slate explicitly @smoke', async ({ page }) => {
  const key = uniqueKey();
  const { itemId, schedule } = buildSchedule(key, 'OUTPUT_CLEAR_SENTINEL');

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    holdScreenMode: 'clear',
    isPlaying: true,
    outputMuted: false,
    routingMode: 'PROJECTOR',
    updatedAt: Date.now(),
  });

  await page.goto(`/#/output?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await expect(page.getByText('WAITING FOR LIVE CONTENT')).toBeVisible();
});

test('output route shows logo hold slate explicitly @smoke', async ({ page }) => {
  const key = uniqueKey();
  const { itemId, schedule } = buildSchedule(key, 'OUTPUT_LOGO_SENTINEL');

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    holdScreenMode: 'logo',
    isPlaying: true,
    outputMuted: false,
    routingMode: 'PROJECTOR',
    workspaceSettings: {
      churchName: 'Smoke Test Church',
    },
    updatedAt: Date.now(),
  });

  await page.goto(`/#/output?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await expect(page.getByText('Smoke Test Church')).toBeVisible();
  await expect(page.getByText('Logo Hold')).toBeVisible();
});

test('output route keeps bible text readable on inherited image backgrounds @smoke', async ({ page }) => {
  const key = uniqueKey();
  const itemId = `bible-item-${key}`;
  const verseText = 'And the LORD spake unto Moses, saying,';

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, {
    schedule: [
      {
        id: itemId,
        title: 'Numbers 5:4-11',
        type: 'BIBLE',
        slides: [
          {
            id: `bible-slide-${key}`,
            label: 'Numbers 5:4 (King James Version)',
            content: verseText,
          },
        ],
        metadata: {
          backgroundSource: 'inherited',
          backgroundFallbackUrl: 'https://images.example.com/sunrise.jpg',
          backgroundFallbackMediaType: 'image',
        },
        theme: {
          backgroundUrl: 'https://images.example.com/sunrise.jpg',
          mediaType: 'image',
          fontFamily: 'serif',
          textColor: '#ffffff',
          shadow: true,
          fontSize: 'large',
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
  });

  await page.goto(`/#/output?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await expect(page.getByText(verseText)).toBeVisible();
  await expect(page.getByText('Numbers 5:4 (King James Version)')).toBeVisible();
  await expect(page.locator('div[style*="backdrop-filter: blur(14px)"]')).toBeVisible();
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

  await expect(page.getByText('STAGE_TIMER_DRAG_SENTINEL').first()).toBeVisible();
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

  const persistedStagePage = await page.context().newPage();
  await persistedStagePage.goto(`/#/stage?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await persistedStagePage.waitForTimeout(150);
  const afterReload = await persistedStagePage.getByTestId('stage-timer-widget').boundingBox();
  expect(afterReload).toBeTruthy();
  if (!afterReload) {
    throw new Error('Unable to read timer widget bounds after reload');
  }
  expect(Math.abs(afterReload.x - afterResize.x)).toBeLessThan(20);
  expect(Math.abs(afterReload.y - afterResize.y)).toBeLessThan(20);
  expect(Math.abs(afterReload.width - afterResize.width)).toBeLessThan(24);
  expect(Math.abs(afterReload.height - afterResize.height)).toBeLessThan(24);
  await persistedStagePage.close();
});

test('stage route shows scripture reference badge for current bible slide @smoke', async ({ page }) => {
  const key = uniqueKey();
  const itemId = `stage-bible-${key}`;
  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, {
    schedule: [
      {
        id: itemId,
        title: 'Numbers 1:4-7',
        type: 'BIBLE',
        slides: [
          {
            id: `stage-bible-slide-${key}`,
            label: 'Numbers 1:4 (King James Version)',
            content: 'And with you there shall be a man of every tribe;',
            layoutType: 'scripture_ref',
          },
        ],
        theme: {
          backgroundUrl: '',
          fontFamily: 'serif',
          textColor: '#ffffff',
          shadow: true,
          fontSize: 'large',
        },
      },
    ],
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    workspaceSettings: {
      stageProfile: 'classic',
      stageFlowLayout: 'balanced',
    },
    updatedAt: Date.now(),
  });

  await page.goto(`/#/stage?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await expect(page.getByText('Numbers 1:4-7')).toBeVisible();
  await expect(page.getByText('Ref')).toBeVisible();
  await expect(page.getByText('Numbers 1:4 (King James Version)').first()).toBeVisible();
});

test('stage alert widget drag and resize persist through reload @smoke', async ({ page }) => {
  const key = uniqueKey();
  const { itemId, schedule } = buildSchedule(key, 'STAGE_ALERT_PERSIST_SENTINEL');

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, {
    schedule,
    activeItemId: itemId,
    activeSlideIndex: 0,
    blackout: false,
    stageAlert: {
      active: true,
      text: 'Wrap up now',
      priority: 'high',
      category: 'urgent',
      updatedAt: Date.now(),
    },
    workspaceSettings: {
      stageProfile: 'classic',
      stageFlowLayout: 'balanced',
      stageAlertLayout: {
        x: 120,
        y: 84,
        width: 920,
        height: 140,
        fontScale: 1,
        locked: false,
      },
    },
    updatedAt: Date.now(),
  });

  await page.goto(`/#/stage?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await expect(page.getByText('Wrap up now')).toBeVisible();

  const widget = page.getByTestId('stage-alert-widget');
  const dragSurface = page.getByTestId('stage-alert-drag-surface');
  const resizeHandle = page.getByTestId('stage-alert-resize-handle');

  const beforeDrag = await widget.boundingBox();
  const dragBox = await dragSurface.boundingBox();
  expect(beforeDrag).toBeTruthy();
  expect(dragBox).toBeTruthy();
  if (!beforeDrag || !dragBox) {
    throw new Error('Unable to read stage alert bounds before drag');
  }

  await page.mouse.move(dragBox.x + 120, dragBox.y + 40);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + 260, dragBox.y + 170, { steps: 18 });
  await page.mouse.up();

  const afterDrag = await widget.boundingBox();
  expect(afterDrag).toBeTruthy();
  if (!afterDrag) {
    throw new Error('Unable to read stage alert bounds after drag');
  }
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 40);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 30);

  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).toBeTruthy();
  if (!resizeBox) {
    throw new Error('Unable to read stage alert resize handle');
  }

  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 180, resizeBox.y + 90, { steps: 18 });
  await page.mouse.up();

  await page.waitForTimeout(150);
  const afterResize = await widget.boundingBox();
  expect(afterResize).toBeTruthy();
  if (!afterResize) {
    throw new Error('Unable to read stage alert bounds after resize');
  }
  expect(afterResize.width).toBeGreaterThan(afterDrag.width + 40);
  expect(afterResize.height).toBeGreaterThan(afterDrag.height + 20);

  const persistedStagePage = await page.context().newPage();
  await persistedStagePage.goto(`/#/stage?session=${encodeURIComponent(`smoke-session-${key}`)}&workspace=${encodeURIComponent(`smoke-workspace-${key}`)}`);
  await persistedStagePage.waitForTimeout(150);
  const afterReload = await persistedStagePage.getByTestId('stage-alert-widget').boundingBox();
  expect(afterReload).toBeTruthy();
  if (!afterReload) {
    throw new Error('Unable to read stage alert bounds after reload');
  }
  expect(Math.abs(afterReload.x - afterResize.x)).toBeLessThan(20);
  expect(Math.abs(afterReload.y - afterResize.y)).toBeLessThan(20);
  expect(Math.abs(afterReload.width - afterResize.width)).toBeLessThan(24);
  expect(Math.abs(afterReload.height - afterResize.height)).toBeLessThan(24);
  await persistedStagePage.close();
});

test('saved background registry deduplicates assets and keeps them reusable offline @smoke', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('LuminaMediaDB');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
    const mod = await import('/services/localMedia.ts');
    const file = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'sunrise-beach.jpg', { type: 'image/jpeg' });
    const first = await mod.saveBackgroundAsset(file, {
      mediaType: 'image',
      sourceUrl: 'https://images.example.com/sunrise-beach.jpg',
      provider: 'pexels',
      category: 'Sunrise',
      title: 'Sunrise Beach',
    });
    const second = await mod.saveBackgroundAsset(file, {
      mediaType: 'image',
      sourceUrl: 'https://images.example.com/sunrise-beach.jpg',
      provider: 'pexels',
      category: 'Sunrise',
      title: 'Sunrise Beach',
    });
    const listed = await mod.listSavedBackgrounds();
    return {
      firstId: first?.id || '',
      secondId: second?.id || '',
      total: listed.length,
      provider: listed[0]?.provider || '',
      category: listed[0]?.category || '',
      localUrl: listed[0]?.localUrl || '',
    };
  });

  expect(result.firstId).toBeTruthy();
  expect(result.firstId).toBe(result.secondId);
  expect(result.total).toBe(1);
  expect(result.provider).toBe('pexels');
  expect(result.category).toBe('Sunrise');
  expect(result.localUrl.startsWith('local://')).toBeTruthy();
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

test('background persistence keeps prevailing live visuals for system-generated items only @smoke', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const mod = await import('/services/backgroundPersistence.ts');

    const prevailing = mod.getBackgroundSnapshotFromItem({
      id: 'live-item',
      title: 'Live Item',
      type: 'ANNOUNCEMENT',
      slides: [],
      theme: {
        backgroundUrl: 'https://cdn.example.com/current-motion.mp4',
        mediaType: 'video',
        fontFamily: 'sans-serif',
        textColor: '#ffffff',
        shadow: true,
        fontSize: 'medium',
      },
    } as any, null);

    const systemItem = mod.inheritPrevailingBackground(mod.stampItemBackgroundSource({
      id: 'system-item',
      title: 'Generated Scripture',
      type: 'BIBLE',
      slides: [{ id: 'slide-1', content: 'John 3:16' }],
      theme: {
        backgroundUrl: 'data:image/svg+xml;utf8,default',
        mediaType: 'image',
        fontFamily: 'serif',
        textColor: '#ffffff',
        shadow: true,
        fontSize: 'large',
      },
    } as any, 'system'), prevailing);

    const userItem = mod.inheritPrevailingBackground(mod.stampItemBackgroundSource({
      id: 'user-item',
      title: 'Chosen Media',
      type: 'MEDIA',
      slides: [],
      theme: {
        backgroundUrl: 'local://my-background.jpg',
        mediaType: 'image',
        fontFamily: 'sans-serif',
        textColor: '#ffffff',
        shadow: false,
        fontSize: 'medium',
      },
    } as any, 'user'), prevailing);

    return {
      systemUrl: systemItem.theme.backgroundUrl,
      systemType: systemItem.theme.mediaType,
      systemSource: systemItem.metadata?.backgroundSource,
      userUrl: userItem.theme.backgroundUrl,
      userType: userItem.theme.mediaType,
      userSource: userItem.metadata?.backgroundSource,
    };
  });

  expect(result.systemUrl).toBe('https://cdn.example.com/current-motion.mp4');
  expect(result.systemType).toBe('video');
  expect(result.systemSource).toBe('inherited');
  expect(result.userUrl).toBe('local://my-background.jpg');
  expect(result.userType).toBe('image');
  expect(result.userSource).toBe('user');
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
