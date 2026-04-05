##
## Coolify Deployment Configuration — Lumina Presenter API
## https://coolify.tiwaton.co.uk
##
## IMPORTANT: This documents the Coolify service settings that must be
## configured in the Coolify dashboard for production to work.
##
## Service: lumina-presenter-api-docker
## FQDN:    https://api.luminalive.co.uk
## UUID:    ocg8w848sgok0kk0wcswgk40
## Build:   Dockerfile.api
##
## ─── ROOT CAUSE OF 502 BAD GATEWAY (resolved 2026-03-29) ─────────────────────
## Coolify's Traefik labels default to routing port 3000 internally.
## The server must listen on PORT=3000 (not the default 8787) so Traefik
## can proxy correctly. ports_exposes must also be set to 3000.
##
## ─── REQUIRED COOLIFY ENV VARS (API service) ─────────────────────────────────
##
## PORT=3000                          ← CRITICAL: Must match Traefik's default port
## LUMINA_SOFFICE_BIN=/usr/bin/soffice
## LUMINA_DATA_DIR=/tmp/lumina-data   ← ephemeral; add persistent volume for prod
## LUMINA_VIS_CACHE_VERSION=v4
## LUMINA_VIS_FONTSET_VERSION=f2
## LUMINA_PPTX_VIS_VIEWPORT_SCALE=1.0
## LUMINA_PDF_RASTER_DPI=120
## LUMINA_VIS_RASTER_ENGINE=auto
## LUMINA_KEEP_ALIVE_URL=https://api.luminalive.co.uk
## GOOGLE_AI_API_KEY=<secret>
## PEXELS_API_KEY=<secret>
##
## ─── COOLIFY SERVICE SETTINGS ────────────────────────────────────────────────
##
## ports_exposes: 3000      ← Must match PORT env var above
## ports_mappings: (none)   ← Traefik handles routing, no host port mapping needed
## health_check_path: /api/health
## build_pack: dockerfile
## dockerfile_location: /Dockerfile.api
##
## ─── PERSISTENT STORAGE (recommended) ────────────────────────────────────────
## Add a volume in Coolify:
##   Host path:      /data/lumina-api
##   Container path: /app/server/data
## And set env var:
##   LUMINA_DATA_DIR=/app/server/data
##
## ─── FRONTEND SERVICE ────────────────────────────────────────────────────────
## Service: lumina-presenter-frontend
## FQDN:    https://luminalive.co.uk
## UUID:    d80oswcgk0go88ok8ko0g4gw
## Build:   Docker / static SPA (Vite build output)
## Env var: VITE_API_BASE_URL=https://api.luminalive.co.uk
##
