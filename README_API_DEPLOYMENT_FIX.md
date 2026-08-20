# API HTML / JSON Deployment Fix

## Root cause addressed
The browser was receiving the SPA `index.html` from `/api/admin/ai/overview` and `/api/admin/ai/credentials` with HTTP 200. The frontend expected JSON, causing `Unexpected token '<'`.

## Changes
- `server.ts` now honors the hosting platform's `PORT`/`SERVER_PORT` and keeps the Express API boundary ahead of the SPA fallback.
- `vite.config.ts` proxies `/api/*` to the Express server when Vite is started directly, preventing Vite's SPA fallback from answering API requests.
- `src/lib/apiClient.ts` supports optional `VITE_API_BASE_URL` for a genuinely separate frontend/backend deployment while retaining same-origin behavior by default.

## Required deployment behavior
The production service must start the Node server (`node dist/server.cjs`, the existing `npm start` script), not only serve `dist/index.html` as a static site.

If frontend and API are intentionally deployed separately, set `VITE_API_BASE_URL` to the HTTPS origin of the Express API. Do not put Supabase service-role/secret keys in any `VITE_*` variable.
