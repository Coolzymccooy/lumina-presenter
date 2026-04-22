import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'lumina_session_v1';
const SETTINGS_KEY = 'lumina_workspace_settings_v1';
const SETTINGS_UPDATED_AT_KEY = 'lumina_workspace_settings_updated_at_v1';

const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const textElement = (id: string, content: string) => ({
  id,
  type: 'text',
  name: 'Body',
  role: 'body',
  content,
  frame: { x: 0.1, y: 0.18, width: 0.8, height: 0.5, zIndex: 1 },
  visible: true,
  locked: false,
  style: {
    fontFamily: 'sans-serif',
    fontSize: 56,
    fontWeight: 700,
    fontStyle: 'normal',
    textAlign: 'center',
    verticalAlign: 'middle',
    lineHeight: 1.15,
    letterSpacing: 0,
    textTransform: 'none',
    color: '#ffffff',
    shadow: 'none',
    outlineWidth: 0,
    padding: 16,
    backgroundColor: 'transparent',
    opacity: 1,
  },
});

const slide = (id: string, label: string, content: string, elementId: string) => ({
  id,
  label,
  content,
  type: 'custom',
  layoutType: 'single',
  elements: [textElement(elementId, content)],
  backgroundUrl: '',
  mediaType: 'image',
  mediaFit: 'cover',
  metadata: {},
});

const item = (id: string, title: string, slides: ReturnType<typeof slide>[]) => ({
  id,
  title,
  type: 'ANNOUNCEMENT',
  slides,
  theme: {
    backgroundUrl: '',
    mediaType: 'image',
    fontFamily: 'sans-serif',
    textColor: '#ffffff',
    shadow: true,
    fontSize: 'medium',
  },
});

const buildState = (key: string, viewMode: 'BUILDER' | 'PRESENTER' = 'BUILDER') => {
  const firstItem = item(`item-worship-${key}`, 'Worship Flow', [
    slide(`slide-intro-${key}`, 'Intro', 'Welcome to worship', `el-intro-${key}`),
    slide(`slide-chorus-${key}`, 'Chorus', 'Chorus lyrics', `el-chorus-${key}`),
  ]);
  const secondItem = item(`item-sermon-${key}`, 'Sermon Notes', [
    slide(`slide-sermon-${key}`, 'Message', 'Sermon opener', `el-sermon-${key}`),
  ]);

  return {
    ids: {
      firstItemId: firstItem.id,
      secondItemId: secondItem.id,
      introSlideId: firstItem.slides[0].id,
      chorusSlideId: firstItem.slides[1].id,
      sermonSlideId: secondItem.slides[0].id,
      introElementId: firstItem.slides[0].elements[0].id,
    },
    state: {
      runSheetTitle: 'Sunday Run Sheet',
      schedule: [firstItem, secondItem],
      selectedItemId: firstItem.id,
      viewMode,
      activeItemId: null as string | null,
      activeSlideIndex: -1,
      blackout: false,
      isPlaying: true,
      outputMuted: false,
      routingMode: 'PROJECTOR',
      updatedAt: Date.now(),
    },
  };
};

const enterStudio = async (
  page: Page,
  state: Record<string, unknown>,
  settings: Record<string, unknown> = {},
) => {
  await page.addInitScript(({ sessionState, workspaceSettings, storageKey, settingsKey, settingsUpdatedAtKey }) => {
    (window as any).electron = { isElectron: true };
    if (!sessionStorage.getItem('lumina_builder_shell_e2e_seeded')) {
      localStorage.clear();
      localStorage.setItem('lumina_onboarding_v2.2.0', 'true');
      localStorage.setItem('lumina_guide_state_v1', JSON.stringify({
        completedJourneyIds: ['adding-new-slide'],
        skippedJourneyIds: ['adding-new-slide'],
        dismissedHints: ['auto-adding-new-slide'],
      }));
      localStorage.setItem(storageKey, JSON.stringify(sessionState));
      if (Object.keys(workspaceSettings).length > 0) {
        localStorage.setItem(settingsKey, JSON.stringify(workspaceSettings));
        localStorage.setItem(settingsUpdatedAtKey, String(Date.now()));
      }
      sessionStorage.setItem('lumina_builder_shell_e2e_seeded', 'true');
    }
  }, {
    sessionState: state,
    workspaceSettings: settings,
    storageKey: STORAGE_KEY,
    settingsKey: SETTINGS_KEY,
    settingsUpdatedAtKey: SETTINGS_UPDATED_AT_KEY,
  });

  await page.goto('/');
};

test('builder renders inside the shared desktop shell and follows run sheet and strip selection', async ({ page }) => {
  const key = uniqueKey();
  const { ids, state } = buildState(key);

  await enterStudio(page, state);

  await expect(page.getByTestId('builder-desktop-shell')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('builder-editable-canvas')).toBeVisible();
  await expect(page.getByTestId('builder-canvas-ribbon')).toBeVisible();
  await expect(page.getByTestId('builder-slide-timeline')).toBeVisible();
  await expect(page.getByTestId('builder-right-rail')).toBeVisible();
  await expect(page.getByTestId('builder-slide-content-trigger')).toBeVisible();
  await expect(page.getByTestId('builder-bottom-dock')).toBeVisible();
  await expect(page.getByTestId('builder-runsheet-title-input')).toHaveValue('Sunday Run Sheet');

  await expect(page.getByTestId(`builder-slide-strip-item-${ids.introSlideId}`)).toBeVisible();
  await page.getByTestId(`builder-slide-strip-item-${ids.chorusSlideId}`).click();
  await expect(page.getByTestId('builder-editable-canvas')).toContainText('Chorus');

  await page.getByTestId(`schedule-item-${ids.secondItemId}`).click();
  await expect(page.getByTestId(`builder-slide-strip-item-${ids.sermonSlideId}`)).toBeVisible();
  await expect(page.getByTestId('builder-editable-canvas')).toContainText('Sermon opener');
});

test('builder run sheet title persists and long run sheets scroll above the fixed status bay', async ({ page }) => {
  const key = uniqueKey();
  const { state } = buildState(key);
  const longItems = Array.from({ length: 18 }, (_, index) => item(`item-extra-${key}-${index}`, `Extra Item ${index + 1}`, [
    slide(`slide-extra-${key}-${index}`, `Extra ${index + 1}`, `Extra content ${index + 1}`, `el-extra-${key}-${index}`),
  ]));
  const longState = {
    ...state,
    schedule: [...(state.schedule as any[]), ...longItems],
  };

  await enterStudio(page, longState);

  const titleInput = page.getByTestId('builder-runsheet-title-input');
  await expect(titleInput).toBeVisible({ timeout: 30_000 });
  await titleInput.fill('Easter Sunday Flow');
  await titleInput.blur();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByTestId('builder-runsheet-title-input')).toHaveValue('Easter Sunday Flow');

  await page.getByTestId('runsheet-list').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(page.getByTestId(`schedule-item-item-extra-${key}-17`)).toBeVisible();
  await expect(page.getByTestId('builder-runsheet-status-bay')).toBeVisible();
});

test('canvas ribbon quick edit updates the selected slide', async ({ page }) => {
  const key = uniqueKey();
  const { ids, state } = buildState(key);

  await enterStudio(page, state);

  await expect(page.getByTestId('builder-canvas-ribbon')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('builder-slide-content-trigger').click();
  const quickEditArea = page.getByTestId('builder-slide-content-quick-edit').locator('[contenteditable="true"]');
  await expect(quickEditArea).toBeVisible();
  await quickEditArea.fill('Ribbon edited text');
  await page.waitForTimeout(250);

  await page.getByTestId(`builder-slide-strip-item-${ids.chorusSlideId}`).click();
  await page.getByTestId(`builder-slide-strip-item-${ids.introSlideId}`).click();
  await expect(page.getByTestId('builder-editable-canvas')).toContainText('Ribbon edited text');
});

test('background drawer and cue drawer are docked Builder compartments', async ({ page }) => {
  const key = uniqueKey();
  const { state } = buildState(key);

  await enterStudio(page, state);

  await page.getByTestId('builder-open-background-drawer').click();
  await expect(page.getByTestId('builder-background-drawer')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('builder-background-static-0').click();
  await expect(page.getByTestId('builder-background-drawer')).toBeVisible();

  await page.getByTestId('builder-open-cue-drawer').click();
  await expect(page.getByTestId('builder-cue-drawer')).toBeVisible();
  await expect(page.getByTestId('builder-background-drawer')).not.toBeVisible();
  await expect(page.getByTestId('builder-slide-timeline')).toBeVisible();
  await page.getByTestId('builder-cue-drawer').getByRole('checkbox').first().check();
  await expect(page.getByTestId('builder-open-cue-drawer')).toContainText(/cue 5m/i);
});

test('inline Builder canvas text edits persist to the selected slide and can go live', async ({ page }) => {
  const key = uniqueKey();
  const { ids, state } = buildState(key);

  await enterStudio(page, state);

  await expect(page.getByTestId('builder-desktop-shell')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId(`smart-canvas-element-${ids.introElementId}`).click();
  const inlineInput = page.getByTestId(`smart-canvas-element-${ids.introElementId}-input`);
  await expect(inlineInput).toBeVisible();
  await inlineInput.fill('Edited worship text');
  await inlineInput.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');

  await page.getByTestId(`builder-slide-strip-item-${ids.chorusSlideId}`).click();
  await page.getByTestId(`builder-slide-strip-item-${ids.introSlideId}`).click();
  await expect(page.getByTestId('builder-editable-canvas')).toContainText('Edited worship text');

  await page.getByTestId('builder-bottom-dock').getByRole('button', { name: /go live/i }).click();
  await expect(page.getByTestId('builder-slide-timeline').getByText(/live/i)).toBeVisible();
  await expect(page.getByTestId('builder-right-rail')).toContainText('Worship Flow');
});

test('presenter beta still uses the shared desktop shell and can send a slide live', async ({ page }) => {
  const key = uniqueKey();
  const { state } = buildState(key, 'PRESENTER');

  await enterStudio(page, state, { presenterExperience: 'next_gen_beta' });

  await expect(page.getByTestId('presenter-beta-shell')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('presenter-beta-shell').getByRole('button', { name: /^Go Live$/ }).click();
  await expect(page.getByText('No item currently live')).not.toBeVisible();
  await expect(page.getByTestId('presenter-beta-shell')).toContainText('Worship Flow');
  await expect(page.getByText('Welcome to worship').first()).toBeVisible();
});
