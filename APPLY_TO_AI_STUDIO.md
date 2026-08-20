# AI Contracts — Supabase/Groq Production Fix

Replace the supplied files at the same paths. Do not merge the old Firebase/Firestore AI credential implementation back into these files.

## 1. Supabase environment variables

Server-only:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` **preferred** (the current `sb_secret_...` key from Supabase API Keys), OR `SUPABASE_SERVICE_ROLE_KEY` for legacy projects
- `ENCRYPTION_SECRET` — random, server-only, at least 32 characters
- `GROQ_MAX_CREDENTIALS=15`

Browser-safe:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` / publishable key

Never put `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_SECRET`, or Groq API keys in a `VITE_*` variable.

## 2. Apply the database migration

Run this file in the same Supabase project used by the application:

`supabase/migrations/20260819000001_groq_key_pool_and_routing.sql`

It creates/hardens the encrypted Groq key pool, duplicate-key fingerprint, RLS boundary, and a database-level 15-key ceiling.

## 3. Admin AI behavior

Admin → AI Infrastructure now accepts only:

- Credential display name
- Groq API key

The Admin Panel cannot select or change a model/provider/endpoint.

The server automatically selects the best production Groq model for each task from `server/config/aiPolicy.ts` and rotates across the configured Groq keys with failover.

## 4. Production routing

Routing is intentionally key-first:

`API #1 → best model → fallback model → fallback model → API #2 → ...`

Examples:

- Architecture/generation/security: GPT-OSS 120B → Llama 3.3 70B → GPT-OSS 20B
- Editing/repair: GPT-OSS 120B → GPT-OSS 20B → Llama 3.3 70B
- Testing/copilot: GPT-OSS 20B → GPT-OSS 120B → Llama 3.3 70B
- Research: Groq Compound → GPT-OSS 120B → Llama 3.3 70B

This is server-enforced. Users and administrators cannot override it.

## 5. Credential persistence guarantee

A credential is considered successfully saved only after:

1. the server validates the Groq key format;
2. the server encrypts the key with AES-256-GCM;
3. PostgreSQL inserts the row;
4. the server reads the row back from Supabase;
5. only then does the API return success to the browser.

The browser receives only a masked key indicator.

## 6. Smart-contract persistence

Generated projects are stored in `public.projects` and remain user-isolated. Normal users see only their own projects. Administrators can inspect the complete project inventory and owner identity through protected server routes.

## 7. Important

After adding/changing environment variables, restart/redeploy the AI Studio application. Environment variables are not retroactively injected into an already-running server process.
