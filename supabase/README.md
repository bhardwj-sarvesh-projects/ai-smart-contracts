# AI Contracts — Supabase Integration

Supabase PostgreSQL and Supabase Auth are the authoritative persistence/authentication layer. Firebase/Firestore is not used by the production runtime.

## AI credential architecture

The platform is **Groq Cloud only** and supports a maximum of **15 Groq API keys**.

- Admin enters only a credential name and Groq `gsk_...` API key.
- The server encrypts the API key with AES-256-GCM before storing it in `public.ai_credentials`.
- A keyed HMAC fingerprint is stored only for duplicate-key detection.
- Raw API keys and ciphertext are never returned to the browser.
- `provider`, `model`, and `base_url` are server-controlled and cannot be changed from the Admin Panel.
- Every key participates in the same task-specific model policy.
- Routing is key-first: `API #1 -> best model -> fallback model -> fallback model -> API #2 -> ...`.
- Failed keys are cooled down for rate-limit/auth failures; healthy keys are rotated using a server-side cursor.
- Model policy is locked in `server/config/aiPolicy.ts` and is not stored as an administrator setting.

## Current production model policy

The router uses Groq production models/systems only. The primary complex coding/reasoning route is OpenAI GPT-OSS 120B; GPT-OSS 20B and Llama 3.3 70B are used as task-specific fallbacks/latency routes. Groq Compound is reserved for research tasks that benefit from Groq's built-in web/code tools.

The policy is intentionally server-controlled and can be updated by engineering deployments, not by an end user or Admin Panel control.

## Required migrations

Apply all migrations in order:

1. `20260818000000_init_supabase_schema.sql`
2. `20260818000001_app_tables.sql`
3. `20260819000000_harden_platform_persistence.sql`
4. `20260819000001_groq_key_pool_and_routing.sql`

If the existing database is already populated, the final migration can be applied without deleting existing projects. Legacy non-Groq AI credentials are disabled; they are not used by the new router.

## Server environment

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
# Or legacy:
# SUPABASE_SERVICE_ROLE_KEY=ey...
ENCRYPTION_SECRET=<32+ character random secret>
GROQ_MAX_CREDENTIALS=15
```

`SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_SECRET` are server-only. Never prefix them with `VITE_`.

## Browser environment

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Project persistence and isolation

`public.projects` is the authoritative smart-contract workspace store.

- A normal user can read/mutate only projects where `user_id = auth.uid()`.
- The server derives `user_id` from the verified Supabase JWT; browser headers cannot spoof ownership.
- Admins can inspect all projects through the protected admin inventory endpoint.
- Admin project rows include the owner's name/email so the platform can show which user created each contract.
- Main dashboard project loading is user-scoped for normal users and platform-wide for an administrator.
- Project creation performs a read-after-write verification before returning success.

## Supabase setup checklist

1. Open Supabase SQL Editor for the same project configured in AI Studio.
2. Run all four migrations above in order.
3. In AI Studio/hosting environment variables, configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), and `ENCRYPTION_SECRET`.
4. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the browser.
5. Restart/redeploy the server after changing environment variables.
6. Open Admin → AI Infrastructure and add a Groq key.
7. Confirm a row appears under `public.ai_credentials` with `provider = groq`, `model = platform-managed`, and an encrypted API-key value.

Do not manually paste a raw Groq API key into the database.
