# DO NOT SKIP — Deployment Order

1. Replace the files in this package at the same paths.
2. In the SAME Supabase project used by AI Studio, run:
   `supabase/migrations/20260819000001_groq_key_pool_and_routing.sql`
3. Ensure the server environment contains:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (preferred) OR `SUPABASE_SERVICE_ROLE_KEY`
   - `ENCRYPTION_SECRET` (32+ random characters)
   - `GROQ_MAX_CREDENTIALS=15`
4. Ensure browser environment contains:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Restart/redeploy AI Studio after changing environment variables.
6. Add a Groq key from Admin → AI Infrastructure.
7. Verify a row appears in `public.ai_credentials`.
8. Refresh the application and verify the credential remains visible.

IMPORTANT: Do not paste raw Groq API keys into Supabase manually. The application stores AES-256-GCM ciphertext and a non-reversible HMAC fingerprint.
