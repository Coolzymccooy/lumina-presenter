# NDI Multi-Source (Phase 2) — Design Spec

**Date:** 2026-04-23
**Branch:** `feature/ndi-fill-key` (Phase 1 unmerged) → Phase 2 work continues on same branch or a follow-up `feature/ndi-multi-source`
**Scope:** Phase 2 of the Lumina Broadcast-Grade NDI Upgrade. Phase 3 (Tally Input) and Phase 4 (broadcast polish) are separate design cycles.

## Goal

Broadcast three simultaneous NDI sources from Lumina so downstream switchers (vMix, TriCaster, ATEM) can composite Lumina output natively without cropping, masking, or extra chroma-key work:

| Source name | Content | Fill+Key |
|---|---|---|
| `Lumina-Program` | Full Program output (current `/output` render) | No (opaque) |
| `Lumina-Lyrics` | Lyric text only on transparent bg | Yes (alpha) |
| `Lumina-LowerThirds` | Active lower-third chrome only on transparent bg | Yes (alpha) |

All three start together when the operator clicks "Start NDI" and stop together on stop. Downstream routers/tally bind to stable, always-present source names.

## Non-goals (deferred)

- Arbitrary / user-configurable scene list (Phase 4)
- Renaming sources in UI (Phase 4)
- Per-scene resolution / fps / bitrate tuning (Phase 4)
- Tally input (Phase 3)
- Switching a single sender between scenes on demand (explicitly rejected — broadcast workflows expect stable enumerable sources)

## Architecture

### 1. Main process — `electron/main.cjs`

Replace the singleton `ndiCaptureWindow` + `ndiSender` with a scenes map:

```
ndiSources: Record<SceneId, {
  window: BrowserWindow | null
  sender: NdiSenderInstance | null
  sourceName: string      // e.g. 'Lumina-Program'
  fillKey: boolean
  route: string           // hash route + query string to load
  active: boolean
  lastError?: string
}>
```

Scene ids: `'program' | 'lyrics' | 'lowerThirds'`.

**`ndi:start` handler**
1. If any source is already active, no-op and return current state.
2. For each scene, in parallel:
   - Spawn offscreen `BrowserWindow` (transparent=true + backgroundColor `#00000000` when `fillKey`; opaque for Program).
   - Load the scene's renderer route.
   - Instantiate `NdiSenderInstance(sourceName)` and wire `webContents.on('paint')` → `sender.sendVideoFrame`.
3. If any scene fails to initialise, tear down all successfully-created sources (windows + senders), revert state, emit error to renderer.
4. On success, set `ndiStatus.active = true`, broadcast status, return state.

**`ndi:stop` handler**
- Destroy all senders, close all capture windows, reset `ndiSources`, broadcast idle status.

**`ndiStatus`** payload shape:
```
{
  active: boolean,
  sources: Array<{
    id: 'program' | 'lyrics' | 'lowerThirds',
    sourceName: string,
    fillKey: boolean,
    active: boolean,
    lastError?: string
  }>
}
```

Status shape is a clean break from the Phase-1 `{ active, sourceName, fillKey }` shape. Since Lumina has no external IPC consumers, every listener is updated in the same commit — no transitional dual-field hack.

### 2. NDI sender layer — `electron/ndiSender.cjs`

Refactor singleton → factory.

```
// Before
module.exports = { start, stop, sendFrame, getSourceName, getStatus }

// After
class NdiSenderInstance {
  constructor(sourceName: string)
  async start(): Promise<void>
  sendVideoFrame(bgraBuffer, width, height): void
  async stop(): Promise<void>
  get sourceName(): string
  get active(): boolean
}

module.exports = { createSender: (name) => new NdiSenderInstance(name) }
```

Each instance owns its own grandiose handle and frame-pump timing. No shared state between instances.

### 3. Renderer — new routes

**`pages/LyricsNdi.tsx`** (new file)
- Mounted at hash route `#/lyrics-ndi`.
- Subscribes to the same live session channel Program uses (workspace + session id from URL params).
- Renders only the lyric text using the existing lyric renderer primitive (to be identified during implementation — likely the same component `/output` mounts for slide bodies).
- Transparent background via the existing `isNdiFillKey` effect pattern already in [App.tsx:1170](App.tsx#L1170).

**`pages/LowerThirdsNdi.tsx`** (new file)
- Mounted at hash route `#/lower-thirds-ndi`.
- Renders only the active lower-third using [components/slide-layout/presets/lowerThird.ts](components/slide-layout/presets/lowerThird.ts) primitives.
- Transparent background same as above.

**`components/ndi/NdiSceneShell.tsx`** (new file, optional)
- Small wrapper that handles the transparent-background DOM effect + session subscription boilerplate so both new routes stay focused on their scene content.

**Router wiring — `App.tsx`**
- Extend the top-level route switch that currently dispatches on `/output` vs `/stage` to also handle `/lyrics-ndi` and `/lower-thirds-ndi`.
- These routes render ONLY the scene shell — no header, menu, controls.

### 4. UI — `App.tsx`

Replace the current pair of Send-NDI + Fill+Key buttons with one dropdown control:

- **Master button**: `Start NDI` when idle, `● NDI LIVE (3/3)` when all up, `● NDI LIVE (2/3)` if one source is dead, `● NDI FAIL` if all down after a failed start.
- **Caret** opens a popover listing the three sources:
  - Green dot + `Lumina-Program` (Program)
  - Green dot + `Lumina-Lyrics` (Fill+Key) (Lyrics)
  - Green dot + `Lumina-LowerThirds` (Fill+Key) (Lower-thirds)
  - Red dot + error message if a source is down.

State in renderer:
```
ndiState: {
  active: boolean,
  sources: Array<{ id, sourceName, fillKey, active, lastError? }>
}
```

Remove `ndiFillKey` local state — the fill+key flag is now a property of each fixed scene, not a user toggle.

### 5. IPC surface (`electron/preload.js` + `env.d.ts`)

- `ndi:start` payload simplifies: `{ workspaceId, sessionId }`. No `sourceName` / `fillKey` — scene list is fixed.
- `ndi:stop` unchanged.
- `ndi:getStatus` returns the new shape (active + sources array).
- `ndi:onState` callback fires with the new shape.
- Update `env.d.ts` to reflect the new types.

## Data flow

```
User clicks Start NDI
  → IPC ndi:start { workspaceId, sessionId }
  → main: for each of 3 scenes in parallel
      → spawn BrowserWindow (transparent if fillKey)
      → load route (/output, /lyrics-ndi, /lower-thirds-ndi) with ?ndi=1 + fillKey param
      → createSender(sourceName).start()
      → window.webContents.on('paint', frame => sender.sendVideoFrame(...))
  → success: broadcast ndiStatus { active:true, sources:[3] }
  → failure at any scene: destroy all, broadcast idle + error

Renderer routes receive workspaceId/sessionId via query params → subscribe to live
session state → render their scene → paints flow out as NDI frames at 29.97.
```

## Error handling

| Scenario | Behaviour |
|---|---|
| One of 3 senders fails to init | Abort: tear down any already-created sources, emit error in UI dropdown, stay idle |
| Window crashes mid-broadcast | That source goes inactive; other two continue; dropdown flags the dead one with red dot + error |
| `ndi:start` called while already active | No-op, return current state |
| Grandiose binding missing | Same handling as today — surface error, stay idle |

## Testing

### Unit
- `NdiSenderInstance` lifecycle: create → start → sendVideoFrame → stop (no leaks)
- `ndi:start` partial-failure rollback: stub 3 senders, make 2nd fail, assert 1st is destroyed and state is idle
- Status shape: listener receives `{ active, sources:[3] }` with correct names + fillKey flags

### Manual smoke (pre-merge)
1. Open NDI Studio Monitor on same LAN.
2. Click Start NDI.
3. Confirm 3 sources appear: `Lumina-Program`, `Lumina-Lyrics`, `Lumina-LowerThirds`.
4. Confirm Program has no alpha, Lyrics + LowerThirds are transparent where empty.
5. Advance slides — all three sources update in real time.
6. Click Stop NDI — all 3 sources disappear cleanly.
7. Force-fail scenario: disable grandiose module → click Start → confirm graceful error, no zombie windows.

### Performance sanity
- Task Manager / Activity Monitor: CPU usage before vs during 3-source broadcast.
- Acceptance: runs without audio/frame dropouts on a mid-tier laptop (e.g. M2 / 16GB / integrated GPU). If it drops frames, Phase 4 quality tiers address it — not blocking Phase 2.

## Files touched

**Modified**
- `electron/main.cjs` — scenes map, new start/stop, status shape
- `electron/ndiSender.cjs` — singleton → factory
- `electron/preload.js` — no API changes expected; verify status forwarding
- `env.d.ts` — new `sources` array type
- `App.tsx` — router dispatch for new routes, state shape, NDI dropdown UI

**New**
- `pages/LyricsNdi.tsx`
- `pages/LowerThirdsNdi.tsx`
- `components/ndi/NdiSceneShell.tsx` (optional helper)

## Out of scope for this spec

- Tally input (Phase 3)
- Quality tiers, audio embedding, genlock, broadcast polish (Phase 4)
- User-configurable scenes / source names (Phase 4)

## Migration / compatibility

- Phase 1 (Fill+Key on single sender) is superseded by Phase 2. On merge, the single-sender fill+key path is removed and replaced with the 3-scene model. The renderer-side `isNdiFillKey` transparent-bg effect is retained and reused by the new routes.
- The IPC `ndi:start` payload shape changes. Since Lumina is a single-codebase Electron app (no external IPC consumers), this is a safe in-tree breaking change; no deprecation window needed.
