# Follow-up: TDZ / use-before-define guardrail

**Created:** 2026-04-21
**Context commit:** `897e94e fix(app): hoist initialSavedStateRef above first consumer to resolve TDZ crash`

## Context prompt (paste into a fresh Claude Code session)

> In `feat/studio-menu-dropdown` (or `dev` if already merged), commit `897e94e` fixed a
> runtime `ReferenceError: Cannot access 'initialSavedStateRef' before initialization`
> in `App.tsx`. A `useRef` was declared ~90 lines below a `useState(() => ...)` initializer
> that read its `.current`, putting the ref in the Temporal Dead Zone at first render.
>
> `tsc --noEmit` did **not** catch it because TypeScript's TDZ analysis is conservative
> across closures (the `useState` initializer is a closure, so tsc assumes the ref may be
> initialized by the time the closure runs).
>
> Task: add a static guardrail so this class of bug fails at lint/CI time, not at runtime.
>
> Scope:
> 1. Install `eslint` + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
>    as devDependencies. Match the project's existing TS version (~5.8).
> 2. Add a minimal `eslint.config.js` (flat config, since the project is `"type": "module"`)
>    that enables **only** the rule needed for this guardrail:
>    - `@typescript-eslint/no-use-before-define`: `{ variables: true, functions: false, classes: false, typedefs: false, ignoreTypeReferences: true }`
>    - Target: `**/*.{ts,tsx}`, ignore `dist/`, `release/`, `node_modules/`, `server/` JS files, `electron/` CJS files.
> 3. Add `"lint": "eslint ."` to `package.json` scripts.
> 4. Run it once; fix any genuine violations it surfaces (there may be more than the one we
>    just patched). Do NOT expand scope to other rules — keep this PR focused.
> 5. Wire it into CI if the project has a CI workflow (check `.github/workflows/`). If not,
>    skip CI wiring and just ensure the script runs locally.
>
> Hard constraints:
> - Do not add any other ESLint rules in this pass. No style rules, no react-hooks, no import
>   sort. Just `no-use-before-define`. We can broaden later.
> - Do not reformat existing files. The rule should only flag; no `--fix` sweep.
> - If violations are widespread and fixing them would balloon scope, report back with the
>   count and the files involved before changing anything.
>
> Deliverable: one commit on a new branch `chore/lint-tdz-guardrail`, a PR against `dev`,
> and a note on whether the rule surfaced additional real TDZ bugs beyond the one already
> fixed.

## Why defer

- Adds a new tool (ESLint) + config to a project that currently has none — non-trivial setup.
- Root cause is fixed; ErrorBoundary catches any recurrence at runtime in the meantime.
- Better handled in its own focused PR than bundled into the recording-save-to-mixer feature branch.

## Alternatives considered

- **Custom node script** scanning `.tsx` for use-before-declare — lower coverage, more maintenance.
- **Rely on ErrorBoundary + manual review** — status quo; no static catch.
