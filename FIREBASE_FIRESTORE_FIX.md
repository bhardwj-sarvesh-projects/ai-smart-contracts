# Firebase / Firestore Production Configuration

## Current authoritative database

The production Firebase project is:

- Project ID: `smartcontract-ai-studio`
- Firestore database ID: `ai-contracts`
- Collection for administrator AI credentials: `aiCredentials`

The application must not target `default` or `(default)`.

## Backend authentication

The backend requires explicit Firebase Admin credentials. It does not fall back to ambient Google Application Default Credentials because an AI Studio/hosting environment can otherwise resolve a different Google Cloud project.

Recommended:

- `FIREBASE_SERVICE_ACCOUNT_JSON` = complete service-account JSON for `smartcontract-ai-studio`
- `FIREBASE_EXPECTED_PROJECT_ID=smartcontract-ai-studio`
- `FIREBASE_FIRESTORE_DATABASE_ID=ai-contracts`
- `ENCRYPTION_SECRET=<random 32+ character server-only secret>`
- `ADMIN_EMAILS=<administrator allowlist>`
- `ALLOW_LOCAL_AI_CREDENTIAL_FALLBACK=false`

Alternative:

- `FIREBASE_PROJECT_ID=smartcontract-ai-studio`
- `FIREBASE_CLIENT_EMAIL=<service-account email>`
- `FIREBASE_PRIVATE_KEY=<service-account private key>`

## Important

Do not put Firebase Admin credentials, Groq API keys, or the encryption secret into `VITE_*` variables.

The browser only receives Firebase client configuration and masked credential metadata. The Groq secret remains server-side.

## Credential persistence

Credentials are stored in `aiCredentials` in the `ai-contracts` database. The server verifies a newly written document before returning success. New secrets are encrypted using AES-256-GCM; old AES-256-CBC records remain readable for backwards compatibility.

## Performance

The Admin Panel uses `/api/admin/ai/overview` for one authenticated bootstrap request, short-lived server-side caching, cache invalidation on mutations, and bounded Firestore request timeouts.
