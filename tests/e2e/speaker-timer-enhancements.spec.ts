import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'lumina_session_v1';
const uniqueKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildTimerState = (key: string, overrides: Record<string, unknown> = {}) => {
  const itemId = `item-${key}`;
  return {
    itemId,
    state: {
      schedule: [
        {
          id: itemId,
          title: 'Sunday Message',
          type: 'ANNOUNCEMENT',
          slides: [{ id: `slide-${key}`, label: 'Slide 1', content: `TIMER_TEST_${key}` }],
          theme: { backgroundUrl: '', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'medium' },
          timerCue: {
            enabled: true,
            durationSec: 300,
            speakerName: 'Pastor Jordan',
            autoStartNext: false,
            amberPercent: 25,
            redPercent: 10,
            presetId: 'preset-test-1',
          },
        },
      ],
      activeItemId: itemId,
      activeSlideIndex: 0,
      blackout: false,
      isPlaying: true,
      outputMuted: false,
      routingMode: 'PROJECTOR',
      timerMode: 'COUNTDOWN',
      timerSeconds: 300,
      timerDurationSec: 300,
      timerCueSpeaker: 'Pastor Jordan',
      timerCueAmberPercent: 25,
      timerCueRedPercent: 10,
      workspaceSettings: {
        stageProfile: 'classic',
        stageFlowLayout: 'balanced',
        timerChimesEnabled: true,
        speakerTimerPresets: [
          {
            id: 'preset-test-1',
            name: 'Pastor Main',
            durationSec: 2100,
            amberPercent: 25,
            redPercent: 10,
            autoStartNextDefault: false,
            speakerName: 'Pastor Jordan',
            chimeOnAmber: true,
            chimeOnRed: true,
            chimeOnMilestones: false,
            overtimeBehavior: undefined,
          },
          {
            id: 'preset-test-2',
            name: 'Announcement',
            durationSec: 300,
            amberPercent: 25,
            redPercent: 10,
            autoStartNextDefault: true,
            speakerName: 'Host',
            chimeOnAmber: true,
            chimeOnRed: true,
            chimeOnMilestones: true,
            overtimeBehavior: 'stop',
          },
          {
            id: 'preset-test-3',
            name: 'Flash Stop Test',
            durationSec: 600,
            amberPercent: 30,
            redPercent: 15,
            autoStartNextDefault: false,
            speakerName: 'Guest',
            chimeOnAmber: false,
            chimeOnRed: true,
            chimeOnMilestones: false,
            overtimeBehavior: 'flash-and-stop',
          },
        ],
        stageTimerLayout: {
          x: 24,
          y: 24,
          width: 360,
          height: 150,
          fontScale: 1,
          variant: 'top-right',
          locked: false,
          showWallClock: false,
        },
      },
      updatedAt: Date.now(),
      ...overrides,
    },
  };
};

// ═══════════════════════════════════════════════════════════
// PHASE 1: Stage Timer Widget — Progress Ring + Visual Polish
// ═══════════════════════════════════════════════════════════

test.describe('Phase 1: Progress Ring & Visual Polish', () => {

  test('stage timer widget shows SVG progress ring in countdown mode', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: 200,
      timerDurationSec: 300,
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    // Progress ring SVG should be present (non-compact-bar variant)
    const ring = widget.locator('svg circle').first();
    await expect(ring).toBeVisible();
  });

  test('progress ring color is emerald in runway zone', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: 250, // 83% remaining — well within runway (amber at 25%)
      timerDurationSec: 300,
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    // The colored stroke circle should have emerald color
    const rings = widget.locator('svg circle');
    const coloredRing = rings.nth(1); // second circle is the progress arc
    await expect(coloredRing).toHaveAttribute('stroke', /52,211,153/);
  });

  test('progress ring color is amber in amber zone', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: 60, // 20% remaining — in amber zone (amber=25%, red=10%)
      timerDurationSec: 300,
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    const rings = widget.locator('svg circle');
    const coloredRing = rings.nth(1);
    await expect(coloredRing).toHaveAttribute('stroke', /252,211,77/);
  });

  test('progress ring color is red in red zone', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: 15, // 5% remaining — in red zone (red=10%)
      timerDurationSec: 300,
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    const rings = widget.locator('svg circle');
    const coloredRing = rings.nth(1);
    await expect(coloredRing).toHaveAttribute('stroke', /248,113,113/);
  });

  test('compact-bar variant shows linear progress bar instead of ring', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: 200,
      timerDurationSec: 300,
    });
    (state.workspaceSettings as Record<string, unknown>).stageTimerLayout = {
      x: 400, y: 600, width: 540, height: 84, fontScale: 0.9,
      variant: 'compact-bar', locked: false, showWallClock: false,
    };

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    // Compact bar should NOT have SVG ring
    await expect(widget.locator('svg')).toHaveCount(0);
  });

  test('timer widget has smooth color transition styling', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    // Widget should have transition styling
    const style = await widget.getAttribute('style');
    expect(style).toContain('transition');
  });

  test('timer digits use tabular-nums font variant', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    const timerDigits = widget.locator('.font-mono.font-black').first();
    await expect(timerDigits).toBeVisible();

    const fontVariant = await timerDigits.evaluate((el) =>
      window.getComputedStyle(el).fontVariantNumeric,
    );
    expect(fontVariant).toContain('tabular-nums');
  });

  test('overtime state shows red auto-glow animation class', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: -30,
      timerDurationSec: 300,
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    // Should have overtime pulse class
    const className = await widget.getAttribute('class');
    expect(className).toContain('lumina-timer-overtime-pulse');
  });

  test('red zone shows red-glow animation class', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: 15, // 5% — red zone
      timerDurationSec: 300,
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    const className = await widget.getAttribute('class');
    expect(className).toContain('lumina-timer-red-glow');
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 2: Audio Chime System
// ═══════════════════════════════════════════════════════════

test.describe('Phase 2: Audio Chime System', () => {

  test('presenter view shows chime mute toggle button', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    // Chime button should be visible and show "Chime" when enabled
    const chimeBtn = page.getByRole('button', { name: 'Chime' });
    await expect(chimeBtn).toBeVisible();
  });

  test('chime toggle switches between Chime and Muted', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    const chimeBtn = page.getByRole('button', { name: 'Chime' });
    await expect(chimeBtn).toBeVisible();

    // Click to mute
    await chimeBtn.click();
    await expect(page.getByRole('button', { name: 'Muted' })).toBeVisible();

    // Click to unmute
    await page.getByRole('button', { name: 'Muted' }).click();
    await expect(page.getByRole('button', { name: 'Chime' })).toBeVisible();
  });

  test('preset editor shows audio chime checkboxes', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    // Open preset studio
    await page.getByTestId('speaker-preset-studio-open').click();
    const studio = page.getByTestId('speaker-preset-studio');
    await expect(studio).toBeVisible();

    // Should show audio chime section
    await expect(studio.getByText('Audio Chimes').first()).toBeVisible();

    // Should show chime checkboxes
    await expect(studio.getByText('Amber chime').first()).toBeVisible();
    await expect(studio.getByText('Red chime').first()).toBeVisible();
    await expect(studio.getByText('Milestone pips').first()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3: Overtime Behavior + Time-of-Day Clock
// ═══════════════════════════════════════════════════════════

test.describe('Phase 3: Overtime Behavior + Wall Clock', () => {

  test('stage timer shows OVERTIME label for negative timer seconds', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: -45,
      timerDurationSec: 300,
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    await expect(page.getByText('OVERTIME')).toBeVisible();
  });

  test('stage timer displays negative time format for overtime', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: -95,
      timerDurationSec: 300,
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    // -95 seconds = -01:35
    await expect(page.getByText('-01:35')).toBeVisible();
  });

  test('preset editor shows overtime behavior selector', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    await page.getByTestId('speaker-preset-studio-open').click();
    const studio = page.getByTestId('speaker-preset-studio');
    await expect(studio).toBeVisible();

    // Should show overtime behavior section
    await expect(studio.getByText('Overtime Behavior').first()).toBeVisible();

    // Should show the three behavior options
    await expect(studio.getByRole('button', { name: 'Count up' }).first()).toBeVisible();
    await expect(studio.getByRole('button', { name: 'Stop' }).first()).toBeVisible();
    await expect(studio.getByRole('button', { name: 'Flash + Stop' }).first()).toBeVisible();
  });

  test('overtime behavior badge shows in hero section', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    await page.getByTestId('speaker-preset-studio-open').click();
    const hero = page.getByTestId('speaker-preset-studio-hero');
    await expect(hero).toBeVisible();

    // Default preset has no overtimeBehavior, should show "OT: Count up"
    await expect(hero.getByText('OT: Count up')).toBeVisible();
  });

  test('wall clock toggle button appears on stage timer widget', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    // Clock toggle button should be in controls
    const clockBtn = widget.getByRole('button', { name: /Clock/ });
    await expect(clockBtn).toBeVisible();
  });

  test('wall clock shows time when enabled', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);
    (state.workspaceSettings as Record<string, unknown>).stageTimerLayout = {
      x: 24, y: 24, width: 360, height: 150, fontScale: 1,
      variant: 'top-right', locked: false, showWallClock: true,
    };

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    // Wall clock should show a time pattern like HH:MM (AM/PM optional)
    const clockText = widget.locator('.font-mono.tabular-nums');
    await expect(clockText).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 4: Preset Studio UI Redesign
// ═══════════════════════════════════════════════════════════

test.describe('Phase 4: Preset Studio UI Redesign', () => {

  test('preset library cards show mini SVG progress rings', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    await page.getByTestId('speaker-preset-studio-open').click();
    const studio = page.getByTestId('speaker-preset-studio');
    await expect(studio).toBeVisible();

    // Library cards should contain SVG elements (mini progress rings)
    const cardSvgs = studio.locator('aside svg');
    await expect(cardSvgs.first()).toBeVisible();
    const count = await cardSvgs.count();
    expect(count).toBeGreaterThanOrEqual(3); // 3 presets = 3 rings
  });

  test('preset cards are draggable for reordering', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    await page.getByTestId('speaker-preset-studio-open').click();
    const studio = page.getByTestId('speaker-preset-studio');
    await expect(studio).toBeVisible();

    // First preset card should have draggable attribute
    const firstCard = studio.locator('aside [draggable="true"]').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard).toHaveAttribute('draggable', 'true');
  });

  test('duration quick-chips include free-text minutes input', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    await page.getByTestId('speaker-preset-studio-open').click();
    const studio = page.getByTestId('speaker-preset-studio');
    await expect(studio).toBeVisible();

    // Quick-input for total minutes should exist
    const minInput = studio.locator('input[placeholder="min"]');
    await expect(minInput.first()).toBeVisible();
  });

  test('preview button exists in hero section and triggers simulation', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    await page.getByTestId('speaker-preset-studio-open').click();
    const studio = page.getByTestId('speaker-preset-studio');
    await expect(studio).toBeVisible();

    // Preview button should exist
    const previewBtn = studio.getByRole('button', { name: 'Preview' });
    await expect(previewBtn.first()).toBeVisible();

    // Click preview
    await previewBtn.first().click();

    // Should show "Previewing..." state
    await expect(studio.getByText('Previewing...')).toBeVisible({ timeout: 2000 });

    // Should show a preview widget with "Preview" label
    await expect(studio.getByText('Preview').last()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 5: Fullscreen Timer Pop-out Window
// ═══════════════════════════════════════════════════════════

test.describe('Phase 5: Timer Pop-out Window', () => {

  test('timer pop-out button is visible in presenter controls', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    const popoutBtn = page.getByRole('button', { name: 'Timer Pop-out' });
    await expect(popoutBtn).toBeVisible();
  });

  test('timer pop-out button opens a new window', async ({ page, context }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    // Listen for new page (popup)
    const popupPromise = context.waitForEvent('page');

    const popoutBtn = page.getByRole('button', { name: 'Timer Pop-out' });
    await popoutBtn.click();

    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');

    // Popup should have timer content
    const timerEl = popup.locator('#timer');
    await expect(timerEl).toBeVisible();

    // Popup should have a label
    const labelEl = popup.locator('#label');
    await expect(labelEl).toBeVisible();

    // Popup should have the ring SVG
    const ring = popup.locator('#ring');
    await expect(ring).toBeVisible();

    await popup.close();
  });
});

// ═══════════════════════════════════════════════════════════
// INTEGRATION: Cross-phase validation
// ═══════════════════════════════════════════════════════════

test.describe('Integration Tests', () => {

  test('full preset lifecycle: create, configure chimes + overtime, save, apply', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key);

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.addInitScript(() => {
      (window as any).electron = { isElectron: true };
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'PRESENT' }).click();
    await expect(page.getByText('Live Queue')).toBeVisible();

    // Open preset studio
    await page.getByTestId('speaker-preset-studio-open').click();
    const studio = page.getByTestId('speaker-preset-studio');
    await expect(studio).toBeVisible();

    // Create new preset
    await studio.getByTestId('speaker-preset-new-draft').click();

    // Change preset name
    const nameInput = studio.getByTestId('speaker-preset-name-input');
    await nameInput.fill('Evening Service');

    // Verify hero updates with new name
    await expect(studio.getByText('Evening Service')).toBeVisible();

    // Verify overtime behavior section exists
    await expect(studio.getByText('Overtime Behavior').first()).toBeVisible();

    // Select "Stop" overtime behavior
    await studio.getByRole('button', { name: 'Stop' }).first().click();

    // Verify badge updates
    const hero = studio.getByTestId('speaker-preset-studio-hero');
    await expect(hero.getByText('OT: Stop')).toBeVisible();

    // Save preset
    await studio.getByTestId('speaker-preset-save').click();

    // Verify save status
    await expect(studio.getByTestId('speaker-preset-studio-status')).toBeVisible();
  });

  test('stage view renders all visual enhancements together', async ({ page }) => {
    const key = uniqueKey();
    const { state } = buildTimerState(key, {
      timerSeconds: 60, // amber zone
      timerDurationSec: 300,
    });
    (state.workspaceSettings as Record<string, unknown>).stageTimerLayout = {
      x: 24, y: 24, width: 400, height: 180, fontScale: 1.2,
      variant: 'top-right', locked: false, showWallClock: true,
    };

    await page.addInitScript((payload) => {
      localStorage.setItem('lumina_session_v1', JSON.stringify(payload));
    }, state);

    await page.goto(`/#/stage?session=s-${key}&workspace=w-${key}`);
    const widget = page.getByTestId('stage-timer-widget');
    await expect(widget).toBeVisible();

    // Progress ring should be visible
    await expect(widget.locator('svg circle').first()).toBeVisible();

    // Timer display should show 01:00
    await expect(widget.getByText('01:00')).toBeVisible();

    // Wall clock should be visible (showWallClock: true)
    const clockEl = widget.locator('.font-mono.tabular-nums');
    await expect(clockEl).toBeVisible();

    // Should be in amber color zone
    const className = await widget.getAttribute('class');
    expect(className).toContain('amber');

    // Widget should have transition styling
    const style = await widget.getAttribute('style');
    expect(style).toContain('transition');
  });
});
