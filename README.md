<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lumina Presenter

Lumina is a church-focused presentation app for lyrics, scripture, announcements, motion backgrounds, stage confidence monitoring, and remote/live control.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   - `npm install`
2. Configure environment variables in `.env.local`:
   - `VITE_GOOGLE_AI_API_KEY=...`
   - `VITE_PEXELS_API_KEY=...` (optional, for live motion fetch)
3. Start:
   - `npm run dev`
4. Build:
   - `npm run build`

---

## New Feature Guide (How it works)

## 1) Launch Output (Projector)
- Use **LAUNCH OUTPUT** to open the live output window.
- Output routing modes:
  - **Projector**: Full slide + background.
  - **Stream**: Lower-thirds style text (no background) for OBS/live stream overlays.
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

## Firestore Rules (paste into Firebase Console)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function sameTeam(teamId) {
      return signedIn() && teamId in request.auth.token.teams;
    }

    // Live presenter/remote sync
    match /sessions/{sessionId} {
      allow read: if signedIn();
      allow write: if signedIn();
    }

    // Team playlists synced across home + sanctuary devices
    match /playlists/{playlistId} {
      allow read: if signedIn() && (
        resource.data.teamId == request.auth.uid ||
        (resource.data.teamId is string && sameTeam(resource.data.teamId))
      );

      allow create: if signedIn() && (
        request.resource.data.teamId == request.auth.uid ||
        (request.resource.data.teamId is string && sameTeam(request.resource.data.teamId))
      );

      allow update, delete: if signedIn() && (
        resource.data.teamId == request.auth.uid ||
        (resource.data.teamId is string && sameTeam(resource.data.teamId))
      );
    }
  }
}
```
