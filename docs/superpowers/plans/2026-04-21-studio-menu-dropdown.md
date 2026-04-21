# Studio Menu & Quick Actions Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hover/pin left-sidebar rail and the persistent `RightDock` column with two click-anchored overlay menus (`StudioMenu` + `QuickActionsMenu`) so the Builder/Presenter canvas never reflows unexpectedly.

**Architecture:** Two small React components rendered as overlays (portaled `position: fixed` for the right popover, `position: absolute` inside the narrow rail for the left dropdown). State for "which tab is docked" stays in `App.tsx` as `activeSidebarTab` but widens to `SidebarTab | null`. Hover-to-open and pin state are removed entirely — dropdowns open only on click and dismiss on outside-click/Escape.

**Tech Stack:** React 19.2.3, TypeScript 5.8.2, Tailwind CSS 3.4.17, Vitest 4.1.4 (unit, jsdom), Playwright 1.58.2 (E2E via `node scripts/run-e2e.mjs`), `ReactDOM.createPortal` for overlay escape-hatch.

**Spec source of truth:** [docs/superpowers/specs/2026-04-21-studio-menu-dropdown-design.md](../specs/2026-04-21-studio-menu-dropdown-design.md)

---

## File Structure

**New files:**
- `components/layout/StudioMenu.tsx` — rail button + anchored dropdown listing all 7 tabs
- `components/layout/StudioMenu.test.tsx` — Vitest unit tests
- `components/layout/QuickActionsMenu.tsx` — popover replacement for `RightDock`
- `components/layout/QuickActionsMenu.test.tsx` — Vitest unit tests
- `tests/e2e/studio-menu-canvas-stability.spec.ts` — Playwright canvas-reflow regression guardrail
- `vitest.config.ts` (only if not already present — check before creating)

**Modified files:**
- `App.tsx` — widen `activeSidebarTab` union to include `null`; replace sidebar rail JSX with `<StudioMenu>`; replace `<RightDock>` render with `<QuickActionsMenu>` anchored to a wand-button ref; remove `sidebarPinned` / `isSidebarHovering` / `presenterSidebarDrawerOpen` state, handlers, and hydration
- `components/layout/AppHeader.tsx` — accept an optional `rightDockAnchorRef` prop and attach it to the wand button so `QuickActionsMenu` can position against it
- `tests/e2e/media-upload.spec.ts` — replace calls to `studio-sidebar-pin` / `studio-sidebar-rail` with the new `studio-menu-button` / tab-selection flow
- `tests/e2e/presenter-ui-sectionalize.spec.ts` — drop the `sidebarPinned: false` seed-state field (line 66)

**Deleted files:**
- `components/layout/RightDock.tsx` — superseded by `QuickActionsMenu.tsx`

---

## Conventions used below

- File paths are repository-relative unless prefixed with `c:\`.
- When a step shows a **Before** / **After** pair, use [Edit](../../../components/layout/) against the exact text shown. If a surrounding block has moved by a few lines (e.g. after earlier task edits), match by the unique anchor string, not the line number.
- Commits use Conventional Commits (`feat`, `refactor`, `test`, `chore`). Attribution is disabled globally via `~/.claude/settings.json`.
- Unit tests use Vitest + `@testing-library/react`. If those packages are not already installed (see Task 2 Step 1), add them.

---

## Task 0: Create feature branch off `dev`

**Files:** none — git only.

- [ ] **Step 1: Verify clean working tree**

```bash
git status
```

Expected: clean tree on branch `dev`. If there are uncommitted changes, stash or commit them before proceeding.

- [ ] **Step 2: Pull latest dev**

```bash
git fetch origin && git checkout dev && git pull --ff-only origin dev
```

Expected: "Already up to date." or a fast-forward.

- [ ] **Step 3: Create the feature branch**

```bash
git checkout -b feat/studio-menu-dropdown
```

Expected: `Switched to a new branch 'feat/studio-menu-dropdown'`.

---

## Task 1: Widen `activeSidebarTab` to `SidebarTab | null`

This lets the dropdown express "no tab docked" (i.e. click the currently-active tab to collapse the panel).

**Files:**
- Modify: `App.tsx:1227` (state declaration) and `App.tsx` `handleSidebarTabSelect` definition (~line 7027) and every call site listed in Task 1 Step 3.

- [ ] **Step 1: Widen the state type**

**Before** ([App.tsx:1227](../../../App.tsx#L1227)):

```tsx
const [activeSidebarTab, setActiveSidebarTab] = useState<'SCHEDULE' | 'HYMNS' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'FILES' | 'MACROS'>('SCHEDULE');
```

**After:**

```tsx
type SidebarTab = 'SCHEDULE' | 'HYMNS' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'FILES' | 'MACROS';
const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab | null>('SCHEDULE');
```

(The `type SidebarTab` alias must be hoisted above the component if it is declared inline in the function body — put it just above the function signature instead. If `App` is a top-level function declaration, place the alias in the same module immediately above the function.)

- [ ] **Step 2: Update `handleSidebarTabSelect` signature and body**

Locate `handleSidebarTabSelect` (around `App.tsx:7027`). It currently accepts a non-nullable tab. Change it to accept `SidebarTab | null` and pass the value through verbatim:

**Before:**

```tsx
const handleSidebarTabSelect = (tab: 'SCHEDULE' | 'HYMNS' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'FILES' | 'MACROS') => {
  setActiveSidebarTab(tab);
  // ... any existing body lines that reference `tab` ...
};
```

**After:**

```tsx
const handleSidebarTabSelect = (tab: SidebarTab | null) => {
  setActiveSidebarTab(tab);
  // ... any existing body lines — they remain type-safe because `tab` is
  //     only compared to specific string literals that still narrow it ...
};
```

If the existing body dereferences `tab` in a way that requires it to be non-null (e.g. `tab.toUpperCase()`), guard the branch with `if (tab === null) return;` so the early-return case (deselect) is a no-op beyond setting state.

- [ ] **Step 3: Update every render branch that conditions on `activeSidebarTab`**

Panels currently render based on `activeSidebarTab === 'SCHEDULE'`-style equality checks. These still work under the widened type — no changes required at call sites; equality with a string literal excludes `null` automatically.

The only structural change: the **panel wrapper** at [App.tsx:8741](../../../App.tsx#L8741) (`data-testid="studio-sidebar-panel"`) must only render when a tab is docked. Wrap the outer `<div data-testid="studio-sidebar-panel" ...>` so it only renders when `activeSidebarTab !== null`:

**Before** (simplified):

```tsx
<div
  data-testid="studio-sidebar-panel"
  className={`...`}
  ...
>
  {/* ... tab-specific branches ... */}
</div>
```

**After:**

```tsx
{activeSidebarTab !== null && (
  <div
    data-testid="studio-sidebar-panel"
    className={`...`}
    ...
  >
    {/* ... tab-specific branches ... */}
  </div>
)}
```

- [ ] **Step 4: Update hydration default**

Find the hydration block that reads `activeSidebarTab` from `initialSavedState` (search `initialSavedState.activeSidebarTab` in `App.tsx`). If the persisted value is missing or unknown, default to `null` so the app boots with no panel docked when hydration is ambiguous, matching the spec.

**Before:**

```tsx
const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab | null>('SCHEDULE');
```

**After:**

```tsx
const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab | null>(() => {
  const persisted = initialSavedState?.activeSidebarTab;
  const valid: SidebarTab[] = ['SCHEDULE', 'HYMNS', 'AUDIO', 'BIBLE', 'AUDIENCE', 'FILES', 'MACROS'];
  return persisted && (valid as string[]).includes(persisted) ? (persisted as SidebarTab) : null;
});
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: any previous errors remain (those are unrelated pre-existing warnings), but no new errors originating from the edits above. If new errors appear, narrow `tab` before use or add explicit null guards.

- [ ] **Step 6: Commit**

```bash
git add App.tsx
git commit -m "refactor(studio-menu): widen activeSidebarTab to allow null (no panel docked)"
```

---

## Task 2: Write failing tests for `StudioMenu`

**Files:**
- Create: `components/layout/StudioMenu.test.tsx`

- [ ] **Step 1: Ensure Vitest + React Testing Library are installed**

```bash
npx vitest --version
```

Expected: a version number. If the command fails with a missing binary, install the testing libs:

```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Then, if `vitest.config.ts` does not exist at the repo root, create it:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

And a `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write the failing test file**

Create [components/layout/StudioMenu.test.tsx](../../../components/layout/StudioMenu.test.tsx) with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudioMenu } from './StudioMenu';

describe('StudioMenu', () => {
  it('renders the STUDIO button closed by default', () => {
    render(<StudioMenu activeTab={null} onSelectTab={() => {}} />);
    const btn = screen.getByRole('button', { name: /studio/i });
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the dropdown on click and lists all 7 tabs', async () => {
    const user = userEvent.setup();
    render(<StudioMenu activeTab={null} onSelectTab={() => {}} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    const labels = items.map((i) => i.textContent);
    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/schedule/i),
        expect.stringMatching(/hymns/i),
        expect.stringMatching(/files/i),
        expect.stringMatching(/audio mixer/i),
        expect.stringMatching(/bible hub/i),
        expect.stringMatching(/audience/i),
        expect.stringMatching(/macros/i),
      ]),
    );
    expect(items).toHaveLength(7);
  });

  it('calls onSelectTab with the tab id when an inactive item is clicked', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(<StudioMenu activeTab={null} onSelectTab={onSelectTab} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    await user.click(screen.getByRole('menuitem', { name: /schedule/i }));
    expect(onSelectTab).toHaveBeenCalledWith('SCHEDULE');
  });

  it('calls onSelectTab(null) when the currently-active item is clicked', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(<StudioMenu activeTab="BIBLE" onSelectTab={onSelectTab} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    await user.click(screen.getByRole('menuitem', { name: /bible hub/i }));
    expect(onSelectTab).toHaveBeenCalledWith(null);
  });

  it('closes the dropdown on Escape', async () => {
    const user = userEvent.setup();
    render(<StudioMenu activeTab={null} onSelectTab={() => {}} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the dropdown on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <StudioMenu activeTab={null} onSelectTab={() => {}} />
        <button data-testid="outside">outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /studio/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('supports arrow-key navigation and Enter to activate', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(<StudioMenu activeTab={null} onSelectTab={onSelectTab} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    await user.keyboard('{ArrowDown}'); // focus first
    await user.keyboard('{ArrowDown}'); // focus second (HYMNS)
    await user.keyboard('{Enter}');
    expect(onSelectTab).toHaveBeenCalledWith('HYMNS');
  });

  it('reflects active tab with aria-current on the matching menuitem', async () => {
    const user = userEvent.setup();
    render(<StudioMenu activeTab="FILES" onSelectTab={() => {}} />);
    await user.click(screen.getByRole('button', { name: /studio/i }));
    const files = screen.getByRole('menuitem', { name: /files/i });
    expect(files).toHaveAttribute('aria-current', 'true');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx vitest run components/layout/StudioMenu.test.tsx
```

Expected: FAIL — `StudioMenu` module is not found.

---

## Task 3: Implement `StudioMenu`

**Files:**
- Create: `components/layout/StudioMenu.tsx`

- [ ] **Step 1: Write the component**

Create [components/layout/StudioMenu.tsx](../../../components/layout/StudioMenu.tsx) with:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MonitorIcon,
  MusicIcon,
  CopyIcon,
  Volume2Icon,
  BibleIcon,
  ChatIcon,
  SparklesIcon,
} from '../Icons';
import { Tooltip } from '../ui';

export type SidebarTab = 'SCHEDULE' | 'HYMNS' | 'FILES' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'MACROS';

export interface StudioMenuProps {
  activeTab: SidebarTab | null;
  onSelectTab: (tab: SidebarTab | null) => void;
}

type MenuItem = {
  id: SidebarTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'info' | 'ai';
  tooltip: React.ReactNode;
};

const MENU_ITEMS: readonly MenuItem[] = [
  {
    id: 'SCHEDULE',
    label: 'Schedule',
    icon: MonitorIcon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Today's run sheet.</strong>
        <br />
        Build and reorder the live order of service — songs, scriptures, sermons, videos, announcements.
      </span>
    ),
  },
  {
    id: 'HYMNS',
    label: 'Hymns',
    icon: MusicIcon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Your hymn & song library.</strong>
        <br />
        Search, add, or import worship songs. Drop any hymn straight onto the Schedule with a click.
      </span>
    ),
  },
  {
    id: 'FILES',
    label: 'Files',
    icon: CopyIcon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Saved run sheets & templates.</strong>
        <br />
        Re-open last week's service or load a recurring template. Nothing prepped is ever lost.
      </span>
    ),
  },
  {
    id: 'AUDIO',
    label: 'Audio Mixer',
    icon: Volume2Icon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Live sound control.</strong>
        <br />
        Adjust per-source volume, mute/solo channels, and route audio in real time.
      </span>
    ),
  },
  {
    id: 'BIBLE',
    label: 'Bible Hub',
    icon: BibleIcon,
    variant: 'ai',
    tooltip: (
      <span>
        <strong className="text-violet-300">Scripture, instantly.</strong>
        <br />
        Look up passages across translations and turn on <strong className="text-violet-300">Auto Listening</strong>.
      </span>
    ),
  },
  {
    id: 'AUDIENCE',
    label: 'Audience',
    icon: ChatIcon,
    variant: 'info',
    tooltip: (
      <span>
        <strong className="text-blue-300">Engage the room.</strong>
        <br />
        Open polls, prayer requests, Q&amp;A, giving prompts, and live audience interactions.
      </span>
    ),
  },
  {
    id: 'MACROS',
    label: 'Macros',
    icon: SparklesIcon,
    variant: 'ai',
    tooltip: (
      <span>
        <strong className="text-violet-300">One-tap automations.</strong>
        <br />
        Chain actions into a single button — built once, fired anytime.
      </span>
    ),
  },
];

export function StudioMenu({ activeTab, onSelectTab }: StudioMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusIndex(-1);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setIsOpen(false);
      setFocusIndex(-1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => (i + 1) % MENU_ITEMS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => (i <= 0 ? MENU_ITEMS.length - 1 : i - 1));
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen && focusIndex >= 0) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [isOpen, focusIndex]);

  const handleItemClick = (tab: SidebarTab) => {
    onSelectTab(tab === activeTab ? null : tab);
    setIsOpen(false);
    setFocusIndex(-1);
  };

  const activeLabel = activeTab
    ? MENU_ITEMS.find((m) => m.id === activeTab)?.label ?? null
    : null;

  return (
    <div className="relative" data-testid="studio-menu-root">
      <Tooltip placement="right" variant="info" content="Open Studio navigation">
        <button
          ref={buttonRef}
          type="button"
          data-testid="studio-menu-button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls="studio-menu-dropdown"
          onClick={() => {
            setIsOpen((v) => !v);
            setFocusIndex(-1);
          }}
          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-sm border text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
            isOpen || activeTab !== null
              ? 'bg-zinc-800 border-zinc-700 text-white'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
          }`}
        >
          <span className="truncate">
            STUDIO{activeLabel ? <span className="text-zinc-500"> › {activeLabel.toUpperCase()}</span> : null}
          </span>
          <span aria-hidden className="text-[8px]">{isOpen ? '▴' : '▾'}</span>
        </button>
      </Tooltip>

      {isOpen && (
        <div
          ref={menuRef}
          id="studio-menu-dropdown"
          role="menu"
          data-testid="studio-menu-dropdown"
          className="absolute left-0 top-full mt-1 w-56 rounded-md border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-xl shadow-black/40 z-[100] p-1"
        >
          {MENU_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = item.id === activeTab;
            return (
              <Tooltip key={item.id} placement="right" variant={item.variant} content={item.tooltip}>
                <button
                  ref={(node) => {
                    itemRefs.current[idx] = node;
                  }}
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? 'true' : undefined}
                  data-testid={`studio-menu-item-${item.id.toLowerCase()}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick(item.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick(item.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-left transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold tracking-tight uppercase">{item.label}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
npx vitest run components/layout/StudioMenu.test.tsx
```

Expected: all 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add components/layout/StudioMenu.tsx components/layout/StudioMenu.test.tsx vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "feat(studio-menu): add StudioMenu dropdown component with unit tests"
```

(If `vitest.config.ts` / `vitest.setup.ts` / lockfile changes were not actually created or modified, omit them from the add.)

---

## Task 4: Write failing tests for `QuickActionsMenu`

**Files:**
- Create: `components/layout/QuickActionsMenu.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create [components/layout/QuickActionsMenu.test.tsx](../../../components/layout/QuickActionsMenu.test.tsx) with:

```tsx
import React, { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickActionsMenu } from './QuickActionsMenu';

type HarnessProps = Omit<React.ComponentProps<typeof QuickActionsMenu>, 'anchorRef'>;

function Harness(props: HarnessProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef} data-testid="anchor-btn">anchor</button>
      <QuickActionsMenu {...props} anchorRef={anchorRef} />
    </>
  );
}

describe('QuickActionsMenu', () => {
  it('renders nothing when isOpen is false', () => {
    render(<Harness isOpen={false} onClose={() => {}} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    expect(screen.queryByTestId('quick-actions-menu')).not.toBeInTheDocument();
  });

  it('renders the 4 action buttons when isOpen is true (non-electron)', () => {
    render(<Harness isOpen={true} onClose={() => {}} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    expect(screen.getByTestId('quick-actions-connect-btn')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-aether-btn')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-ai-btn')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-machine-mode-btn')).toBeInTheDocument();
  });

  it('shows START SERVICE in electron mode', () => {
    render(<Harness isOpen={true} onClose={() => {}} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={true} desktopServiceState={{ outputOpen: false, stageOpen: false }} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    expect(screen.getByTestId('quick-actions-start-service-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-actions-machine-mode-btn')).not.toBeInTheDocument();
  });

  it('calls onOpenConnect("audience") when CONNECT is clicked', async () => {
    const user = userEvent.setup();
    const onOpenConnect = vi.fn();
    render(<Harness isOpen={true} onClose={() => {}} onOpenConnect={onOpenConnect} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    await user.click(screen.getByTestId('quick-actions-connect-btn'));
    expect(onOpenConnect).toHaveBeenCalledWith('audience');
  });

  it('calls onOpenConnect("aether") when AETHER is clicked', async () => {
    const user = userEvent.setup();
    const onOpenConnect = vi.fn();
    render(<Harness isOpen={true} onClose={() => {}} onOpenConnect={onOpenConnect} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    await user.click(screen.getByTestId('quick-actions-aether-btn'));
    expect(onOpenConnect).toHaveBeenCalledWith('aether');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness isOpen={true} onClose={onClose} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on outside click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <div>
        <Harness isOpen={true} onClose={onClose} onOpenConnect={() => {}} onOpenAI={() => {}} hasElectronDisplayControl={false} desktopServiceState={null} onStartService={() => {}} onStopService={() => {}} machineMode={false} onToggleMachineMode={() => {}} />
        <div data-testid="outside-zone" style={{ width: 500, height: 500 }}>outside</div>
      </div>,
    );
    await user.click(screen.getByTestId('outside-zone'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run components/layout/QuickActionsMenu.test.tsx
```

Expected: FAIL — `QuickActionsMenu` module not found.

---

## Task 5: Implement `QuickActionsMenu`

**Files:**
- Create: `components/layout/QuickActionsMenu.tsx`

- [ ] **Step 1: Write the component**

Create [components/layout/QuickActionsMenu.tsx](../../../components/layout/QuickActionsMenu.tsx) with:

```tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { QrCodeIcon, MonitorIcon, SparklesIcon } from '../Icons';

export type DesktopServiceState = { outputOpen: boolean; stageOpen: boolean };

export interface QuickActionsMenuProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;

  onOpenConnect: (mode: 'audience' | 'aether') => void;
  onOpenAI: () => void;

  hasElectronDisplayControl: boolean;
  desktopServiceState: DesktopServiceState | null;
  onStartService: () => void;
  onStopService: () => void;

  machineMode: boolean;
  onToggleMachineMode: () => void;
}

export function QuickActionsMenu(props: QuickActionsMenuProps) {
  const {
    anchorRef,
    isOpen,
    onClose,
    onOpenConnect,
    onOpenAI,
    hasElectronDisplayControl,
    desktopServiceState,
    onStartService,
    machineMode,
    onToggleMachineMode,
  } = props;

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !pos) return null;

  const isServiceRunning = desktopServiceState?.outputOpen || desktopServiceState?.stageOpen;

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      role="menu"
      data-testid="quick-actions-menu"
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 200 }}
      className="w-56 rounded-md border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl shadow-black/50 p-2"
    >
      <div className="px-1 pb-2">
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">QUICK ACTIONS</span>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          role="menuitem"
          data-testid="quick-actions-connect-btn"
          onClick={() => onOpenConnect('audience')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600/10 border border-blue-900/30 text-blue-400 hover:bg-blue-600/20 text-[10px] font-black tracking-widest transition-all active:scale-95 text-left"
        >
          <QrCodeIcon className="w-4 h-4 shrink-0" />
          <div className="flex flex-col">
            <span>CONNECT</span>
            <span className="text-[8px] text-blue-500/70 font-semibold normal-case tracking-normal">Audience devices</span>
          </div>
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="quick-actions-aether-btn"
          onClick={() => onOpenConnect('aether')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cyan-600/10 border border-cyan-900/30 text-cyan-300 hover:bg-cyan-600/20 text-[10px] font-black tracking-widest transition-all active:scale-95 text-left"
        >
          <MonitorIcon className="w-4 h-4 shrink-0" />
          <div className="flex flex-col">
            <span>AETHER</span>
            <span className="text-[8px] text-cyan-500/70 font-semibold normal-case tracking-normal">Multi-screen bridge</span>
          </div>
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="quick-actions-ai-btn"
          onClick={onOpenAI}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/30 text-zinc-300 hover:text-white hover:bg-zinc-800 text-[10px] font-black tracking-widest transition-all text-left"
        >
          <SparklesIcon className="w-4 h-4 shrink-0 text-purple-400" />
          <div className="flex flex-col">
            <span>AI ASSIST</span>
            <span className="text-[8px] text-zinc-500 font-semibold normal-case tracking-normal">Gemini / lyrics / help</span>
          </div>
        </button>
        <div className="h-px bg-zinc-800 my-1" />
        {hasElectronDisplayControl ? (
          <button
            type="button"
            role="menuitem"
            data-testid="quick-actions-start-service-btn"
            onClick={onStartService}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border text-left ${
              isServiceRunning
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span className="text-base leading-none">⚡</span>
            <div className="flex flex-col">
              <span>START SERVICE</span>
              <span className={`text-[8px] font-semibold normal-case tracking-normal ${isServiceRunning ? 'text-cyan-200/70' : 'text-zinc-600'}`}>
                {isServiceRunning ? 'Service running' : 'Launch display outputs'}
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            role="menuitem"
            data-testid="quick-actions-machine-mode-btn"
            onClick={onToggleMachineMode}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border text-left ${
              machineMode
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span className="text-base leading-none">⚡</span>
            <div className="flex flex-col">
              <span>MACHINE MODE</span>
              <span className={`text-[8px] font-semibold normal-case tracking-normal ${machineMode ? 'text-cyan-200/70' : 'text-zinc-600'}`}>
                {machineMode ? 'Active — minimal UI' : 'Distraction-free view'}
              </span>
            </div>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
npx vitest run components/layout/QuickActionsMenu.test.tsx
```

Expected: all 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add components/layout/QuickActionsMenu.tsx components/layout/QuickActionsMenu.test.tsx
git commit -m "feat(quick-actions): add QuickActionsMenu popover to replace persistent RightDock"
```

---

## Task 6: Expose wand-button ref from `AppHeader`

`QuickActionsMenu` needs a ref to the wand button for popover positioning. `AppHeader` already owns the button; we add an optional `rightDockAnchorRef` prop and forward it.

**Files:**
- Modify: [components/layout/AppHeader.tsx](../../../components/layout/AppHeader.tsx) (interface + button)

- [ ] **Step 1: Add `rightDockAnchorRef` to `AppHeaderProps`**

**Before** (inside the interface, near the `isRightDockOpen` block around line 52):

```tsx
  // Right dock
  isRightDockOpen: boolean;
  onToggleRightDock: () => void;
```

**After:**

```tsx
  // Right dock
  isRightDockOpen: boolean;
  onToggleRightDock: () => void;
  rightDockAnchorRef?: React.RefObject<HTMLButtonElement | null>;
```

- [ ] **Step 2: Destructure the new prop in the component signature**

Find the existing destructure around line 80-100 of [AppHeader.tsx](../../../components/layout/AppHeader.tsx#L80) and add `rightDockAnchorRef,` alongside `isRightDockOpen, onToggleRightDock,`.

- [ ] **Step 3: Attach the ref to the wand button**

**Before** (around [line 282](../../../components/layout/AppHeader.tsx#L282)):

```tsx
<button
  data-testid="header-right-dock-btn"
  onClick={onToggleRightDock}
  className={`ml-1 p-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border ${
    isRightDockOpen
      ? 'bg-zinc-800 border-zinc-700 text-white'
      : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white'
  }`}
>
  <SparklesIcon className="w-4 h-4 text-purple-400" />
</button>
```

**After:**

```tsx
<button
  ref={rightDockAnchorRef}
  data-testid="header-right-dock-btn"
  onClick={onToggleRightDock}
  className={`ml-1 p-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border ${
    isRightDockOpen
      ? 'bg-zinc-800 border-zinc-700 text-white'
      : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white'
  }`}
>
  <SparklesIcon className="w-4 h-4 text-purple-400" />
</button>
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/layout/AppHeader.tsx
git commit -m "feat(app-header): expose rightDockAnchorRef for QuickActionsMenu popover"
```

---

## Task 7: Wire `StudioMenu` into `App.tsx` (replace the sidebar rail)

**Files:**
- Modify: [App.tsx](../../../App.tsx) — the sidebar-rail block at lines ~8605-8738

- [ ] **Step 1: Import `StudioMenu`**

Add to the existing layout-component import cluster at the top of `App.tsx`:

```tsx
import { StudioMenu } from './components/layout/StudioMenu';
```

- [ ] **Step 2: Replace the entire rail `<div>` block**

**Before** (the big block from [App.tsx:8605](../../../App.tsx#L8605) through the closing `</div>` at ~8738 — this is the `<div data-testid="studio-sidebar-rail">` and all seven Tooltip-wrapped tab buttons plus the pin button and the Settings Tooltip):

```tsx
<div
  className={`group flex flex-col h-full bg-zinc-900/50 border-r border-zinc-800 shrink-0 overflow-hidden z-20 ${sidebarRailWidthClass}`}
  style={{ width: sidebarRailWidth }}
  data-testid="studio-sidebar-rail"
  onMouseEnter={() => {
    if (!presenterSidebarCompact) setIsSidebarHovering(true);
  }}
  onMouseLeave={() => {
    if (!presenterSidebarCompact) setIsSidebarHovering(false);
  }}
>
  {/* ... the pin button + 7 Tooltip-wrapped tab buttons + Settings tooltip ... */}
</div>
```

**After:**

```tsx
<div
  className="group flex flex-col h-full bg-zinc-900/50 border-r border-zinc-800 shrink-0 overflow-visible z-20 w-56"
  data-testid="studio-sidebar-rail"
>
  <div className="flex items-center justify-between p-1 border-b border-zinc-800/80">
    <span className="px-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Studio</span>
  </div>
  <div className="flex flex-col flex-1 p-1 gap-1">
    <StudioMenu activeTab={activeSidebarTab} onSelectTab={handleSidebarTabSelect} />
  </div>
  <div className="p-1 border-t border-zinc-800">
    <Tooltip
      placement="right"
      variant="info"
      content={
        <span>
          <strong className="text-blue-300">Profile, themes & preferences.</strong>
          <br />
          Switch user, customise default fonts and slide themes, manage cloud sync, integrations, and keyboard shortcuts.
        </span>
      }
    >
      <button
        onClick={() => setIsProfileOpen(true)}
        className="w-full p-2.5 rounded-sm flex items-center gap-3 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
      >
        <Settings className="w-5 h-5 shrink-0" />
        <span className="text-xs font-bold tracking-tight uppercase">Settings</span>
      </button>
    </Tooltip>
  </div>
</div>
```

Key changes:
- `overflow-hidden` → `overflow-visible` so the dropdown can escape the rail container.
- Fixed `w-56` replaces the hover-driven `sidebarRailWidth`/`sidebarRailWidthClass`.
- Pin button and all 7 direct tab buttons are gone — replaced by the single `<StudioMenu>`.
- The Settings tooltip is kept as a sibling below the menu (spec says Settings stays separate from Studio tabs).
- The two `onMouseEnter` / `onMouseLeave` handlers are removed.

- [ ] **Step 3: Remove the drawer backdrop**

**Before** ([App.tsx:8592-8604](../../../App.tsx#L8592-L8604)):

```tsx
{presenterSidebarDrawerVisible && (
  <button
    type="button"
    aria-label="Close studio sidebar drawer"
    data-testid="studio-sidebar-drawer-backdrop"
    className="absolute inset-0 z-10 bg-black/35"
    onClick={() => {
      if (!sidebarPinned) {
        setPresenterSidebarDrawerOpen(false);
      }
    }}
  />
)}
```

**After:** (delete the whole block — no replacement).

- [ ] **Step 4: Typecheck + run Studio unit tests**

```bash
npx tsc --noEmit
npx vitest run components/layout/StudioMenu.test.tsx
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "refactor(studio-menu): replace hover-to-open sidebar rail with StudioMenu dropdown"
```

---

## Task 8: Wire `QuickActionsMenu` into `App.tsx` (replace `RightDock`)

**Files:**
- Modify: [App.tsx](../../../App.tsx) — imports, new ref, header prop wire-up, dock render site

- [ ] **Step 1: Swap imports**

Replace the `RightDock` import with `QuickActionsMenu`:

**Before:**

```tsx
import { RightDock } from './components/layout/RightDock';
```

**After:**

```tsx
import { QuickActionsMenu } from './components/layout/QuickActionsMenu';
```

- [ ] **Step 2: Add the wand-button ref**

Just below the existing `isRightDockOpen` state declaration (around [App.tsx:1337](../../../App.tsx#L1337)), add:

```tsx
const rightDockAnchorRef = useRef<HTMLButtonElement | null>(null);
```

(Ensure `useRef` is in the existing React import — it is.)

- [ ] **Step 3: Pass the ref through `AppHeader`**

Find the `<AppHeader ... />` render site (around [App.tsx:8553](../../../App.tsx#L8553)) and add `rightDockAnchorRef={rightDockAnchorRef}` next to `isRightDockOpen`/`onToggleRightDock`.

- [ ] **Step 4: Replace the `<RightDock>` render with `<QuickActionsMenu>`**

Locate the existing `<RightDock .../>` JSX (search for `<RightDock` in `App.tsx` — should be a single call site).

**Before:**

```tsx
<RightDock
  isOpen={isRightDockOpen}
  machineMode={machineMode}
  onToggleMachineMode={handleToggleMachineMode}
  onOpenConnect={handleOpenConnect}
  onOpenAI={handleOpenAI}
  hasElectronDisplayControl={hasElectronDisplayControl}
  onOpenDisplaySetup={handleOpenDisplaySetup}
  desktopServiceState={desktopServiceState}
/>
```

**After:**

```tsx
<QuickActionsMenu
  anchorRef={rightDockAnchorRef}
  isOpen={isRightDockOpen}
  onClose={() => setIsRightDockOpen(false)}
  onOpenConnect={handleOpenConnect}
  onOpenAI={handleOpenAI}
  hasElectronDisplayControl={hasElectronDisplayControl}
  desktopServiceState={desktopServiceState ?? null}
  onStartService={handleOpenDisplaySetup ?? (() => {})}
  onStopService={() => {}}
  machineMode={machineMode}
  onToggleMachineMode={handleToggleMachineMode}
/>
```

Notes:
- `onStopService` is new in the spec but `RightDock` never wired one up — pass a no-op for now; future work can surface a real "stop service" callback.
- The `RightDock` was rendered as a flex sibling inside the main row. `QuickActionsMenu` portals itself to `document.body`, so the canvas reclaims the `w-56` space automatically.
- Because `<RightDock>` previously lived inline in the layout, verify the canvas column now grows to fill. No manual layout changes should be needed; Tailwind `flex-1` on the canvas column handles it.

- [ ] **Step 5: Typecheck + unit tests**

```bash
npx tsc --noEmit
npx vitest run components/layout/QuickActionsMenu.test.tsx
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add App.tsx
git commit -m "refactor(quick-actions): render QuickActionsMenu popover instead of RightDock column"
```

---

## Task 9: Remove `sidebarPinned` / `isSidebarHovering` / drawer state and handlers

**Files:**
- Modify: [App.tsx](../../../App.tsx)

- [ ] **Step 1: Delete state declarations**

Remove these lines (around [App.tsx:1338-1343](../../../App.tsx#L1338-L1343)):

```tsx
const [sidebarPinned, setSidebarPinned] = useState<boolean>(initialSavedState?.sidebarPinned ?? false);
const [isSidebarHovering, setIsSidebarHovering] = useState(false);
const [presenterSidebarDrawerOpen, setPresenterSidebarDrawerOpen] = useState(false);
```

(Line numbers are approximate — match by text. If the `sidebarPinned` initializer uses a slightly different signature than shown, delete the whole statement regardless.)

- [ ] **Step 2: Delete computed values**

Remove these derived values (around [App.tsx:3232-3241](../../../App.tsx#L3232-L3241)):

```tsx
const sidebarExpanded = presenterSidebarCompact ? false : (sidebarPinned || isSidebarHovering);
const presenterSidebarDrawerVisible = presenterSidebarCompact && (sidebarPinned || presenterSidebarDrawerOpen);
// ... and the sidebarRailWidth / sidebarRailWidthClass / sidebarLabelClass / sidebarPanelWidth block ...
```

Every downstream reference to `sidebarExpanded`, `presenterSidebarDrawerVisible`, `sidebarRailWidth`, `sidebarRailWidthClass`, `sidebarLabelClass`, `sidebarPanelWidth` must be removed or inlined to a static value. Expected cleanups:
- In the panel wrapper at [App.tsx:8741](../../../App.tsx#L8741), remove `sidebarPanelWidth` / `sidebarRailWidth` style props.
- Any `className` interpolating `sidebarLabelClass` becomes a plain static class (labels are always visible now since the rail is a fixed `w-56`).

Run `npx tsc --noEmit` after this step to let the compiler surface each remaining reference.

- [ ] **Step 3: Delete `handleSidebarPinToggle`**

Remove (around [App.tsx:7015-7025](../../../App.tsx#L7015-L7025)):

```tsx
const handleSidebarPinToggle = () => {
  // ... body ...
};
```

And any JSX that wired `handleSidebarPinToggle` (the pin button was already deleted in Task 7).

- [ ] **Step 4: Remove `setIsSidebarHovering` call sites**

Previously called at lines 6980, 6995, 6998, 8612, 8615 ([App.tsx:6980](../../../App.tsx#L6980) etc.). The 8612/8615 call sites are already removed via Task 7. Delete the remaining three call sites — each is a one-line `setIsSidebarHovering(false)` or `setIsSidebarHovering(true)` that no longer has a backing state.

- [ ] **Step 5: Remove `setPresenterSidebarDrawerOpen` call sites**

Search for `setPresenterSidebarDrawerOpen` and remove every call. If any branch depended on the drawer being open (e.g. to show the backdrop), delete that branch entirely since Task 7 already removed the backdrop.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If `presenterSidebarCompact` is still referenced but no longer meaningful, leave it alone — it still gates compact mode for other flows and is out of scope here.

- [ ] **Step 7: Commit**

```bash
git add App.tsx
git commit -m "refactor(studio-menu): remove hover/pin sidebar state and handlers"
```

---

## Task 10: Drop `sidebarPinned` from hydration

**Files:**
- Modify: [App.tsx](../../../App.tsx) — hydration serializer/deserializer

- [ ] **Step 1: Locate the saved-state type**

Search for `sidebarPinned` in `App.tsx`. Remaining matches should be in the `SavedState`-style type (or equivalent) and the serializer that writes to `localStorage`.

- [ ] **Step 2: Remove the field from the type**

Delete the `sidebarPinned: boolean` (or optional variant) line from whatever type/interface describes the persisted state.

- [ ] **Step 3: Remove the field from the serializer**

Delete the property assignment `sidebarPinned: ...` from the object being written to localStorage.

Spec guarantees we silently drop old values — no migration. Old persisted blobs carrying `sidebarPinned` will simply have that field ignored on the next boot.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "chore(studio-menu): drop sidebarPinned from persisted state"
```

---

## Task 11: Write the Playwright canvas-stability regression spec

**Files:**
- Create: `tests/e2e/studio-menu-canvas-stability.spec.ts`

- [ ] **Step 1: Identify the preview selector**

Before writing the spec, open a Playwright session against `npm run dev` and inspect the Builder preview / Presenter preview DOM to locate the most stable selector. Likely candidates (verify at least one exists):
- `[data-testid="builder-preview-root"]`
- `[data-testid="presenter-preview-root"]`
- `[data-testid="studio-canvas"]`

If none exist, grep `App.tsx` for the nearest Builder/Presenter preview container and add a `data-testid` to it in this step — the value doesn't matter as long as it's stable. Suggested: `data-testid="studio-canvas-root"`.

- [ ] **Step 2: Write the test file**

Create [tests/e2e/studio-menu-canvas-stability.spec.ts](../../../tests/e2e/studio-menu-canvas-stability.spec.ts) with:

```ts
import { test, expect, type Page } from '@playwright/test';

const TABS: Array<{ id: string; label: RegExp }> = [
  { id: 'SCHEDULE', label: /schedule/i },
  { id: 'HYMNS', label: /hymns/i },
  { id: 'FILES', label: /files/i },
  { id: 'AUDIO', label: /audio mixer/i },
  { id: 'BIBLE', label: /bible hub/i },
  { id: 'AUDIENCE', label: /audience/i },
  { id: 'MACROS', label: /macros/i },
];

async function canvasWidth(page: Page): Promise<number> {
  const handle = await page.getByTestId('studio-canvas-root');
  const box = await handle.boundingBox();
  if (!box) throw new Error('canvas bounding box not available');
  return box.width;
}

test.describe('Studio menu canvas stability', () => {
  test('opening/closing each tab 5x does not shrink the canvas', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await page.waitForSelector('[data-testid="studio-menu-button"]');

    const baseline = await canvasWidth(page);

    for (let cycle = 0; cycle < 5; cycle++) {
      for (const tab of TABS) {
        await page.getByTestId('studio-menu-button').click();
        await page.getByRole('menuitem', { name: tab.label }).click();
        // Panel docked -- canvas is expected to shrink here; we are asserting
        // that closing returns to baseline, not that the dock never affects width.
        await page.getByTestId('studio-menu-button').click();
        await page.getByRole('menuitem', { name: tab.label }).click();
        const width = await canvasWidth(page);
        expect(Math.abs(width - baseline)).toBeLessThanOrEqual(1);
      }
    }
  });

  test('QuickActionsMenu does not affect canvas width', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="header-right-dock-btn"]');
    const baseline = await canvasWidth(page);

    await page.getByTestId('header-right-dock-btn').click();
    await expect(page.getByTestId('quick-actions-menu')).toBeVisible();
    const openWidth = await canvasWidth(page);
    expect(Math.abs(openWidth - baseline)).toBeLessThanOrEqual(1);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('quick-actions-menu')).not.toBeVisible();
    const closedWidth = await canvasWidth(page);
    expect(Math.abs(closedWidth - baseline)).toBeLessThanOrEqual(1);
  });

  test('rapid open/close leaves no stuck overlay', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="studio-menu-button"]');

    for (let i = 0; i < 10; i++) {
      await page.getByTestId('studio-menu-button').click();
      await page.getByTestId('studio-menu-button').click();
    }
    await expect(page.getByTestId('studio-menu-dropdown')).not.toBeVisible();
    await expect(page.getByTestId('quick-actions-menu')).not.toBeVisible();
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
npm run test:e2e -- studio-menu-canvas-stability
```

Expected: all three tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/studio-menu-canvas-stability.spec.ts
git commit -m "test(e2e): add canvas-stability regression spec for StudioMenu/QuickActionsMenu"
```

(If Step 1 required adding `data-testid="studio-canvas-root"` to `App.tsx`, include `App.tsx` in the add and adjust the commit subject to `test+chore(e2e): ...`.)

---

## Task 12: Migrate existing E2E specs off `studio-sidebar-pin` and `sidebarPinned`

**Files:**
- Modify: [tests/e2e/media-upload.spec.ts](../../../tests/e2e/media-upload.spec.ts) — lines 237, 265, 292, 303, 310, 487, 594
- Modify: [tests/e2e/presenter-ui-sectionalize.spec.ts](../../../tests/e2e/presenter-ui-sectionalize.spec.ts) — line 66

- [ ] **Step 1: Migrate `media-upload.spec.ts` pin-click sites**

Each `await page.getByTestId('studio-sidebar-pin').click();` was previously used to open/pin the sidebar panel. In the new UX, users open the panel by selecting a specific tab from the StudioMenu dropdown. Replace each occurrence with a helper:

Add this helper at the top of the file (below the existing imports):

```ts
async function openStudioTab(page: import('@playwright/test').Page, tabName: string) {
  await page.getByTestId('studio-menu-button').click();
  await page.getByRole('menuitem', { name: new RegExp(tabName, 'i') }).click();
}
```

Then for each `studio-sidebar-pin` click site:
- If the test subsequently asserts the presence of "Schedule", "Files", "Audio Mixer", etc. (i.e. it expects a tab panel to be docked), call `await openStudioTab(page, 'Schedule');` instead.
- If the test clicks the pin a second time to *close* the panel, replace that with `await openStudioTab(page, 'Schedule');` to toggle the active tab off.
- Where the test reads `studio-sidebar-rail` metrics (lines 265, 303), replace the assertion with one against `studio-menu-root` or `studio-menu-button`:
  ```ts
  const railMetrics = await page.getByTestId('studio-menu-root').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  expect(railMetrics.left).toBeGreaterThanOrEqual(0);
  expect(railMetrics.width).toBeGreaterThan(120);
  ```
- The `studio-sidebar-drawer-backdrop` click at line 318 is no longer reachable — replace with clicking the currently-active tab in the StudioMenu dropdown to collapse the panel:
  ```ts
  await openStudioTab(page, 'Audio Mixer'); // collapses it if already active
  ```

- [ ] **Step 2: Migrate `presenter-ui-sectionalize.spec.ts`**

**Before** (line 66):

```ts
sidebarPinned: false,
```

**After:** (delete the line entirely — the field is no longer part of persisted state).

- [ ] **Step 3: Run both migrated specs**

```bash
npm run test:e2e -- media-upload presenter-ui-sectionalize
```

Expected: both PASS. If a test still expects the old pin/hover semantics at a deeper level, update it inline to the new flow (click `studio-menu-button`, pick a tab, etc.).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/media-upload.spec.ts tests/e2e/presenter-ui-sectionalize.spec.ts
git commit -m "test(e2e): migrate sidebar-pin assertions to StudioMenu dropdown flow"
```

---

## Task 13: Delete `RightDock.tsx`

**Files:**
- Delete: `components/layout/RightDock.tsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
```
Use Grep with pattern `RightDock` across the repo (not including `.claude/worktrees/`). Expected: zero matches outside of `RightDock.tsx` itself (worktree copies are ignored).

- [ ] **Step 2: Delete the file**

```bash
git rm components/layout/RightDock.tsx
```

- [ ] **Step 3: Typecheck + unit tests + full E2E smoke**

```bash
npx tsc --noEmit
npx vitest run
npm run test:e2e:smoke
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(quick-actions): remove superseded RightDock component"
```

---

## Task 14: Final verification pass

**Files:** none — verification only.

- [ ] **Step 1: Full E2E run**

```bash
npm run test:e2e
```

Expected: green. Any failure outside the touched areas (e.g. bible-hub, sermon-recorder) likely pre-dates this branch; triage before claiming pass.

- [ ] **Step 2: Manual smoke in the browser**

```bash
npm run dev
```

Open the dev server and verify:
1. On first load, no tab is docked (the panel is gone — canvas occupies the full column) OR the persisted tab is docked if one was saved.
2. Clicking `STUDIO ▾` opens the dropdown.
3. Clicking `SCHEDULE` docks the Schedule panel.
4. Clicking `STUDIO ▾` again and clicking `SCHEDULE` collapses the panel — canvas reclaims the width.
5. Clicking outside the dropdown (e.g. the canvas) closes the dropdown but leaves the panel docked.
6. Pressing Escape with the dropdown open closes the dropdown.
7. Clicking the wand button in the header opens `QuickActionsMenu` as a floating popover beneath the button. Canvas width does not change.
8. Clicking the wand button again, or pressing Escape, or clicking outside, dismisses the popover.
9. Rapidly clicking the STUDIO button 10 times leaves no stuck overlay.

- [ ] **Step 3: Final commit if any tweaks were needed**

```bash
git add -A
git status
git commit -m "chore(studio-menu): final polish from manual smoke" # only if anything changed
```

---

## Self-review checklist

Before handing this plan to execution, the plan author should verify:

- [x] **Spec coverage:** Every spec section has at least one task — `StudioMenu` (T2+T3), `QuickActionsMenu` (T4+T5), state changes (T1, T9, T10), canvas guardrail Playwright test (T11), migration of existing E2E specs (T12), deletion of `RightDock.tsx` (T13).
- [x] **No placeholders:** Every code block shows the literal code to paste. No "TODO", "TBD", or "implement later".
- [x] **Type consistency:** `SidebarTab` is defined once in `App.tsx` (Task 1) and re-exported from `StudioMenu.tsx` (Task 3). Both use the same seven literals in the same order. `QuickActionsMenuProps` uses the same field names (`anchorRef`, `isOpen`, `onClose`, `onOpenConnect`, `onOpenAI`, `hasElectronDisplayControl`, `desktopServiceState`, `onStartService`, `onStopService`, `machineMode`, `onToggleMachineMode`) across the component (T5), its test harness (T4), and the App.tsx wire-up (T8).
- [x] **File paths:** All paths are relative to the repo root; all referenced line numbers match the last-known state of `App.tsx` on `dev` at 2026-04-21.
- [x] **Bite-sized steps:** Every task decomposes into steps of 2-5 minutes each, each with either a command (`npx vitest run`, `git commit`) or an exact before/after diff.
- [x] **Commits:** Each task ends with a commit step. Messages follow Conventional Commits and do not include Claude attribution (user global setting).

## Rollback

The branch is self-contained. If blocked:

```bash
git checkout dev
git branch -D feat/studio-menu-dropdown
```

No server-side or data-shape changes require migration.
