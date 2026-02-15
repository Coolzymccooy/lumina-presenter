# Render Backend Deployment (Lumina API)

## 1) Create the Render service
1. Push this repo to GitHub.
2. In Render: `New` -> `Blueprint`.
3. Select this repo. Render will read `render.yaml` and create `lumina-presenter-api`.

## 2) Attach persistent storage
1. Open the created web service in Render.
2. Go to `Disks` -> `Add Disk`.
3. Mount path: `/var/data`.
4. Redeploy the service.

The API stores SQLite at `LUMINA_DATA_DIR` (default from blueprint is `/var/data`).

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
