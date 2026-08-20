# AI Infrastructure Setup — Groq Key Pool

## Authoritative policy

- Provider: **Groq Cloud only**
- Maximum platform keys: **15**
- API key storage: **Supabase PostgreSQL + AES-256-GCM**
- Model selection: **server-controlled and locked**
- Admin model selection: **not available**
- User model selection: **not available**
- Local credential fallback: **disabled**
- Global temperature: `0.1`
- Global output ceiling: `65536` tokens, further constrained by the selected model

## Admin Panel

The Admin Panel collects only:

1. Credential display name
2. Groq API key (`gsk_...`)

The server automatically stores the credential as a Groq route. Provider, endpoint, and model are platform-managed.

## Routing architecture

Every configured key participates in the same locked task policy. The router is key-first:

`API #1 → best model → fallback model → fallback model → API #2 → ...`

The router rotates the starting key, skips cooled-down keys, and immediately moves to another key after authentication/rate-limit failures.

## Model policy

Production-only Groq models are defined in `server/config/aiPolicy.ts`.

- Architecture/generation/security/repository analysis: GPT-OSS 120B → Llama 3.3 70B → GPT-OSS 20B
- Edit/repair: GPT-OSS 120B → GPT-OSS 20B → Llama 3.3 70B
- Testing/copilot: GPT-OSS 20B → GPT-OSS 120B → Llama 3.3 70B
- Documentation: Llama 3.3 70B → GPT-OSS 20B → GPT-OSS 120B
- Research: Groq Compound → GPT-OSS 120B → Llama 3.3 70B

Engineering controls this policy through code deployments. It is not an administrator setting.

## Required server configuration

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (preferred current Supabase secret key) OR `SUPABASE_SERVICE_ROLE_KEY` (legacy)
- `ENCRYPTION_SECRET` — 32+ random characters
- `GROQ_MAX_CREDENTIALS=15`

Browser:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Database

Apply:

`supabase/migrations/20260819000001_groq_key_pool_and_routing.sql`

The migration also enforces the 15-key ceiling and prevents direct browser access to encrypted credentials through RLS.

## Persistence guarantee

Credential creation is not acknowledged as successful until PostgreSQL has accepted the encrypted row and the server has verified that row exists. List reads use a short-lived server cache for speed, while secret reads are performed directly from Supabase and decrypted only in memory for the active request.

## Security

Never commit or expose:

- Groq API keys
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_SECRET`

If a real secret is exposed, rotate it in the provider immediately.
