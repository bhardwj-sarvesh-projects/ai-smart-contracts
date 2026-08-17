# AI Infrastructure Setup

## Fixed platform policy

- AI provider: Groq Intelligent Router
- Temperature: `0.1` (hardcoded)
- Global output ceiling: `65536` tokens (hardcoded)
- Users cannot supply API keys, provider, model, temperature, or token limit.
- Administrators manage Groq credentials only.
- Model-to-task assignments are hardcoded in `server/config/aiPolicy.ts`.

## Required server configuration

Set a strong `ENCRYPTION_SECRET` with at least 32 characters.

For production Firebase Admin authentication and Firestore, use either:

1. Application Default Credentials (recommended on Cloud Run), or
2. `FIREBASE_SERVICE_ACCOUNT_JSON` containing the service-account JSON.

Set `ADMIN_EMAILS` to the comma-separated administrator allowlist.

## Credential storage

The Admin Panel writes credentials to the Firestore collection `aiCredentials` when Firebase Admin/Firestore is available. A local encrypted JSON store under `data/ai_credentials.json` is used only as a development fallback.

The raw Groq API key is never returned to the browser.

## Admin Panel

Open **System Control Panel → AI Infrastructure** to:

- add a Groq credential
- enable/disable a credential
- test a credential
- delete a credential
- inspect masked key, health and usage statistics
- inspect the locked model policy

Model assignments cannot be changed from the Admin Panel.

## Security note

Do not commit `.env`, service-account JSON, Groq API keys, OpenAI keys, or encryption secrets. If any credential was previously committed to a public repository, revoke/rotate it immediately.
