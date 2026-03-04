# Lumina Aether Integration Spec (Phase 1)

Status: In Progress  
Owner: Lumina Engineering  
Date: 2026-03-04  
Scope Lock: Phase 1 only

## Phase Boundary Statement
This specification is strictly for Phase 1: integrating Lumina output into an existing broadcast switcher pipeline using browser-source ingestion.  
This document does not approve or implement direct switcher control, direct stream destination orchestration, or OBS WebSocket automation.

## 1. Purpose and Context
Lumina operators want to use live lyrics/scripture/graphics inside established broadcast environments without replacing mature camera switching and encoding workflows.

Problem statement:
- Preserve broadcast-grade switching and directing in OBS/vMix (or equivalent).
- Use Lumina as a real-time graphics/scripture/stage engine.
- Reduce operator friction and scene-choreography overhead.

## 2. Scope (Phase 1 Locked)
In scope:
- Use Lumina Output URL as a browser source in external broadcast software.
- Keep camera switching/mixing/encoding/multi-destination output in existing broadcast software.
- Provide operator setup/runbook and reliability guidance.
- Define diagnostics taxonomy for common console noise.

Out of scope:
- OBS WebSocket or other control bridge implementation.
- Replacing existing ingest, switching, encoding, or destination routing stack.
- Direct Lumina control of YouTube/Facebook/RTMP destinations.

## 3. Goals and Non-Goals
Goals:
- Low-friction setup for technical directors.
- Predictable output behavior during live services.
- Clear fallback/recovery steps during runtime faults.
- Explicit understanding of non-fatal console noise categories.

Non-goals:
- Re-architecting broadcast control rooms around Lumina.
- Introducing new runtime authentication models in Phase 1.
- Building a switcher plugin ecosystem in this phase.

## 4. Reference Architecture
```text
Lumina Studio (Builder/Presenter)
  -> Lumina Output Route URL (#/output...)
    -> Browser Source (OBS/vMix/other)
      -> Existing switcher scenes + camera stack
        -> Existing encoder/output pipeline
          -> YouTube / other destinations
```

Control/data ownership:
- Lumina owns: content state, slide render, stage/support routes.
- Switcher owns: scene composition, transitions, encode, destination fan-out.
- Operator owns: launch order, source health checks, fallback scene behavior.

## 5. Operator Workflow
### 5.1 Pre-Service Checklist
1. Confirm Lumina API health endpoint returns `ok: true`.
2. Confirm signed-in workspace context (avoid `default-workspace` fallback during production control sessions).
3. Launch Lumina output route and validate active slide render.
4. Add/update browser source in switcher using locked width/height/FPS settings.
5. Load fallback scene in switcher (static background + emergency lower-third/text).
6. Validate audio policy expectations (Lumina output is graphics-first; audio should remain owned by switcher/mix console).

### 5.2 Live-Service Run Sequence
1. Start service scene stack in switcher.
2. Keep Lumina Studio in Presenter/Builder as control surface.
3. Advance content in Lumina; switcher ingests live output route.
4. Use switcher for transitions and destination management.

### 5.3 Failure Recovery Sequence
1. If Lumina source freezes/black screens, cut to fallback scene in switcher.
2. Refresh Lumina browser source once.
3. Validate session/workspace query parameters and API base host.
4. If unresolved, relaunch Lumina output route and rebind source.
5. Resume normal scene flow when source is stable.

## 6. Technical Requirements
### 6.1 Output URL Contract (Phase 1)
Expected pattern:
- `https://<lumina-host>/#/output?session=<sessionId>&workspace=<workspaceId>&fullscreen=1`

Optional explicit backend override (only when needed):
- `https://<lumina-host>/#/output?session=<sessionId>&workspace=<workspaceId>&fullscreen=1&api=<encodedApiBase>`

Examples:
- `https://lumina-presenter.vercel.app/#/output?session=live&workspace=church-main&fullscreen=1`
- `https://lumina-presenter.vercel.app/#/output?session=live&workspace=church-main&fullscreen=1&api=https%3A%2F%2Flumina-presenter-api-docker.onrender.com`

### 6.2 Browser Source Baseline
Recommended baseline:
- Resolution: 1920x1080
- FPS: 30 (or 60 only if end-to-end pipeline already runs 60)
- Hardware acceleration: enabled by default, disable only if GPU instability is observed
- Source buffering: low/near-live for worship/announcement cadence
- Audio handling: disable browser source audio unless intentionally required

### 6.3 Network and Runtime Expectations
- Stable internet required for cloud-backed workspace routes.
- Render service cold starts and auth gaps can affect non-anonymous workspace endpoints.
- Operators should pre-warm source before service start.

### 6.4 Workspace/Session Hygiene
- Use explicit non-default workspace IDs in production.
- Keep session IDs predictable per service block (`live`, `sunday-am`, etc.).
- Avoid mixed environment URLs in a single show file.

## 7. Compatibility Matrix
| Broadcast Tool | Phase 1 Support | Notes |
|---|---|---|
| OBS Studio | Supported | Use Browser Source with locked 1080p profile and fallback scene. |
| vMix | Supported | Use Web Browser Input with equivalent render dimensions/FPS. |
| Other switchers (Wirecast/Tricaster-class) | Conditionally supported | Must support stable browser/web render ingestion and scene fallback control. |

Platform notes:
- Windows: primary validated environment for Lumina desktop operations.
- macOS: supported for browser-source workflows if host browser render engine remains stable under sustained load.

## 8. Security and Access
- Backend API base must point to intended environment for the service window.
- Workspace-backed endpoints require authenticated context (or explicit headers in backend-to-backend flows).
- Do not expose server API keys in frontend runtime variables.
- Keep AI/provider keys server-side only.

## 9. Console Noise Diagnostics
### 9.1 Symptom Table
| Symptom | Probable Cause | Severity | Operator Impact |
|---|---|---|---|
| Repeated `404` on `/api/workspaces/default-workspace/...` | Workspace fallback to `default-workspace` and polling/heartbeat routes running without initialized workspace state | Medium | Console spam; possible sync/connection indicator instability |
| `GET /favicon.ico 404` | Missing favicon asset at host root | Low | Cosmetic console noise only |
| `Tracking Prevention blocked access to storage` | Browser privacy feature (Edge/Chromium policy) | Low | Usually non-fatal unless strict storage isolation breaks auth/session persistence |
| `Anti-sleep audio ... element has no supported sources` | Silent anti-sleep media element started without playable source/codec support | Low | No direct slide failure; warning only |

### 9.2 Immediate Operator Mitigations
1. Confirm explicit workspace in URL/query and authenticated user context before go-live.
2. Confirm API base points to the active backend service for the event.
3. Ignore non-fatal favicon/privacy warnings during active show unless functional symptoms appear.
4. Keep fallback scene armed to avoid on-air troubleshooting impact.

### 9.3 Engineering Follow-Up Task List
- `AETHER-NOISE-001`: Suppress/slow polling retries when workspace is unresolved or returns predictable `WORKSPACE_NOT_FOUND`.
- `AETHER-NOISE-002`: Add explicit runtime banner when app is operating on `default-workspace`.
- `AETHER-NOISE-003`: Add `public/favicon.ico` to remove static 404 noise.
- `AETHER-NOISE-004`: Guard anti-sleep audio start behind feature detection and valid source readiness.
- `AETHER-NOISE-005`: Add structured log levels to separate fatal sync errors from expected transient warnings.

## 10. Phase 2 Preview (Informational Only)
Future concept (not in this phase):
- Control bridge via OBS WebSocket/API so Lumina actions can trigger scene transitions or overlays automatically.

Future design constraints:
- Must remain optional and non-breaking for teams without OBS automation.
- Must include deterministic mapping layer (Lumina action -> switcher command).
- Must provide safe rollback to manual-only control.

## 11. Public API / Interface Impact
Phase 1 implementation scope in this branch is docs-only:
- No application API changes.
- No contract-breaking route changes.
- No type/schema migrations.

Documented expectations introduced:
- Output URL contract usage (session/workspace query parameters).
- Browser source baseline configuration contract.
- Operator-facing error taxonomy for console diagnostics.

## 12. Test Cases and Scenarios (Spec Validation)
1. Doc completeness review:
   - A second engineer can configure Lumina + OBS from this doc only.
2. Operator dry run:
   - Run setup checklist and one simulated recovery event.
3. Noise triage reproducibility:
   - Match each warning/error to cause + mitigation from section 9.
4. Scope gate:
   - Verify all Phase 2 elements remain informational and not required.

## 13. Acceptance Criteria
- The document is actionable for both operations and engineering teams.
- Phase 1 scope and non-goals are explicit and unambiguous.
- Console noise section distinguishes non-fatal warnings from operational blockers.
- Follow-up engineering tasks are enumerated and implementation-ready.

## 14. Conclusion
Phase 1 formally positions Lumina as a graphics/scripture engine inside existing broadcast stacks without replacing switcher/encoder responsibilities.  
Phase 2 automation remains intentionally deferred and does not affect Phase 1 readiness.
