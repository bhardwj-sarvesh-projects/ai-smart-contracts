# Groq 15-Key Production Routing & Supabase Persistence Fix

## Audit result

The supplied codebase had already migrated most application persistence from Firebase to Supabase, but the AI credential layer still contained a conflicting architecture:

- The Admin Panel allowed provider/model/base-URL selection.
- `ai_credentials.model` was treated as the execution authority.
- The orchestrator executed the stored credential model directly instead of selecting a model by task.
- Secret ciphertext was included in the server-side list cache.
- Health testing depended on the credential's stored model.
- The provider registry still exposed multiple providers even though the requested production architecture is Groq-only.
- The Supabase server client accepted only the legacy `SUPABASE_SERVICE_ROLE_KEY`, while current Supabase projects may use the server-only `sb_secret_...` key.
- There was no duplicate-key fingerprint and no database-level 15-key ceiling.

## Final architecture

### Credential storage

`Admin Panel → authenticated server → AES-256-GCM → Supabase public.ai_credentials`

Only these values are supplied by the administrator:

- Credential display name
- Groq `gsk_...` API key

The server owns:

- Provider = Groq
- Base URL = `https://api.groq.com/openai/v1`
- Model = platform-managed
- Task-to-model mapping
- Failover order
- Key rotation
- Health/cooldown state

### Routing

For every AI task:

`API #1 → best model → fallback model → fallback model → API #2 → ...`

The starting API key rotates across requests. Authentication/rate-limit failures immediately move to another key. Model-unavailable and provider/transient failures can fall through to the next model on the same key before moving to another key.

### Model policy

The router uses production Groq models only:

- GPT-OSS 120B — primary complex reasoning/coding model
- GPT-OSS 20B — low-latency coding/testing/copilot route and fallback
- Llama 3.3 70B — strong production fallback/documentation route
- Llama 3.1 8B — retained in the catalog for future lightweight routing but not currently selected by a critical task policy
- Groq Compound — research route because it can use Groq's built-in web/code tools

Preview/enterprise-preview models are intentionally excluded from the locked production policy.

## Supabase changes

The new migration:

`supabase/migrations/20260819000001_groq_key_pool_and_routing.sql`

adds:

- `api_key_fingerprint`
- Groq-only normalization
- platform-managed model metadata
- duplicate-key prevention
- 15-key database ceiling
- locked provider/model/base URL trigger
- RLS admin policy

Legacy non-Groq credentials are retained for history but disabled.

## Security

The public Admin API never returns:

- raw API keys
- encrypted ciphertext
- key fingerprints

The server list cache contains no ciphertext. Secret reads fetch only the requested credential directly from Supabase and decrypt it in memory.

## Project persistence

The existing Supabase project architecture remains authoritative:

- normal users see only their own `projects` rows;
- project creation is server-authenticated and read-after-write verified;
- admins can inspect all projects;
- admin project inventory includes owner identity;
- user dashboard project cache is keyed by authenticated user ID.

## Required environment variables

Server:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (preferred) OR `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_SECRET`
- `GROQ_MAX_CREDENTIALS=15`

Browser:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

After changing environment variables, restart/redeploy the application server.

## Verification checklist

1. Apply all Supabase migrations, especially `20260819000001_groq_key_pool_and_routing.sql`.
2. Restart/redeploy AI Studio after environment changes.
3. Open Admin → AI Infrastructure.
4. Add one Groq key.
5. Confirm the row appears in `public.ai_credentials`.
6. Confirm `provider = groq` and `model = platform-managed`.
7. Confirm `encrypted_api_key` is non-empty and does not equal the raw key.
8. Refresh the browser and confirm the credential remains visible.
9. Add more keys until the desired pool is configured, up to 15.
10. Generate a contract and inspect server logs to verify the selected task model and credential ID.
11. Disable one key and verify routing continues through another enabled key.
12. Test a key from the Admin Panel and verify health telemetry updates in Supabase.
