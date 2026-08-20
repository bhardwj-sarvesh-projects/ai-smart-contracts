# Supabase Persistence Fix — Change Summary

## Root causes found

1. AI credentials had a local-file merge/fallback path. That allowed the UI to disagree with Supabase and made persistence behavior non-authoritative.
2. Server Supabase client could fall back to the browser anon key instead of requiring `SUPABASE_SERVICE_ROLE_KEY`.
3. Project APIs silently fell back to `data/db.json` when Supabase operations failed.
4. AI routing was still hardcoded to Groq model lists even though the database schema had started moving toward generic providers.
5. The Admin Panel accepted only display name + API key, so provider/model configuration was not persisted.
6. Admin project listing returned `userId` but did not robustly attach the owner's profile identity.
7. The normal dashboard cached projects under a single global `user_projects` key, which could briefly expose the previous user's cached workspace after an account switch.
8. Browser role metadata could be trusted by client/server code paths; the final design makes `profiles.role` authoritative and protects role changes with a database trigger.

## Permanent behavior after this patch

- Supabase PostgreSQL is authoritative for AI credentials and projects.
- No local JSON fallback exists for those records.
- AES-256-GCM remains the server-side encryption mechanism for AI API keys.
- AI credentials store provider, provider label, exact model, base URL, priority, status and telemetry.
- Supported provider registry includes Groq, OpenAI, OpenRouter, Together AI, Fireworks, DeepSeek, xAI, Mistral, Cerebras, SambaNova, Perplexity, Moonshot, Qwen/DashScope, NVIDIA NIM, Google Gemini and Anthropic.
- OpenAI-compatible providers use a common adapter; Gemini and Anthropic use native HTTP adapters.
- Each configured credential is a production routing candidate and is attempted in priority order.
- Normal users can only access their own projects.
- Administrators can inspect all projects and see the creating user's name/email.
- Deployment records are persisted to Supabase instead of local JSON.
- Supabase failures produce explicit errors instead of pretending persistence succeeded.
