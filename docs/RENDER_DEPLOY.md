# Render Backend Deployment (Lumina API)

## 1) Create the Render service
1. Push this repo to GitHub.
2. In Render: `New` -> `Blueprint`.
3. Select this repo. Render will read `render.yaml` and create `lumina-presenter-api`.

## 2) Storage mode
### Free plan
- Use `LUMINA_DATA_DIR=/tmp/lumina-data` (already in `render.yaml`).
- This storage is ephemeral on Render free services.

### Paid plan (persistent)
1. Open the created web service in Render.
2. Go to `Disks` -> `Add Disk`.
3. Mount path: `/var/data`.
4. Redeploy the service.

The API stores SQLite at `LUMINA_DATA_DIR`.

## Free plan note (important)
- The blueprint is configured as `plan: free` to avoid monthly cost.
- Render free web services do not support persistent disks.
- If you stay on free + SQLite, backend DB state can reset (redeploy/restart/suspension).
- For reliable persistence on free, keep Firestore as system-of-record for now, or migrate server DB to an external free hosted Postgres.

## 3) Configure frontend to use Render API
Set this env var in the frontend app:

`VITE_API_BASE_URL=https://<your-render-service>.onrender.com`

Then redeploy the frontend.

## 4) Verify
Use:

`GET https://<your-render-service>.onrender.com/api/health`

You should get `{ ok: true, ... }`.

## 5) Updating backend
Every push to the tracked branch triggers auto-deploy.
If needed, manual deploy is available in Render: `Manual Deploy` -> `Deploy latest commit`.
