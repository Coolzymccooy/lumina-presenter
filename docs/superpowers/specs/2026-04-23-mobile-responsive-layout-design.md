# Mobile-Responsive Studio Layout — Design Spec

**Date:** 2026-04-23
**Status:** Approved for implementation
**Scope:** Webapp only (Coolify deploy). Electron desktop app is unaffected.

---

## 1. Problem

The Lumina Presenter webapp is desktop-only. On phones, the three-tab Studio UI (Builder / Presenter / Stage) renders its three-column desktop grid at phone widths, causing the right rails (Cue Engine, Stage Ops, Live Rail) and several header controls to be chopped off the right edge. The user needs a mobile layout that exposes every feature for on-the-fly investor demos without redesigning the desktop experience.

## 2. Goals

- All features reachable on phones ≤ 428px width (iPhone Pro Max reference).
- No horizontal overflow on the viewport root.
- Each of the three tabs (Builder, Presenter, Stage) works in mobile mode.
- Zero change to the Electron desktop app or desktop browser ≥ 768px.
- Shippable to Coolify via a single `master` push.

## 3. Non-Goals

- Slide editing UX on mobile (text element editor, canvas format toolbar) remains desktop-only. On mobile the canvas is view-only.
- Advanced NDI Fill+Key admin UI remains desktop-only.
- Tablet-specific breakpoint tuning. Tablets (≥ 768px) render desktop mode.
- Offline / PWA installability.
- Touch-specific gesture features (pinch-zoom on canvas, swipe between slides). Buttons only.

## 4. Architecture Overview

### 4.1 Single detection boolean

```
isMobileShell = !isElectronShell && viewportWidth < 768
```

Computed once in [App.tsx](../../../App.tsx) alongside the existing `viewportWidth` state at line 1335. Threaded into `PresenterDesktopShell` and `AppHeader` as a new prop.

### 4.2 Shell behavior fork

[components/workspace/PresenterDesktopShell.tsx](../../../components/workspace/PresenterDesktopShell.tsx) gets a mobile code path. Desktop path is untouched.

- **Desktop (≥ 768px or Electron):** current 3-column CSS grid, unchanged.
- **Mobile (< 768px in browser):**
  - Single visible pane at a time, full-width, full-height minus header/tabbar.
  - Internal state `mobilePane: 'left' | 'center' | 'right' | 'bottom'`, default `'center'`.
  - Bottom tab bar renders as a fixed 56px-tall row with 2–4 tab buttons (depending on which panes the parent provided).
  - Resize handles not rendered.

### 4.3 Tab labels per mode

A lookup `MOBILE_TAB_LABELS` inside `PresenterDesktopShell`:

| `mode`      | left             | center  | right     | bottom   |
|-------------|------------------|---------|-----------|----------|
| `builder`   | Plan             | Stage   | Rail      | Dock     |
| `presenter` | Schedule         | Stage   | Live      | Library  |
| `stage`     | Config           | Preview | Ops       | —        |

If `hideRightPane` is true or `rightPane` is undefined, its tab button is omitted. If `bottomPane` is undefined, its tab button is omitted.

### 4.4 Header (`components/layout/AppHeader.tsx`)

Mobile variant stacks into two rows:

- **Row 1 (48px):** home button (left), mode switcher pills (BUILDER / PRESENTER / STAGE) center-aligned and horizontally scrollable if they overflow, kebab menu button (right).
- **Row 2 (36px):** condensed StatusHub showing up to 2 priority chips (output-live, connection status) + `[+N more]` button that opens the full hub as a bottom sheet.

Kebab menu opens the existing `QuickActionsMenu` (already used on desktop), containing: Settings, Help, Guided Tours, Update controls, copy-URL helpers. No net-new menu component.

### 4.5 Pane internal fixes

The following components need overflow discipline so a full-width mobile pane renders without horizontal clipping. No structural rewrites.

- `BuilderRightRail` — ensure all flex rows have `flex-wrap`, replace any `whitespace-nowrap` that isn't truly required.
- `BuilderBottomDock` — chip row already has `flex-wrap`; audit and confirm. Title/subtitle already truncates.
- `BuilderInspectorAccordion`, `BuilderCuePanel`, `BuilderNotesAffordance` — swap any fixed-pixel widths for `min-w-0` + `flex-1`.
- Presenter `LivePane`, `renderPresenterBetaLivePane` inline content — same audit.
- `StageWorkspace` — same audit.

All fixes are additive classes on existing divs. No new components.

## 5. Component Boundaries

```
App.tsx
  ├─ computes isMobileShell (new)
  ├─ passes isMobileShell to AppHeader
  └─ passes isMobileShell to PresenterDesktopShell (via new prop)
       ├─ desktop path (existing) — grid with left/center/right/bottom
       └─ mobile path (new) — single active pane + bottom tab bar
            ├─ internal mobilePane state
            └─ reads MOBILE_TAB_LABELS[mode]

AppHeader.tsx
  ├─ desktop path (existing)
  └─ mobile path (new) — two-row stack with kebab menu
```

### 5.1 Interface changes

`PresenterDesktopShellProps` adds:

```
isMobileShell?: boolean;  // defaults to false
```

`AppHeaderProps` adds:

```
isMobileShell: boolean;
```

No other prop changes. No removed props.

## 6. Touch Targets & Accessibility

- All mobile-reachable buttons: minimum 44×44px hit area.
- Bottom tab bar: role="tablist", each button role="tab", aria-selected reflects `mobilePane`.
- Header kebab: role="button", aria-haspopup="menu", aria-expanded reflects open state (already exists in `QuickActionsMenu`).
- No hover-only affordances. Any `hover:` that hides a control gains a mobile-visible equivalent.
- Color contrast unchanged from desktop (existing zinc/cyan palette already meets WCAG AA).

## 7. Testing

New Playwright spec: [tests/e2e/mobile-responsive.spec.ts](../../../tests/e2e/mobile-responsive.spec.ts), tagged `@smoke` so it runs in CI on every PR.

Viewport: `{ width: 375, height: 812 }` (iPhone X reference).

For each of Builder / Presenter / Stage tabs:

1. **No horizontal overflow** — assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` + 1px tolerance.
2. **Bottom tab bar visible** — assert `[data-testid="mobile-tab-bar"]` is visible.
3. **Tab switching works** — click each tab button (`[data-testid="mobile-tab-left"]`, `-center`, `-right`, `-bottom`), assert the corresponding pane wrapper (`[data-testid="mobile-pane-left"]`, `-center`, `-right`, `-bottom`) is the only one visible.
4. **Header kebab menu opens** — click `[data-testid="mobile-header-kebab"]`, assert Settings and Help menu items render.

No unit tests. The behavior is pure DOM layout and is best verified end-to-end.

## 8. Error Handling

No new error paths. The mobile code path uses the same data as the desktop code path; it only re-renders the same React subtrees in a different container.

If `viewportWidth` is 0 or undefined during the first paint (e.g., SSR-like edge case), default to desktop mode — desktop is the safer fallback since all features remain reachable.

## 9. Deploy

- Feature branch: `feature/mobile-responsive-layout`.
- Merge to `master` with `--no-ff`.
- Coolify auto-deploys webapp on push to `master`.
- **No** Electron build, **no** GitHub release tag.
- Commit reference to this spec in the final merge commit body.

## 10. Out-of-scope follow-ups (not part of this spec)

- Mobile editing UX for slide content.
- Tablet-optimized intermediate layout.
- PWA install manifest.
- Gesture navigation between slides.
- Mobile-optimized NDI Fill+Key admin.

These are tracked here for future consideration; do not implement in this pass.
