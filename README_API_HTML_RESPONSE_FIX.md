# API HTML / `Unexpected token '<'` Permanent Guard

Replace the four files at their exact paths:

- `server.ts`
- `src/App.tsx`
- `src/lib/apiClient.ts`
- `src/components/PipelineDashboard.tsx`

The fix prevents `/api/*` calls from being parsed as SPA HTML, centralizes authenticated API calls, and adds a final server-side JSON 404 boundary.
