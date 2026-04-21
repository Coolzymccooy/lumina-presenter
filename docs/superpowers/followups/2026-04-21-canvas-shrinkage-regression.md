# Follow-up: Preview canvas horizontal shrinkage regression

**Created:** 2026-04-21
**Context branch:** `feat/studio-menu-dropdown` (merged to `dev`)
**Severity:** HIGH — breaks canvas-stability invariant on 12–15" laptop displays
**Status:** Deferred (plan only — do NOT implement in this branch)

---

## Symptom

On smaller laptop viewports (roughly **1280–1536 px wide**, typical of 12"–15" screens),
the **preview canvas horizontally shrinks / gets chopped** under two distinct triggers:

1. **Long STUDIO breadcrumb text** — when a tab is active (e.g. `STUDIO > SCHEDULE`
   or longer labels like `STUDIO > BIBLE HUB`), the breadcrumb/indicator text in the
   left-column chrome **grows past a visual marker** and pushes the canvas column
   rightward, reducing its width.
2. **All three bottom-rack panels expanded** — when `Transport`, `Timer + Cue`,
   **and** `Rundown + Output` CollapsiblePanels are all open at once, their combined
   height/width reflows the grid, and the preview canvas **shrinks horizontally**.
   Collapsing any of the three restores canvas width.

Both regressions are invisible on ≥ 1920 px displays because there is slack horizontal
room. They are **obvious on 12"–15" laptops** — the exact form-factor pastors/operators
run Lumina on.

The core invariant this branch already codified (`studio-menu-canvas-stability.spec.ts`)
is: **the preview canvas MUST NEVER reflow / resize when chrome changes state.**
These two cases violate that invariant in ways the current spec does not exercise
(it only asserts width stability across menu open/close, not panel expansion or
breadcrumb length).

---

## Desired behaviour (from the user)

> "We don't ever allow the preview canva shrinks."
>
> "I want the exact behavior of the ai assistant button that doesn't occupy any space."
>
> "Shrinks often happens in smaller screens of between 12–15" screens so we can manage
> the overflow."
>
> "When all three Transport, Timer + Cue and Rundown + output get enlarged they impact
> the preview canva shrinking and when they are collapsed, then the preview canva get
> stabilized."

**Translation:**

- The STUDIO breadcrumb indicator must behave like the AI Assistant button —
  **floating / portaled / `position: absolute`**, not consuming grid / flex width.
- The bottom-rack trio must **never steal horizontal space** from the canvas
  column regardless of expansion state. Overflow is acceptable (scroll / clip /
  compact), shrinking the canvas is not.
- Applies specifically to narrow viewports; normal behaviour on wide screens
  should be preserved where possible.

---

## Context prompt (paste into a fresh Claude Code session)

> In `dev` (or a new branch off `dev`), there is a regression where the preview
> canvas horizontally shrinks on **1280–1536 px viewports** under two triggers:
>
> 1. Long STUDIO breadcrumb text in the left-column chrome (e.g. `STUDIO > SCHEDULE`)
>    pushes past a visual marker and squeezes the canvas.
> 2. Expanding all three bottom-rack CollapsiblePanels (`Transport`, `Timer + Cue`,
>    `Rundown + Output`) simultaneously reflows the grid and shrinks the canvas.
>
> The existing invariant — codified in `tests/e2e/studio-menu-canvas-stability.spec.ts`
> — is that the preview canvas **must never reflow** when chrome changes state. These
> two cases violate it; the existing spec doesn't catch them because it runs at the
> default Playwright viewport and only toggles menus, not panels.
>
> The AI Assistant button is the reference pattern for the breadcrumb fix: it
> **doesn't occupy any layout space** (floating / absolute-positioned / portaled).
> Apply the same approach to the STUDIO breadcrumb indicator so it cannot push the
> canvas column.
>
> **Scope (three discrete sub-tasks):**
>
> **1. Failing regression spec first (TDD).**
>    Extend `studio-menu-canvas-stability.spec.ts` **or** add a new spec
>    `canvas-width-stability.spec.ts` with:
>    - Viewport explicitly set to **1280×800** (and optionally 1366×768) via
>      `test.use({ viewport: { width: 1280, height: 800 } })`.
>    - **Case A:** record canvas `boundingBox().width` with no tab active, then
>      activate `SCHEDULE`, then re-read the width. Assert delta ≤ 1 px.
>    - **Case B:** collapse all three bottom-rack panels
>      (`presenter-panel-transport`, `presenter-panel-timer-cue`,
>      `presenter-panel-rundown-output`) via their `-header` test ids; record
>      canvas width; expand all three; re-read width; assert delta ≤ 1 px.
>    - Both cases MUST fail on current `dev` — if they pass, the reproduction
>      isn't modelling the real issue yet; adjust viewport / panel sequence until
>      they fail, then start implementing.
>
> **2. Breadcrumb fix.**
>    Refactor whichever component renders the `STUDIO > <TAB>` indicator in the
>    left-column chrome (likely inside or adjacent to `StudioMenu` / the left
>    column header — grep for the text / the tab name rendering). Apply the
>    AI Assistant button pattern:
>    - `position: absolute` relative to a stable ancestor, **or** render via
>      `ReactDOM.createPortal` into a floating overlay layer, so it is taken
>      **out of layout flow**.
>    - Preserve hover tooltips and click/keyboard affordances exactly.
>    - Visually anchor to the same spot; truncate / `text-overflow: ellipsis`
>      if it genuinely needs to stay inline on wide viewports (confirm with
>      the user before choosing between "always floating" vs "floating only
>      below a breakpoint").
>
> **3. Bottom-rack fix.**
>    Inspect the grid/flex container that hosts the bottom-rack trio plus the
>    canvas (search for the three `presenter-panel-*` ids and trace up to their
>    common ancestor). Options, in preference order:
>    - Lock the canvas column to `min-width: <value>` / `flex: 1 1 <fixed>` so it
>      cannot yield width to sibling panels on narrow viewports.
>    - Move the bottom-rack panels into a row below / above the canvas (vertical
>      stacking) on narrow breakpoints, so horizontal pressure disappears.
>    - Allow the rack panels to overflow / scroll horizontally instead of
>      consuming canvas width.
>    Whatever option is chosen, Case B of the spec must pass.
>
> **Hard constraints:**
> - The new spec MUST be deterministic — seed the session like
>   `studio-menu-canvas-stability.spec.ts` does.
> - Do not touch tests or code outside the breadcrumb + bottom-rack containers.
>   No drive-by cleanups.
> - Do not break the existing `studio-menu-canvas-stability.spec.ts` cases.
> - Do not regress wider (≥ 1920 px) viewports — if a fix is breakpoint-specific,
>   gate it with an explicit media query rather than a blanket rewrite.
> - Hover tooltips on the breadcrumb MUST survive the float/portal refactor.
>
> **Deliverable:** one focused branch off `dev`, commits that read:
> `test(canvas): failing spec for width stability at 1280×800` →
> `fix(studio-menu): float breadcrumb out of layout flow` →
> `fix(layout): keep canvas column width stable when bottom rack expands`.
> PR body must state which trigger each commit addresses.

---

## Why defer

- The STUDIO dropdown branch (`feat/studio-menu-dropdown`) has already grown large;
  bundling this would push it past review-friendly size.
- The root cause is layout/grid-specific; it needs its own TDD cycle with a
  deliberately narrow viewport, which is orthogonal to the dropdown refactor.
- User explicitly asked for a plan to deal with later — not an immediate fix.

## Alternatives considered

- **Global `min-width` on the canvas column without fixing the breadcrumb** —
  rejected. Stops bottom-rack shrinkage but leaves the breadcrumb overflowing
  past the marker (case 1).
- **Truncate the breadcrumb with CSS only** — partial fix; still occupies layout
  width and still fights the marker on tight viewports.
- **Collapse bottom-rack panels automatically below a breakpoint** — rejected.
  Operator intentionally opens panels; auto-collapse would fight their workflow.
