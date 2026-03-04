# Lumina Aether Control Bridge Spec (Phase 2/3)

Status: Active  
Owner: Lumina Engineering  
Date: 2026-03-04

## 1) Purpose
Phase 1 covers browser-source ingest only.  
This spec defines the next phases: Lumina sends real-time control events to an Aether bridge endpoint so Aether can automate scene behavior during live broadcast.

## 2) Scope
In scope:
- Bridge ping/health verification from Lumina UI.
- Runtime state sync events (current item/slide/routing/blackout/timer).
- Scene switch command events (Program, Blackout, Lobby).
- Optional token-based request authentication.

Out of scope:
- Direct RTMP destination management by Lumina.
- Replacing Aether scene/composition ownership.
- Hard dependency on any single switcher vendor.

## 3) Endpoint Contract (Aether Side)
Lumina sends `POST` JSON requests to a configured URL.

Required request headers:
- `content-type: application/json`
- `x-lumina-event`: event type string
- `x-lumina-workspace`: workspace ID
- `x-lumina-session`: session ID

Optional request header:
- `x-lumina-token`: shared secret configured in Lumina Connect Modal

Expected success response:
- HTTP `2xx`
- Optional JSON body:
  - `{ "ok": true, "message": "accepted" }`

Expected failure response:
- Non-2xx with JSON message when possible:
  - `{ "ok": false, "message": "reason" }`

## 4) Event Types
### `lumina.bridge.ping`
Purpose:
- Connectivity/auth check before enabling automation.

Payload shape:
```json
{
  "app": "lumina-presenter",
  "mode": "BUILDER|PRESENTER",
  "workspaceId": "string",
  "sessionId": "string"
}
```

### `lumina.state.sync`
Purpose:
- High-frequency state updates for intelligent automation cues.

Payload highlights:
- `sceneTarget`: `program|blackout|lobby`
- `sceneName`: resolved Aether scene label from Lumina settings
- `runtime`: blackout/routing/playback/mute/lowerThirds
- `activeItem`: id/title/type
- `activeSlide`: index/label/preview
- `stage`: timer + active stage message
- `urls`: output/stage/remote routes

### `lumina.scene.switch`
Purpose:
- Explicit scene take command from operator.

Payload shape:
```json
{
  "target": "program|blackout|lobby",
  "sceneName": "Program",
  "workspaceId": "string",
  "sessionId": "string"
}
```

## 5) Envelope Format
Lumina wraps event payload in:
```json
{
  "source": "lumina-presenter",
  "version": "1.0",
  "event": "lumina.state.sync",
  "sentAt": "2026-03-04T20:00:00.000Z",
  "workspaceId": "workspace-id",
  "sessionId": "live",
  "payload": {}
}
```

## 6) Aether Implementation Checklist
1. Add authenticated POST receiver endpoint for the contract above.
2. Validate `x-lumina-token` when configured.
3. Parse `x-lumina-event` and route to handlers:
   - ping -> ack
   - state sync -> update internal automation state cache
   - scene switch -> execute immediate scene transition
4. Implement idempotent scene execution (ignore duplicate same-scene commands when already active).
5. Log each event with `workspaceId`, `sessionId`, `event`, and latency.
6. Return clear non-2xx JSON on validation or execution failure.

## 7) Recommended Reliability Rules
1. Keep receiver timeout under 4s for scene commands.
2. Rate-limit high-volume `state.sync` processing internally (do not block UI thread).
3. Apply safe fallback when scene name from Lumina is unknown:
   - either map to default Program scene or return controlled error.
4. Never crash stream pipeline on malformed payloads; reject and continue.

## 8) Operator Flow (Lumina)
1. Open Connect -> Aether panel.
2. Set bridge URL and optional token.
3. Click `PING BRIDGE`.
4. Configure Program/Blackout/Lobby scene names.
5. Enable `Bridge` and `Auto-sync`.
6. Use `SYNC NOW` and scene buttons for manual overrides during service.

## 9) Security Notes
- Keep provider/API keys server-side; do not expose unrelated secrets in frontend.
- Bridge token is treated as local operator secret in Lumina and is stored in local browser storage only.
- Prefer private network paths or mTLS/VPN for production bridge traffic.
