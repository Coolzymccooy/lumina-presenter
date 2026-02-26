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
