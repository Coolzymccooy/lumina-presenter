<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lumina Presenter

Lumina is a church-focused presentation app for lyrics, scripture, announcements, motion backgrounds, stage confidence monitoring, and remote/live control.

## Run Locally

**Prerequisites:** Node.js 20+ and npm

1. Install dependencies:
   - `npm install`
2. Configure `.env.local`:
   - `GOOGLE_AI_API_KEY=...` (backend only; do not prefix with `VITE_`)
   - `VITE_PEXELS_API_KEY=...` (optional)
   - `VITE_PIXABAY_API_KEY=...` (optional)
   - `VITE_API_BASE_URL=http://localhost:8787` (optional; default is already `http://localhost:8787`)
3. (Optional for full visual PowerPoint import) install LibreOffice and ensure `soffice` is on PATH.
   - Optional server env override: `LUMINA_SOFFICE_BIN=/full/path/to/soffice`
   - Local cache/version override (optional): `LUMINA_VIS_CACHE_VERSION=v4`
4. Start backend API (Terminal A):
   - `npm run server`
5. Start frontend (Terminal B):
   - `npm run dev`
6. Open app:
   - `http://localhost:5173`

Notes:
- `npm run dev` starts **frontend only**.
- `npm run server` starts **backend only** (and defaults `LUMINA_VIS_CACHE_VERSION=v4` if not set).
- For production bundle check: `npm run build`

## Playwright E2E

1. Install Playwright browser (first time):
   - `npm run test:e2e:install`
2. Run headless E2E:
   - `npm run test:e2e`
3. Optional modes:
   - `npm run test:e2e:headed`
   - `npm run test:e2e:ui`

What `npm run test:e2e` does:
- Starts backend on `127.0.0.1:8877`
- Starts frontend on `127.0.0.1:4173`
- Uses temp sqlite DB for isolation
- Runs Playwright tests in `tests/e2e`
- Shuts everything down automatically

## Deploy API (Render + Docker + LibreOffice)

1. `render.yaml` is configured for Docker using `Dockerfile.api`.
2. `Dockerfile.api` installs LibreOffice and sets `LUMINA_SOFFICE_BIN=/usr/bin/soffice`.
   - It also installs broad font coverage (`fonts-noto-*`, `fonts-liberation*`, DejaVu, FreeFont, `fonts-unifont`, `fonts-crosextra-carlito`, `fonts-crosextra-caladea`, `fonts-urw-base35`, `fonts-noto-color-emoji`) for reduced tofu/square glyph fallbacks.
   - Poppler (`pdftocairo`) is installed and used as the primary PDF->PNG renderer for VIS imports.
3. In Render, deploy with:
   - **Clear build cache & deploy**
4. Verify startup logs contain one of:
   - `soffice: available (...)` (visual PPTX import ready)
   - `warning: soffice not found ...` (visual import returns 503)
5. Health check:
   - `GET /api/health` should return `ok: true`

Optional VIS tuning env vars:
- `LUMINA_PPTX_VIS_VIEWPORT_SCALE` (default `1.0`)
- `LUMINA_PPTX_VIS_PARALLEL` (default `true`)
- `LUMINA_PPTX_VIS_INCLUDE_BASE64` (default `false`)
- `LUMINA_PDF_RASTER_DPI` (default `120`, used by Poppler)
- `LUMINA_VIS_RASTER_ENGINE` (default `auto`, tries Poppler first, then pdfjs fallback)
- `LUMINA_VIS_FONTSET_VERSION` (default `f1`, bump when font stack changes)
- `LUMINA_VIS_CACHE_VERSION` (default `v4`, bump to force re-render if old cached VIS output is stale)
- `LUMINA_VIS_MEDIA_KEEP_IMPORTS_PER_WORKSPACE` (default `20`)

Render dashboard quick path:
- Service → **Environment** → add/update `LUMINA_VIS_CACHE_VERSION` (e.g. `v4`, then `v5` later to force another refresh).
- Redeploy after changing the value.

---

## New Feature Guide (How it works)

## 1) Launch Output (Projector)
- Use **LAUNCH OUTPUT** to open the live output window.
- Output routing modes:
  - **Projector**: Full slide + background.
  - **Stream**: Live active slide for stream output; lower-thirds can be used.
  - **Lobby**: Routes lobby/announcement content.

### Important behavior fix
- If no slide is currently live when you click **LAUNCH OUTPUT**, Lumina now auto-starts the selected item at slide 1 so you don’t get a blank black screen.

## 2) Stage Display (Confidence Monitor)
- Use **STAGE DISPLAY** to open a separate confidence monitor view for the pastor.
- Stage display shows:
  - Current slide text
  - Next slide preview
  - Real-time clock
  - Pastor timer (custom timer)

### In your screenshot (top-right area)
- **STAGE DISPLAY** button: opens the confidence monitor.
- **LAUNCH OUTPUT** button: opens the projector output.
- Bottom-right presenter controls:
  - **LOWER THIRDS** toggle
  - Route selector (Projector / Stream / Lobby)
  - Timer controls
  - Note: in `Projector` mode, lower thirds are intentionally disabled (full-screen text standard).

## 3) Custom Pastor Timer
Yes — implemented.

You can now run a custom timer directly in presenter controls.
- Modes:
  - **Countdown** (set minutes, then Start)
  - **Elapsed** (counts up from 00:00)
- Controls:
  - Start / Pause
  - Reset
- Display:
  - Timer is mirrored to Stage Display as **Pastor Timer**.

### Does the timer represent what the pastor sees?
Yes. The timer shown in presenter controls is the same timer displayed on the Stage Display monitor so the pastor can track time in real-time.

## 4) Video Playback (Uploaded + URL video links)
- Lumina now detects direct video URLs more reliably (`.mp4`, `.webm`, `.mov`, blob/local media) and renders them as video.
- This applies to both preview and output window so the same video can play in both places.

## 5) Motion Backgrounds
- Open Motion Library from item editor.
- Tabs:
  - **Mock Presets** (e.g., Moving Oceans, Abstract Clouds)
  - **Pexels Motion** (live fetch, requires `VITE_PEXELS_API_KEY`)
  - **Pixabay Motion** (live fetch, requires `VITE_PIXABAY_API_KEY`)

## 5.1) PowerPoint/PDF Visual Import (`.pptx` / `.pdf`)
- Open `LYR` import modal from the run sheet header.
- **Visual PowerPoint/PDF Import**: renders each slide as an image and preserves layout/design.
- Render pipeline is hardened:
  - `.pptx` -> LibreOffice headless PDF export (isolated writable profile)
  - PDF -> PNG via Poppler (`pdftocairo`) first, with `pdf-to-png-converter` fallback.
- PDF visual import is useful as a fallback when source deck fonts render poorly from `.pptx`.
- Visual PPTX slides are now saved by the backend and returned as server URLs, so projector/output and other devices can render the same design.
- VIS imports are hash-cached per workspace: importing the same `.pptx` again reuses already-rendered images (fast path).
- Existing VIS decks imported before this change may require a one-time re-import.
- **Text PowerPoint Import**: fallback mode that extracts slide text + speaker notes (`.pptx` only).
- Slide Editor modal includes:
  - `PPTX VIS` = retain exact PowerPoint layout/background
  - `PPTX TXT` = import text and use Lumina backgrounds/theme
- Legacy `.ppt` files are not supported directly; save as `.pptx` first.
- If visual import fails, verify LibreOffice (`soffice`) is installed on the backend machine.
- If rendered VIS slide images still show square/tofu glyphs, your backend is missing the exact source font family used in the deck. Install/provide those fonts on the API host and re-import.
- Free Render services use ephemeral storage. VIS media may be lost after restart/redeploy unless you use persistent storage.
- Performance note: first-time visual conversion still depends on LibreOffice + PDF rasterization and may exceed 5 seconds for large decks. Re-import of unchanged files should be much faster due to hash cache.

## 6) Remote Control (`/remote`)
- Visit `/remote` on a phone/tablet.
- Buttons send synced commands via Firebase:
  - Next Slide
  - Prev Slide
  - Blackout

## 7) Web MIDI Controls
- MIDI note mappings:
  - Note `60` → Next Slide
  - Note `59` → Prev Slide
  - Note `58` → Blackout toggle

## 8) AI Sermon Deck
- In AI modal, **Sermon** mode:
  - Paste sermon text.
  - Lumina detects scripture references and key points.
  - Generates normalized 20-slide sermon deck.

## 9) Cloud Team Sync (Firebase)
- Live session state sync + team playlists sync are available through Firestore.
- Playlists prepared on one machine appear on another machine signed into the same team/user context.

---

## Firestore Rules

- Source of truth: `firebase.firestore.rules`
- Deploy command:
  - `firebase deploy --only firestore:rules`
