# Firestore / AI Credential Infrastructure — Current Fix

## Authoritative configuration

The application now targets the named Cloud Firestore database:

- Firebase project: `smartcontract-ai-studio`
- Firestore database: `ai-contracts`
- Region shown by the project: `asia-south2`
- Collection: `aiCredentials`

The old `default` / `(default)` database configuration is no longer used.

## Credential persistence

The server writes administrator-managed Groq credentials directly to Firestore. The API key is encrypted before storage and is never returned to the browser.

- New encryption: AES-256-GCM.
- Existing AES-256-CBC records remain decryptable so an upgrade does not invalidate stored credentials.
- Production requires `ENCRYPTION_SECRET`; there is no insecure hardcoded encryption fallback.
- Local encrypted fallback is disabled in production unless explicitly enabled.

## Performance fixes

The previous Admin Panel startup performed three authenticated API requests and could perform additional Firestore read-backs. This release adds a single `/api/admin/ai/overview` bootstrap endpoint and a short-lived server cache.

The UI now:

1. Makes one authenticated overview request on mount.
2. Updates its local state immediately after a successful add/update/delete.
3. Does not reload the whole credential list after every mutation.
4. Uses explicit request timeouts so loading cannot remain indefinite.
5. Provides manual refresh when an authoritative reload is desired.

## Failure behavior

Firestore failures are classified as authentication, permission, database-not-found, native-access-mode, network, configuration, or unknown errors. Production does not silently write AI credentials to local disk when Firestore is unavailable; it returns a clear `503` response instead.

## Required AI Studio variables

```text
ENCRYPTION_SECRET=<random secret, 32+ characters>
FIREBASE_SERVICE_ACCOUNT_JSON=<service account JSON for smartcontract-ai-studio>
FIREBASE_EXPECTED_PROJECT_ID=smartcontract-ai-studio
FIREBASE_FIRESTORE_DATABASE_ID=ai-contracts
ADMIN_EMAILS=<admin email allowlist>
ALLOW_LOCAL_AI_CREDENTIAL_FALLBACK=false
VITE_FIREBASE_FIRESTORE_DATABASE_ID=ai-contracts
```

The service-account JSON must belong to `smartcontract-ai-studio`. Do not place it in a `VITE_*` variable.
