# Studio Menu & Quick Actions Dropdown — Design Spec

**Date:** 2026-04-21
**Branch target:** new feature branch off `dev`
**Status:** Approved design, pending implementation plan

---

## Problem

Two left/right-rail UI affordances in the Studio shell have created user-visible regressions and poor UX:

1. **Left sidebar** (`activeSidebarTab` chrome in [App.tsx](../../../App.tsx)): users complain about the hover-open/hover-close behaviour when the sidebar is unpinned. The sidebar sometimes overlaps the Builder/Presenter preview canvas in ways that cannot be recovered without refreshing the app.
2. **Right dock** ([components/layout/RightDock.tsx](../../../components/layout/RightDock.tsx)): renders as a persistent `<aside>` column that permanently occupies horizontal space next to the preview canvas. Its wand-button toggle lives in [components/layout/AppHeader.tsx](../../../components/layout/AppHeader.tsx), but the panel itself is always-wide when open, not anchored to the button.

Both patterns reflow the main canvas layout, which is the root cause of the "chops into the preview" regression.

## Goal

Replace both patterns with click-anchored dropdowns that:

- Open only on explicit click (no hover).
- Overlay the canvas; never reflow or shrink its column width.
- Dismiss on outside-click or Escape.
- Keep every existing tab/action and its behaviour unchanged — only the chrome changes.

## Non-goals

- No redesign of individual tab panels (Bible Hub, Hymns, Schedule, etc.).
- No change to electron display-control flows, Aether, or Connect semantics.
- No change to the builder/presenter preview canvas itself.
- No relocation of tabs between left and right rails.

## Architecture

### New component: `StudioMenu` (left rail)

- Renders a single button labelled `STUDIO` with a caret/arrow indicator.
- When active tab is open, button may show the active tab name, e.g. `STUDIO › BIBLE HUB ▾` (nice-to-have, not required).
- Click opens an anchored dropdown listing all 7 tabs:
  1. Schedule
  2. Hymns
  3. Files
  4. Audio Mixer
  5. Bible Hub
  6. Audience
  7. Macros
- Selecting an item sets `activeSidebarTab` and opens that tab's panel as a docked left column (same visual position and width as today's pinned sidebar).
- Selecting the already-active tab collapses the panel entirely (no tab active).
- Outside-click or Escape closes **the dropdown only**; the open tab panel persists.
- File: `components/layout/StudioMenu.tsx`.

### Refactored component: `QuickActionsMenu` (was `RightDock`)

- Replaces the persistent `<aside>` with an absolutely-positioned popover anchored beneath the wand button in `AppHeader`.
- Same four items as today, in the same order:
  1. CONNECT (audience devices)
  2. AETHER (multi-screen bridge)
  3. AI ASSIST (Gemini / lyrics / help)
  4. START SERVICE / MACHINE MODE (unchanged electron-gated behaviour)
- Outside-click or Escape closes.
- z-index above canvas; no layout reflow.
- File: `components/layout/QuickActionsMenu.tsx` (rename/restructure of `RightDock.tsx`).

### State changes in `App.tsx`

- Keep: `activeSidebarTab`, `handleSidebarTabSelect`, all tab-panel render branches, all hydration persistence of `activeSidebarTab`.
- Remove/deprecate: `isSidebarHovering`, `sidebarPinned`, `presenterSidebarDrawerOpen`, `sidebarExpanded` computed value, `presenterSidebarDrawerVisible`, any `onMouseEnter`/`onMouseLeave` on the sidebar shell, persistence of `sidebarPinned`.
- Replace: `isRightDockOpen` remains (now controls the `QuickActionsMenu` popover).
- Add (if needed): `isStudioMenuOpen` local state within `StudioMenu` (does not need to live in `App.tsx`).

## Guardrail against canvas regression

This is the primary UX concern. Rules enforced by the new design:

1. The main canvas column's width is determined **only** by whether a tab panel is docked — not by hover, not by any dropdown open-state, not by right-dock open-state.
2. Dropdowns render as overlays using `position: absolute` / `position: fixed` relative to their anchor button, with appropriate `z-index`. They are siblings-to-header / portaled, never siblings inside the canvas flow that could push content.
3. Remove every `onMouseEnter`/`onMouseLeave` handler on the sidebar shell.
4. Remove `sidebarPinned` hydration and related keyboard shortcuts.
5. QuickActionsMenu replaces a `w-56` persistent column. Canvas reclaims this width when no dock is open.
6. Playwright regression test (new): opens Bible Hub → closes → opens Schedule → closes, repeating five times. Asserts that the Builder/Presenter preview's bounding box is stable (no shrinkage, no stuck overlay).

## Behaviour summary

| Action | Result |
|---|---|
| Click `STUDIO ▾` | Dropdown opens |
| Click dropdown item (inactive tab) | `activeSidebarTab` set, panel opens, dropdown closes |
| Click dropdown item (active tab) | Panel closes, dropdown closes |
| Click `STUDIO ▾` while panel open | Dropdown opens (panel stays) |
| Click outside dropdown | Dropdown closes, panel stays |
| Escape | Closes dropdown if open; else closes panel; else closes QuickActionsMenu |
| Arrow Up/Down | Navigate dropdown items |
| Enter on dropdown item | Activate item |
| Click wand button | Toggle QuickActionsMenu popover |
| Click outside QuickActionsMenu | Close popover |

## Components & contracts

### `StudioMenu`

```ts
interface StudioMenuProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  // When a tab is active and user clicks STUDIO button, dropdown opens as usual.
  // When user clicks the active tab, parent should toggle off by setting activeTab === null-equivalent.
  onClosePanel: () => void;
  hasOpenPanel: boolean;
}

type SidebarTab = 'SCHEDULE' | 'HYMNS' | 'FILES' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'MACROS';
```

### `QuickActionsMenu`

```ts
interface QuickActionsMenuProps {
  anchorRef: React.RefObject<HTMLElement>;
  isOpen: boolean;
  onClose: () => void;
  onOpenConnect: (mode: 'audience' | 'aether') => void;
  onOpenAI: () => void;
  // existing electron/display-control props carried over unchanged
  hasElectronDisplayControl: boolean;
  desktopServiceState: DesktopServiceState | null;
  onStartService: () => void;
  onStopService: () => void;
}
```

## Testing strategy

### Unit / component tests

- `StudioMenu`: opens on click, closes on outside-click, Escape, item selection; keyboard navigation (arrow + Enter); reports correct `onSelectTab`/`onClosePanel` calls.
- `QuickActionsMenu`: opens on anchor click, closes on outside-click, Escape; all four actions fire correct callbacks.

### E2E (Playwright)

- `tests/e2e/studio-menu-canvas-stability.spec.ts` — the regression guardrail:
  - Open each of the 7 tabs via StudioMenu, close via StudioMenu, × 5 cycles.
  - Assert `data-testid="builder-preview-root"` (or equivalent existing selector) bounding-box width remains within ±1px of initial.
  - Open QuickActionsMenu and verify it does not affect canvas bounds.
  - Verify no "stuck overlay" DOM after rapid open/close.
- Update any existing sidebar E2E specs that rely on hover to use click instead.

### Regression risk

- Existing tests that rely on `sidebarPinned` or hover-to-open behaviour will need updating. Audit `tests/e2e/*.spec.ts` for `sidebarPinned`, `isSidebarHovering`, or mouse-hover on the sidebar and migrate to click.

## Accessibility

- Buttons have `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`.
- Dropdown panel has `role="menu"` with `role="menuitem"` on each item.
- Focus moves into the dropdown on open; focus returns to the button on close.
- Full keyboard operability: Tab, Shift+Tab, Arrow keys, Enter, Escape.

## Files touched

**New:**
- `components/layout/StudioMenu.tsx`
- `components/layout/QuickActionsMenu.tsx` (from `RightDock.tsx`)
- `components/layout/StudioMenu.test.tsx`
- `components/layout/QuickActionsMenu.test.tsx`
- `tests/e2e/studio-menu-canvas-stability.spec.ts`

**Modified:**
- `App.tsx` — replace sidebar chrome (~lines 8599–8760); remove hover/pin plumbing; render `StudioMenu`; update `RightDock` import and render path to `QuickActionsMenu` anchored to wand button.
- `components/layout/AppHeader.tsx` — expose a ref for the wand button anchor; keep `onClick`/`isRightDockOpen` semantics.

**Deleted:**
- `components/layout/RightDock.tsx` (superseded by `QuickActionsMenu.tsx`).

## Migration notes

- `sidebarPinned` persisted in hydration state: on load, silently drop this field (no migration required; it was purely a UI preference).
- If `activeSidebarTab` was persisted, preserve it as-is.

## Rollback

If the new menu is regressed, the change is self-contained in three files. Revert the App.tsx chrome block, restore `RightDock.tsx`, remove the new `StudioMenu.tsx` and `QuickActionsMenu.tsx`. No server-side or data-shape changes to migrate.

## Open questions

None at spec time. All interaction questions resolved with user during brainstorm.
