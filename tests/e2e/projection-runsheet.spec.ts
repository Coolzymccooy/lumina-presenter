import { expect, APIRequestContext, test } from '@playwright/test';

const SERVER_BASE_URL = 'http://127.0.0.1:8877';

const ownerHeaders = {
  'x-user-uid': 'e2e-owner',
  'x-user-email': 'owner@e2e.local',
};

const postSessionState = async (
  request: APIRequestContext,
  workspaceId: string,
  sessionId: string,
  state: Record<string, unknown>
) => {
  const endpoint = `${SERVER_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/state`;
  const response = await request.post(
    endpoint,
    {
      headers: ownerHeaders,
      data: { state },
    }
  );
  const bodyText = await response.text();
  expect(response.ok(), `POST ${endpoint} failed: ${response.status()} ${bodyText}`).toBeTruthy();
};

const readSessionState = async (
  request: APIRequestContext,
  workspaceId: string,
  sessionId: string
) => {
  const endpoint = `${SERVER_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/state`;
  const response = await request.get(endpoint);
  const bodyText = await response.text();
  expect(response.ok(), `GET ${endpoint} failed: ${response.status()} ${bodyText}`).toBeTruthy();
  const body = JSON.parse(bodyText);
  return body?.state || {};
};

const parseJsonResponse = async (response: any, endpoint: string) => {
  const bodyText = await response.text();
  expect(response.ok(), `${endpoint} failed: ${response.status()} ${bodyText}`).toBeTruthy();
  return JSON.parse(bodyText);
};

const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test('server session state keeps live fields across partial updates', async ({ request }) => {
  const key = uniqueKey();
  const workspaceId = `e2e-workspace-${key}`;
  const sessionId = `e2e-session-${key}`;

  await postSessionState(request, workspaceId, sessionId, {
    scheduleSnapshot: [{ id: 'welcome' }, { id: 'amazing-grace' }],
    activeItemId: 'amazing-grace',
    activeSlideIndex: 1,
    routingMode: 'PROJECTOR',
  });

  await postSessionState(request, workspaceId, sessionId, {
    scheduleSnapshot: [{ id: 'welcome' }, { id: 'amazing-grace' }, { id: 'sermon' }],
    controllerOwnerEmail: 'owner@e2e.local',
  });

  const afterScheduleOnly = await readSessionState(request, workspaceId, sessionId);
  expect(afterScheduleOnly.activeItemId).toBe('amazing-grace');
  expect(afterScheduleOnly.activeSlideIndex).toBe(1);

  await postSessionState(request, workspaceId, sessionId, {
    activeItemId: 'sermon',
    activeSlideIndex: 0,
  });

  const afterActiveOnly = await readSessionState(request, workspaceId, sessionId);
  expect(afterActiveOnly.activeItemId).toBe('sermon');
  expect(Array.isArray(afterActiveOnly.scheduleSnapshot)).toBeTruthy();
  expect(afterActiveOnly.scheduleSnapshot).toHaveLength(3);
});

test('output route does not fall back to announcements on partial sync updates', async ({ page, request }) => {
  const key = uniqueKey();
  const workspaceId = `e2e-workspace-${key}`;
  const sessionId = `e2e-session-${key}`;

  const announcementText = 'WELCOME_ANNOUNCEMENT_SENTINEL';
  const songText = 'AMAZING_GRACE_LIVE_SENTINEL';
  const welcomeId = `welcome-${key}`;
  const songId = `song-${key}`;
  const schedule = [
    {
      id: welcomeId,
      title: 'Welcome & Announcements',
      type: 'ANNOUNCEMENT',
      slides: [{ id: `welcome-slide-${key}`, label: 'Welcome', content: announcementText }],
      theme: { backgroundUrl: '', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'medium' },
    },
    {
      id: songId,
      title: 'Amazing Grace',
      type: 'SONG',
      slides: [{ id: `song-slide-${key}`, label: 'Verse 1', content: songText }],
      theme: { backgroundUrl: '', fontFamily: 'serif', textColor: '#ffffff', shadow: true, fontSize: 'medium' },
    },
  ];

  const localPresenterState = {
    schedule,
    selectedItemId: welcomeId,
    viewMode: 'PRESENTER',
    activeItemId: songId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    outputMuted: false,
    seekCommand: null,
    seekAmount: 0,
    lowerThirdsEnabled: false,
    routingMode: 'PROJECTOR',
    updatedAt: Date.now(),
  };

  await postSessionState(request, workspaceId, sessionId, {
    scheduleSnapshot: schedule,
    activeItemId: songId,
    activeSlideIndex: 0,
    routingMode: 'PROJECTOR',
    isPlaying: true,
    blackout: false,
  });

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, localPresenterState);

  await page.goto(`/#/output?session=${encodeURIComponent(sessionId)}&workspace=${encodeURIComponent(workspaceId)}`);

  await expect(page.getByText(songText, { exact: false })).toBeVisible();

  await postSessionState(request, workspaceId, sessionId, {
    scheduleSnapshot: schedule,
    controllerOwnerEmail: 'owner@e2e.local',
  });

  await page.waitForTimeout(1800);
  await expect(page.getByText(songText, { exact: false })).toBeVisible();
  await expect(page.getByText(announcementText, { exact: false })).not.toBeVisible();
});

test('projector routing ignores lower thirds overlay', async ({ page }) => {
  const key = uniqueKey();
  const sessionId = `e2e-session-${key}`;
  const workspaceId = `e2e-workspace-${key}`;
  const songText = 'PROJECTOR_FULL_SCREEN_SENTINEL';
  const songId = `song-${key}`;
  const schedule = [
    {
      id: songId,
      title: 'Song',
      type: 'SONG',
      slides: [{ id: `song-slide-${key}`, label: 'Verse 1', content: songText }],
      theme: { backgroundUrl: '', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'medium' },
    },
  ];

  const localPresenterState = {
    schedule,
    selectedItemId: songId,
    viewMode: 'PRESENTER',
    activeItemId: songId,
    activeSlideIndex: 0,
    blackout: false,
    isPlaying: true,
    outputMuted: false,
    seekCommand: null,
    seekAmount: 0,
    lowerThirdsEnabled: true,
    routingMode: 'PROJECTOR',
    updatedAt: Date.now(),
  };

  await page.addInitScript((payload) => {
    localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
  }, localPresenterState);

  await page.goto(`/#/output?session=${encodeURIComponent(sessionId)}&workspace=${encodeURIComponent(workspaceId)}`);

  await expect(page.getByText(songText, { exact: false })).toBeVisible();
  await expect(page.locator('div[class*="bg-black/60"][class*="rounded-2xl"]')).toHaveCount(0);
});

test('run sheet archive endpoints support create/list/rename/reuse/delete', async ({ request }) => {
  const key = uniqueKey();
  const workspaceId = `e2e-workspace-${key}`;
  const title = `Sunday Flow ${key}`;
  const schedule = [
    {
      id: `item-${key}-1`,
      title: 'Opening Prayer',
      type: 'ANNOUNCEMENT',
      slides: [{ id: `slide-${key}-1`, label: 'Open', content: 'Welcome everyone' }],
      theme: { backgroundUrl: '', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'medium' },
    },
    {
      id: `item-${key}-2`,
      title: 'Main Message',
      type: 'SCRIPTURE',
      slides: [{ id: `slide-${key}-2`, label: 'Text', content: 'John 3:16' }],
      theme: { backgroundUrl: '', fontFamily: 'serif', textColor: '#ffffff', shadow: true, fontSize: 'large' },
    },
  ];

  const createEndpoint = `${SERVER_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets`;
  const createResponse = await request.post(createEndpoint, {
    headers: ownerHeaders,
    data: {
      title,
      payload: {
        items: schedule,
        selectedItemId: schedule[0].id,
      },
    },
  });
  const createBody = await parseJsonResponse(createResponse, createEndpoint);
  expect(createBody.ok).toBeTruthy();
  expect(createBody.file?.title).toBe(title);
  const fileId = createBody.file?.fileId;
  expect(typeof fileId).toBe('string');
  expect(fileId.length).toBeGreaterThan(6);

  const listEndpoint = `${SERVER_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets`;
  const listResponse = await request.get(listEndpoint, { headers: ownerHeaders });
  const listBody = await parseJsonResponse(listResponse, listEndpoint);
  expect(listBody.ok).toBeTruthy();
  expect(Array.isArray(listBody.files)).toBeTruthy();
  expect(listBody.files.some((entry: any) => entry.fileId === fileId)).toBeTruthy();

  const renamedTitle = `Renamed ${title}`;
  const renameEndpoint = `${SERVER_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets/${encodeURIComponent(fileId)}`;
  const renameResponse = await request.patch(renameEndpoint, {
    headers: ownerHeaders,
    data: { title: renamedTitle },
  });
  const renameBody = await parseJsonResponse(renameResponse, renameEndpoint);
  expect(renameBody.ok).toBeTruthy();
  expect(renameBody.file?.title).toBe(renamedTitle);

  const reuseEndpoint = `${SERVER_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets/${encodeURIComponent(fileId)}/reuse`;
  const reuseResponse = await request.post(reuseEndpoint, { headers: ownerHeaders });
  const reuseBody = await parseJsonResponse(reuseResponse, reuseEndpoint);
  expect(reuseBody.ok).toBeTruthy();
  expect(Array.isArray(reuseBody.payload?.items)).toBeTruthy();
  expect(reuseBody.payload.items).toHaveLength(2);
  expect(reuseBody.file?.lastUsedAt).toBeTruthy();

  const deleteEndpoint = `${SERVER_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets/${encodeURIComponent(fileId)}`;
  const deleteResponse = await request.delete(deleteEndpoint, { headers: ownerHeaders });
  const deleteBody = await parseJsonResponse(deleteResponse, deleteEndpoint);
  expect(deleteBody.ok).toBeTruthy();

  const listAfterDeleteResponse = await request.get(listEndpoint, { headers: ownerHeaders });
  const listAfterDeleteBody = await parseJsonResponse(listAfterDeleteResponse, listEndpoint);
  expect(listAfterDeleteBody.ok).toBeTruthy();
  expect(listAfterDeleteBody.files.some((entry: any) => entry.fileId === fileId)).toBeFalsy();
});

test('transcribe sermon chunk endpoint validates payload and applies cooldown guard', async ({ request }) => {
  const key = uniqueKey();
  const endpoint = `${SERVER_BASE_URL}/api/ai/transcribe-sermon-chunk`;

  const missingAudioResponse = await request.post(endpoint, {
    data: {
      mimeType: 'audio/webm;codecs=opus',
      locale: 'en-GB',
      workspaceId: `e2e-workspace-${key}`,
      sessionId: `e2e-session-${key}`,
      clientId: `e2e-client-${key}`,
    },
  });
  expect(missingAudioResponse.status()).toBe(400);
  const missingAudioBody = JSON.parse(await missingAudioResponse.text());
  expect(missingAudioBody.error).toBe('AUDIO_REQUIRED');

  const oversizeBase64 = 'A'.repeat(370_000);
  const oversizeResponse = await request.post(endpoint, {
    data: {
      audioBase64: oversizeBase64,
      mimeType: 'audio/webm;codecs=opus',
      locale: 'en-GB',
      workspaceId: `e2e-workspace-${key}-oversize`,
      sessionId: `e2e-session-${key}-oversize`,
      clientId: `e2e-client-${key}-oversize`,
    },
  });
  expect(oversizeResponse.status()).toBe(413);
  const oversizeBody = JSON.parse(await oversizeResponse.text());
  expect(oversizeBody.error).toBe('AUDIO_TOO_LARGE');

  const bucketWorkspace = `e2e-workspace-${key}-cooldown`;
  const bucketSession = `e2e-session-${key}-cooldown`;
  const bucketClient = `e2e-client-${key}-cooldown`;

  const firstAttempt = await request.post(endpoint, {
    data: {
      audioBase64: '!!',
      mimeType: 'audio/webm;codecs=opus',
      locale: 'en-GB',
      workspaceId: bucketWorkspace,
      sessionId: bucketSession,
      clientId: bucketClient,
    },
  });
  expect(firstAttempt.status()).toBe(400);

  let cooldownBody: any = null;
  let cooldownStatus = 0;
  for (let i = 0; i < 6; i += 1) {
    const attempt = await request.post(endpoint, {
      data: {
        audioBase64: '!!',
        mimeType: 'audio/webm;codecs=opus',
        locale: 'en-GB',
        workspaceId: bucketWorkspace,
        sessionId: bucketSession,
        clientId: bucketClient,
      },
    });
    cooldownStatus = attempt.status();
    if (cooldownStatus === 429) {
      cooldownBody = JSON.parse(await attempt.text());
      break;
    }
  }
  expect(cooldownStatus).toBe(429);
  expect(cooldownBody.error).toBe('TRANSCRIBE_COOLDOWN');
  expect(Number(cooldownBody.retryAfterMs || 0)).toBeGreaterThan(0);
});

test('session state preserves stage message center across partial updates', async ({ request }) => {
  const key = uniqueKey();
  const workspaceId = `e2e-workspace-${key}`;
  const sessionId = `e2e-session-${key}`;
  const now = Date.now();

  await postSessionState(request, workspaceId, sessionId, {
    stageMessageCenter: {
      queue: [
        {
          id: `msg-${key}`,
          category: 'urgent',
          text: 'Wrap up sir',
          priority: 'high',
          target: 'stage_only',
          createdAt: now,
          author: 'owner@e2e.local',
        },
      ],
      activeMessageId: `msg-${key}`,
      lastSentAt: now,
    },
    stageAlert: {
      active: true,
      text: 'Wrap up sir',
      updatedAt: now,
      author: 'owner@e2e.local',
    },
    activeItemId: 'item-alpha',
  });

  await postSessionState(request, workspaceId, sessionId, {
    activeSlideIndex: 2,
  });

  const state = await readSessionState(request, workspaceId, sessionId);
  expect(state.activeItemId).toBe('item-alpha');
  expect(state.activeSlideIndex).toBe(2);
  expect(state.stageMessageCenter?.activeMessageId).toBe(`msg-${key}`);
  expect(Array.isArray(state.stageMessageCenter?.queue)).toBeTruthy();
  expect(state.stageMessageCenter.queue[0]?.text).toBe('Wrap up sir');
  expect(state.stageAlert?.text).toBe('Wrap up sir');
});
