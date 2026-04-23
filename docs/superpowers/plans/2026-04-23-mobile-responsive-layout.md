# Mobile-Responsive Studio Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Lumina Presenter webapp Studio UI (Builder / Presenter / Stage) fully usable on phones ≤ 428px wide while leaving the Electron desktop app and desktop browser experience unchanged.

**Architecture:** Single detection boolean `isMobileShell = !isElectronShell && viewportWidth < 768` computed in `App.tsx`. Shared shell `PresenterDesktopShell.tsx` gains a mobile code path that swaps the 3-column grid for a single-pane view with a fixed 56px bottom tab bar. `AppHeader.tsx` gains a two-row mobile variant. Existing `QuickActionsMenu.tsx` is extended (not replaced) to host mobile-only entries (Settings, Help, Guided Tours, Update controls, URL copy). All desktop code paths are preserved by conditional rendering — zero behavioral delta for Electron or ≥ 768px browsers.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Playwright. Deploy target: Coolify (webapp only — no Electron build).

**Spec reference:** [docs/superpowers/specs/2026-04-23-mobile-responsive-layout-design.md](../specs/2026-04-23-mobile-responsive-layout-design.md)

---

## File Structure

**Create:**
- `tests/e2e/mobile-responsive.spec.ts` — Playwright `@smoke` tagged suite, 4 assertions × 3 tabs

**Modify:**
- `App.tsx` — compute `isMobileShell`, thread to `AppHeader` (1×) and `PresenterDesktopShell` (3×)
- `components/workspace/PresenterDesktopShell.tsx` — add `isMobileShell?: boolean` prop; mobile render fork with `mobilePane` internal state + bottom tab bar
- `components/layout/AppHeader.tsx` — add `isMobileShell: boolean` prop; two-row mobile variant with kebab button
- `components/layout/QuickActionsMenu.tsx` — accept optional mobile-only entries props and render them when `isMobileShell` is true
- `components/builder/BuilderRightRail.tsx` — add `flex-wrap`, `min-w-0` to rows that currently clip
- `components/builder/BuilderBottomDock.tsx` — audit flex row wrapping
- `components/builder/BuilderInspectorAccordion.tsx` — swap fixed widths for `min-w-0 flex-1`
- `components/builder/BuilderCuePanel.tsx` — same audit
- `components/builder/BuilderNotesAffordance.tsx` — same audit
- `components/presenter/LivePane.tsx` — same audit
- `components/builder/StageWorkspace.tsx` — same audit

**Test:**
- `tests/e2e/mobile-responsive.spec.ts` (new, above)

---

## Task 1: Create feature branch and failing Playwright spec (RED)

**Files:**
- Create: `tests/e2e/mobile-responsive.spec.ts`

- [ ] **Step 1: Create and check out the feature branch**

```bash
git checkout master
git pull
git checkout -b feature/mobile-responsive-layout
```

- [ ] **Step 2: Write the failing Playwright spec**

Create `tests/e2e/mobile-responsive.spec.ts`:

```typescript
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

const buildState = (key: string, viewMode: 'BUILDER' | 'PRESENTER' | 'STAGE' = 'BUILDER') => {
  const firstItem = item(`item-worship-${key}`, 'Worship Flow', [
    slide(`slide-intro-${key}`, 'Intro', 'Welcome to worship', `el-intro-${key}`),
    slide(`slide-chorus-${key}`, 'Chorus', 'Chorus lyrics', `el-chorus-${key}`),
  ]);
  return {
    runSheetTitle: 'Sunday Run Sheet',
    schedule: [firstItem],
    selectedItemId: firstItem.id,
    viewMode,
    activeItemId: null as string | null,
    activeSlideIndex: -1,
    blackout: false,
    isPlaying: true,
    outputMuted: false,
    routingMode: 'PROJECTOR',
    updatedAt: Date.now(),
  };
};

const enterMobileStudio = async (
  page: Page,
  state: Record<string, unknown>,
  settings: Record<string, unknown> = {},
) => {
  await page.addInitScript(({ sessionState, workspaceSettings, storageKey, settingsKey, settingsUpdatedAtKey }) => {
    if (!sessionStorage.getItem('lumina_mobile_e2e_seeded')) {
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
      sessionStorage.setItem('lumina_mobile_e2e_seeded', 'true');
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

test.use({ viewport: { width: 375, height: 812 } });

const MODES: Array<{ mode: 'BUILDER' | 'PRESENTER' | 'STAGE'; label: string }> = [
  { mode: 'BUILDER', label: 'builder' },
  { mode: 'PRESENTER', label: 'presenter' },
  { mode: 'STAGE', label: 'stage' },
];

for (const { mode, label } of MODES) {
  test(`@smoke mobile ${label}: no horizontal overflow`, async ({ page }) => {
    const state = buildState(uniqueKey(), mode);
    await enterMobileStudio(page, state);
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible({ timeout: 30_000 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test(`@smoke mobile ${label}: bottom tab bar is visible`, async ({ page }) => {
    const state = buildState(uniqueKey(), mode);
    await enterMobileStudio(page, state);
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible({ timeout: 30_000 });
  });

  test(`@smoke mobile ${label}: tab switching shows only the chosen pane`, async ({ page }) => {
    const state = buildState(uniqueKey(), mode);
    await enterMobileStudio(page, state);
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible({ timeout: 30_000 });

    const tabs: Array<'left' | 'center' | 'right' | 'bottom'> = ['left', 'center', 'right', 'bottom'];
    for (const key of tabs) {
      const button = page.getByTestId(`mobile-tab-${key}`);
      if (!(await button.isVisible().catch(() => false))) continue;
      await button.click();
      await expect(page.getByTestId(`mobile-pane-${key}`)).toBeVisible();
    }
  });
}

test(`@smoke mobile header kebab opens QuickActionsMenu`, async ({ page }) => {
  const state = buildState(uniqueKey(), 'BUILDER');
  await enterMobileStudio(page, state);
  await expect(page.getByTestId('mobile-header-kebab')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('mobile-header-kebab').click();
  await expect(page.getByTestId('quick-actions-menu')).toBeVisible();
  await expect(page.getByTestId('quick-actions-settings-btn')).toBeVisible();
  await expect(page.getByTestId('quick-actions-help-btn')).toBeVisible();
});
```

- [ ] **Step 3: Run the new spec to confirm it fails (RED)**

Run: `npx playwright test tests/e2e/mobile-responsive.spec.ts --reporter=list`

Expected: all tests FAIL — `mobile-tab-bar` testid does not exist yet.

- [ ] **Step 4: Commit the failing spec**

```bash
git add tests/e2e/mobile-responsive.spec.ts
git commit -m "test(mobile): add failing mobile-responsive E2E spec"
```

---

## Task 2: Compute `isMobileShell` in App.tsx

**Files:**
- Modify: `App.tsx:1335` (near existing `viewportWidth` state)

- [ ] **Step 1: Locate the viewport width state**

Open `App.tsx` and find line 1335:

```typescript
const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
```

Also confirm line 1212 has: `const isElectronShell = !!window.electron?.isElectron;`

- [ ] **Step 2: Add the derived boolean**

Immediately after the `viewportWidth` useState line (line 1335), insert:

```typescript
const isMobileShell = !isElectronShell && viewportWidth < 768;
```

- [ ] **Step 3: Confirm the app still builds**

Run: `npx tsc --noEmit`

Expected: no new errors introduced (existing errors, if any, unchanged).

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(mobile): derive isMobileShell flag in App.tsx"
```

---

## Task 3: Add `isMobileShell` prop to `PresenterDesktopShell`

**Files:**
- Modify: `components/workspace/PresenterDesktopShell.tsx`

- [ ] **Step 1: Add the optional prop to the interface**

In `PresenterDesktopShell.tsx`, locate `PresenterDesktopShellProps` and add:

```typescript
isMobileShell?: boolean;
```

Default the destructured value to `false`:

```typescript
const PresenterDesktopShell = ({
  // ...existing props...
  isMobileShell = false,
  className,
}: PresenterDesktopShellProps) => {
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/workspace/PresenterDesktopShell.tsx
git commit -m "feat(mobile): add isMobileShell prop to PresenterDesktopShell"
```

---

## Task 4: Add mobile pane state + tab label table to `PresenterDesktopShell`

**Files:**
- Modify: `components/workspace/PresenterDesktopShell.tsx`

- [ ] **Step 1: Add the MOBILE_TAB_LABELS constant near the top of the file (outside the component)**

```typescript
type MobilePaneKey = 'left' | 'center' | 'right' | 'bottom';

const MOBILE_TAB_LABELS: Record<
  'builder' | 'presenter' | 'stage',
  Record<MobilePaneKey, string>
> = {
  builder: { left: 'Plan', center: 'Stage', right: 'Rail', bottom: 'Dock' },
  presenter: { left: 'Schedule', center: 'Stage', right: 'Live', bottom: 'Library' },
  stage: { left: 'Config', center: 'Preview', right: 'Ops', bottom: '' },
};
```

- [ ] **Step 2: Add the internal mobilePane state inside the component**

Just after the existing top-of-component lines:

```typescript
const [mobilePane, setMobilePane] = React.useState<MobilePaneKey>('center');
```

(If `React` is not yet imported as a namespace, keep using `useState` via the existing hooks import instead: `const [mobilePane, setMobilePane] = useState<MobilePaneKey>('center');`.)

- [ ] **Step 3: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`

Expected: no new errors. State is declared but not yet rendered — it will be wired in Task 5.

- [ ] **Step 4: Commit**

```bash
git add components/workspace/PresenterDesktopShell.tsx
git commit -m "feat(mobile): add mobilePane state and tab label table"
```

---

## Task 5: Implement mobile render fork in `PresenterDesktopShell`

**Files:**
- Modify: `components/workspace/PresenterDesktopShell.tsx`

- [ ] **Step 1: Add the mobile render branch before the existing desktop return**

Inside the component, before the existing desktop-grid return, add:

```typescript
if (isMobileShell) {
  const labels = MOBILE_TAB_LABELS[mode];
  const availableTabs: MobilePaneKey[] = ['left', 'center'];
  if (rightPane && !hideRightPane) availableTabs.push('right');
  if (bottomPane) availableTabs.push('bottom');

  const activeTab = availableTabs.includes(mobilePane) ? mobilePane : 'center';

  const paneFor = (key: MobilePaneKey) => {
    if (key === 'left') return leftPane;
    if (key === 'center') return centerPane;
    if (key === 'right') return rightPane;
    return bottomPane;
  };

  return (
    <div
      data-testid={shellTestId}
      className={`flex h-full w-full flex-col bg-zinc-950 ${className ?? ''}`}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {availableTabs.map((key) => (
          <div
            key={key}
            data-testid={`mobile-pane-${key}`}
            className={`absolute inset-0 overflow-auto ${key === activeTab ? 'block' : 'hidden'}`}
          >
            {paneFor(key)}
          </div>
        ))}
      </div>
      <div
        data-testid="mobile-tab-bar"
        role="tablist"
        aria-label="Studio panes"
        className="flex h-14 shrink-0 items-stretch border-t border-zinc-800 bg-zinc-900"
      >
        {availableTabs.map((key) => (
          <button
            key={key}
            data-testid={`mobile-tab-${key}`}
            role="tab"
            aria-selected={key === activeTab}
            onClick={() => setMobilePane(key)}
            className={`flex flex-1 items-center justify-center text-xs font-medium min-h-[44px] ${
              key === activeTab ? 'text-cyan-300' : 'text-zinc-400'
            }`}
          >
            {labels[key]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the mobile Playwright spec**

Run: `npx playwright test tests/e2e/mobile-responsive.spec.ts --reporter=list --grep "bottom tab bar"`

Expected: the "bottom tab bar is visible" test now PASSES. Tab-switching test should also pass for any mode where the shell is rendered. Overflow test may still fail until inner panes are audited (Task 10), but the tab bar assertions should pass.

- [ ] **Step 3: Commit**

```bash
git add components/workspace/PresenterDesktopShell.tsx
git commit -m "feat(mobile): single-pane mobile render with bottom tab bar"
```

---

## Task 6: Add `isMobileShell` prop to `AppHeader`

**Files:**
- Modify: `components/layout/AppHeader.tsx`

- [ ] **Step 1: Add the required prop**

In `AppHeaderProps`, add:

```typescript
isMobileShell: boolean;
```

Destructure it in the component signature:

```typescript
export function AppHeader({
  // ...existing props...
  isMobileShell,
}: AppHeaderProps) {
```

- [ ] **Step 2: Find every callsite and pass `isMobileShell={isMobileShell}`**

There is a single callsite in `App.tsx`. Search for `<AppHeader` and add the prop:

```tsx
<AppHeader
  // ...existing props...
  isMobileShell={isMobileShell}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors (the new required prop is now provided).

- [ ] **Step 4: Commit**

```bash
git add components/layout/AppHeader.tsx App.tsx
git commit -m "feat(mobile): thread isMobileShell prop into AppHeader"
```

---

## Task 7: Implement mobile two-row header variant with kebab

**Files:**
- Modify: `components/layout/AppHeader.tsx`

- [ ] **Step 1: Add a kebab-open state**

Near the top of the component body:

```typescript
const [isMobileKebabOpen, setMobileKebabOpen] = useState(false);
const mobileKebabRef = useRef<HTMLButtonElement | null>(null);
```

(Add `useRef` and `useState` to the React import if not already imported.)

- [ ] **Step 2: Add the mobile render branch at the top of the return**

Inside the component, before the existing desktop header JSX, insert:

```tsx
if (isMobileShell) {
  return (
    <header className="flex flex-col border-b border-zinc-800 bg-zinc-950">
      <div className="flex h-12 items-center justify-between px-2">
        <button
          type="button"
          onClick={onHomeClick}
          aria-label="Home"
          className="flex h-11 w-11 items-center justify-center rounded text-zinc-200 hover:bg-zinc-800"
          data-testid="mobile-header-home"
        >
          <span aria-hidden>🏠</span>
        </button>
        <nav
          className="flex flex-1 items-center justify-center gap-1 overflow-x-auto no-scrollbar"
          aria-label="View modes"
        >
          {(['BUILDER', 'PRESENTER', 'STAGE'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              data-testid={`mobile-header-mode-${mode.toLowerCase()}`}
              aria-pressed={viewMode === mode}
              className={`h-9 rounded-full px-3 text-xs font-semibold ${
                viewMode === mode
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </nav>
        <button
          ref={mobileKebabRef}
          type="button"
          onClick={() => setMobileKebabOpen((open) => !open)}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={isMobileKebabOpen}
          data-testid="mobile-header-kebab"
          className="flex h-11 w-11 items-center justify-center rounded text-zinc-200 hover:bg-zinc-800"
        >
          <span aria-hidden>⋮</span>
        </button>
      </div>
      <div className="flex h-9 items-center gap-2 overflow-x-auto px-2 text-xs text-zinc-400 no-scrollbar">
        <span data-testid="mobile-status-output" className={isOutputLive ? 'text-emerald-300' : ''}>
          {isOutputLive ? 'LIVE' : 'OFFLINE'}
        </span>
        <span data-testid="mobile-status-connections">
          {activeTargetConnectionCount} conn
        </span>
      </div>
      {isMobileKebabOpen && (
        <QuickActionsMenu
          anchorRef={mobileKebabRef}
          onClose={() => setMobileKebabOpen(false)}
          isMobileShell
          onOpenSettings={onOpenSettings}
          onOpenHelp={onOpenHelp}
          onOpenGuidedTours={onOpenGuidedTours}
          remoteControlUrl={remoteControlUrl}
          stageDisplayUrl={stageDisplayUrl}
          onCopyUrl={onCopyUrl}
          desktopUpdateStatus={desktopUpdateStatus}
          onUpdateCheckNow={onUpdateCheckNow}
          onUpdateInstallNow={onUpdateInstallNow}
          onUpdateOpenReleases={onUpdateOpenReleases}
          onUpdateDismiss={onUpdateDismiss}
        />
      )}
    </header>
  );
}
```

Ensure `QuickActionsMenu` is imported at the top of the file (`import { QuickActionsMenu } from './QuickActionsMenu';`).

- [ ] **Step 3: Run the kebab Playwright test**

Run: `npx playwright test tests/e2e/mobile-responsive.spec.ts --reporter=list --grep "header kebab"`

Expected: the kebab test now gets further — the kebab opens and `quick-actions-menu` testid is visible. Settings/Help assertions still fail until Task 8.

- [ ] **Step 4: Commit**

```bash
git add components/layout/AppHeader.tsx
git commit -m "feat(mobile): two-row mobile header with kebab menu trigger"
```

---

## Task 8: Extend `QuickActionsMenu` with mobile-only entries

**Files:**
- Modify: `components/layout/QuickActionsMenu.tsx`

- [ ] **Step 1: Extend the prop interface**

At the top of `QuickActionsMenu.tsx`, add optional mobile props to `QuickActionsMenuProps`:

```typescript
isMobileShell?: boolean;
onOpenSettings?: () => void;
onOpenHelp?: () => void;
onOpenGuidedTours?: () => void;
remoteControlUrl?: string;
stageDisplayUrl?: string;
onCopyUrl?: (url: string, label: string) => void;
desktopUpdateStatus?: {
  status: 'idle' | 'checking' | 'available' | 'downloaded' | 'error';
  version?: string;
};
onUpdateCheckNow?: () => void;
onUpdateInstallNow?: () => void;
onUpdateOpenReleases?: () => void;
onUpdateDismiss?: () => void;
```

Destructure them with defaults in the component signature:

```typescript
export function QuickActionsMenu({
  // ...existing props...
  isMobileShell = false,
  onOpenSettings,
  onOpenHelp,
  onOpenGuidedTours,
  remoteControlUrl,
  stageDisplayUrl,
  onCopyUrl,
  desktopUpdateStatus,
  onUpdateCheckNow,
  onUpdateInstallNow,
  onUpdateOpenReleases,
  onUpdateDismiss,
}: QuickActionsMenuProps) {
```

- [ ] **Step 2: Render the mobile-only section inside the menu**

Inside the existing menu render, add a conditional block that appears only when `isMobileShell` is true. Place it after the existing buttons so desktop users see no change:

```tsx
{isMobileShell && (
  <div className="flex flex-col border-t border-zinc-800 pt-2 mt-2 gap-1">
    {onOpenSettings && (
      <button
        type="button"
        onClick={() => { onOpenSettings(); onClose(); }}
        data-testid="quick-actions-settings-btn"
        className="flex min-h-[44px] items-center px-3 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Settings
      </button>
    )}
    {onOpenHelp && (
      <button
        type="button"
        onClick={() => { onOpenHelp(); onClose(); }}
        data-testid="quick-actions-help-btn"
        className="flex min-h-[44px] items-center px-3 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Help
      </button>
    )}
    {onOpenGuidedTours && (
      <button
        type="button"
        onClick={() => { onOpenGuidedTours(); onClose(); }}
        data-testid="quick-actions-tours-btn"
        className="flex min-h-[44px] items-center px-3 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Guided Tours
      </button>
    )}
    {remoteControlUrl && onCopyUrl && (
      <button
        type="button"
        onClick={() => { onCopyUrl(remoteControlUrl, 'Remote URL'); onClose(); }}
        data-testid="quick-actions-copy-remote-btn"
        className="flex min-h-[44px] items-center px-3 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Copy remote URL
      </button>
    )}
    {stageDisplayUrl && onCopyUrl && (
      <button
        type="button"
        onClick={() => { onCopyUrl(stageDisplayUrl, 'Stage URL'); onClose(); }}
        data-testid="quick-actions-copy-stage-btn"
        className="flex min-h-[44px] items-center px-3 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Copy stage URL
      </button>
    )}
    {desktopUpdateStatus && onUpdateCheckNow && (
      <button
        type="button"
        onClick={() => { onUpdateCheckNow(); onClose(); }}
        data-testid="quick-actions-update-check-btn"
        className="flex min-h-[44px] items-center px-3 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Check for updates
      </button>
    )}
  </div>
)}
```

- [ ] **Step 3: Run the kebab Playwright test**

Run: `npx playwright test tests/e2e/mobile-responsive.spec.ts --reporter=list --grep "header kebab"`

Expected: the kebab test now passes — `quick-actions-settings-btn` and `quick-actions-help-btn` render.

- [ ] **Step 4: Commit**

```bash
git add components/layout/QuickActionsMenu.tsx
git commit -m "feat(mobile): add mobile-only entries to QuickActionsMenu"
```

---

## Task 9: Thread `isMobileShell` into all three `PresenterDesktopShell` callsites

**Files:**
- Modify: `App.tsx:8737`, `App.tsx:8984`, and the StageWorkspace callsite at `App.tsx:9446`

- [ ] **Step 1: Presenter shell (App.tsx:8737)**

Locate the `<PresenterDesktopShell mode="presenter" ... />` callsite near line 8737. Add the prop:

```tsx
<PresenterDesktopShell
  mode="presenter"
  // ...existing props...
  isMobileShell={isMobileShell}
/>
```

- [ ] **Step 2: Builder shell (App.tsx:8984)**

Locate the `<PresenterDesktopShell mode="builder" ... />` callsite near line 8984. Add:

```tsx
<PresenterDesktopShell
  mode="builder"
  // ...existing props...
  isMobileShell={isMobileShell}
/>
```

- [ ] **Step 3: Stage shell**

Locate `<StageWorkspace ...>` near App.tsx:9446. If `StageWorkspace` renders its own `PresenterDesktopShell` internally, add an `isMobileShell` prop on `StageWorkspace` and forward it to the inner shell. If it renders the shell directly inline, pass `isMobileShell={isMobileShell}` directly.

Concrete step in `components/builder/StageWorkspace.tsx`:

1. Add `isMobileShell?: boolean;` to `StageWorkspaceProps`.
2. Destructure with default `false`.
3. Forward to the internal `<PresenterDesktopShell ...>` as `isMobileShell={isMobileShell}`.

And in `App.tsx:9446`:

```tsx
<StageWorkspace
  // ...existing props...
  isMobileShell={isMobileShell}
/>
```

- [ ] **Step 4: Run the full mobile spec**

Run: `npx playwright test tests/e2e/mobile-responsive.spec.ts --reporter=list`

Expected: tab bar + tab switching + kebab tests PASS for all three modes. Horizontal-overflow test may still fail pending Task 10.

- [ ] **Step 5: Commit**

```bash
git add App.tsx components/builder/StageWorkspace.tsx
git commit -m "feat(mobile): pass isMobileShell to all three Studio shells"
```

---

## Task 10: Overflow discipline audit on inner pane components

**Files:**
- Modify: `components/builder/BuilderRightRail.tsx`
- Modify: `components/builder/BuilderBottomDock.tsx`
- Modify: `components/builder/BuilderInspectorAccordion.tsx`
- Modify: `components/builder/BuilderCuePanel.tsx`
- Modify: `components/builder/BuilderNotesAffordance.tsx`
- Modify: `components/presenter/LivePane.tsx`
- Modify: `components/builder/StageWorkspace.tsx`

- [ ] **Step 1: For each file above, apply these three transforms**

a) Any flex row that can overflow on narrow widths gets `flex-wrap`:

```tsx
// Before
<div className="flex items-center gap-2">
// After
<div className="flex flex-wrap items-center gap-2">
```

b) Any `whitespace-nowrap` that is not semantically required (e.g., truncating a title is fine; truncating a chip label that can wrap is not) is removed.

c) Any `w-[<fixed>px]` on a flex child is replaced with `min-w-0 flex-1` (or `min-w-0` + natural sizing):

```tsx
// Before
<div className="w-[260px]">
// After
<div className="min-w-0 flex-1">
```

- [ ] **Step 2: Run the overflow Playwright test**

Run: `npx playwright test tests/e2e/mobile-responsive.spec.ts --reporter=list --grep "no horizontal overflow"`

Expected: the three overflow tests (builder, presenter, stage) all PASS. `scrollWidth <= clientWidth + 1`.

- [ ] **Step 3: Commit**

```bash
git add components/builder/BuilderRightRail.tsx components/builder/BuilderBottomDock.tsx components/builder/BuilderInspectorAccordion.tsx components/builder/BuilderCuePanel.tsx components/builder/BuilderNotesAffordance.tsx components/presenter/LivePane.tsx components/builder/StageWorkspace.tsx
git commit -m "fix(mobile): wrap flex rows and drop fixed widths to prevent overflow"
```

---

## Task 11: Full test pass

**Files:** (no edits — verification only)

- [ ] **Step 1: Run the full mobile spec**

Run: `npx playwright test tests/e2e/mobile-responsive.spec.ts --reporter=list`

Expected: all tests PASS (no horizontal overflow, bottom tab bar visible, tab switching works, kebab menu opens) across BUILDER, PRESENTER, STAGE.

- [ ] **Step 2: Run the existing smoke suite to guard against regressions**

Run: `npx playwright test --grep "@smoke" --reporter=list`

Expected: all existing `@smoke` tests PASS. If any desktop test regresses, the mobile fork has leaked into the desktop path — re-check conditional `if (isMobileShell)` guards.

- [ ] **Step 3: TypeScript build check**

Run: `npx tsc --noEmit`

Expected: 0 new errors.

- [ ] **Step 4: If all green, no commit needed. If any fix was needed, commit it**

```bash
git add -p
git commit -m "fix(mobile): address smoke regression from mobile fork"
```

---

## Task 12: Merge to master and verify Coolify deploy

**Files:** (git only)

- [ ] **Step 1: Push feature branch**

```bash
git push -u origin feature/mobile-responsive-layout
```

- [ ] **Step 2: Merge to master with a merge commit referencing the spec**

```bash
git checkout master
git pull
git merge --no-ff feature/mobile-responsive-layout -m "$(cat <<'EOF'
feat(mobile): responsive Studio layout for phones

Implements the mobile-responsive design spec:
docs/superpowers/specs/2026-04-23-mobile-responsive-layout-design.md

- Single detection boolean: !isElectronShell && viewportWidth < 768
- PresenterDesktopShell mobile fork: single pane + 56px bottom tab bar
- AppHeader two-row mobile variant with kebab menu
- QuickActionsMenu extended with mobile-only Settings/Help/Tours/URL/Update entries
- Overflow discipline fixes on inner pane components
- Playwright @smoke spec at 375x812 iPhone X viewport

Webapp only. Electron desktop app is unaffected.
EOF
)"
git push origin master
```

- [ ] **Step 3: Confirm Coolify auto-deploy kicks off**

Open the Coolify dashboard for the webapp service. Confirm that a new deployment is running triggered by the latest `master` SHA. Wait for it to go green.

- [ ] **Step 4: Smoke-test production on a real phone or DevTools iPhone emulator**

From a phone (or Chrome DevTools device emulation, iPhone X preset) hit the production URL. Verify:

1. Studio loads without horizontal scrollbar.
2. Bottom tab bar appears and is tappable.
3. All three modes (Builder / Presenter / Stage) are switchable from the header.
4. Kebab opens menu with Settings, Help, Guided Tours, URL copy, Update controls.
5. No console errors.

- [ ] **Step 5: If production check passes, the task is DONE. If anything regresses, revert or hotfix**

```bash
# If hotfix needed
git checkout -b hotfix/mobile-followup
# ... make the fix ...
git commit -am "fix(mobile): <description>"
git push -u origin hotfix/mobile-followup
# Then merge as in Step 2.
```

---

## Self-review notes (for the plan author)

**Spec coverage:**
- §4.1 detection boolean — Task 2
- §4.2 shell behavior fork — Tasks 3, 4, 5
- §4.3 tab labels — Task 4
- §4.4 header mobile variant + kebab — Tasks 6, 7
- §4.5 pane internal fixes — Task 10
- §5 component boundaries / interface changes — Tasks 3, 6
- §6 touch targets + ARIA — Tasks 5, 7 (min-h-[44px], role=tab/tablist, aria-selected, aria-haspopup, aria-expanded)
- §7 testing — Task 1, verified in Tasks 5, 7, 8, 9, 10, 11
- §8 error handling — no new paths; Task 2 defaults to desktop when viewportWidth is 0 (condition `viewportWidth < 768` is false when undefined/0 coerces differently — Task 2 uses strict `viewportWidth < 768`, and the state initializer defaults to 1440 when window is absent, so this is handled)
- §9 deploy — Task 12
- §10 out-of-scope — honored (no editing UX, no tablet tuning, no PWA, no gestures, no NDI admin)

**Placeholder scan:** No TBDs. Every code-modifying step shows code. Every command has an expected output. File paths are exact.

**Type consistency:** `isMobileShell` is `boolean` everywhere — optional (default false) on `PresenterDesktopShellProps` and `QuickActionsMenuProps`; required on `AppHeaderProps` (because `AppHeader` always has one callsite from App.tsx). `MobilePaneKey = 'left' | 'center' | 'right' | 'bottom'` is used consistently across state, testid suffixes, and the labels table. `MOBILE_TAB_LABELS` shape matches the spec table.
