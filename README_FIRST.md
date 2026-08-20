AI Contracts — Groq 20-Key Dedicated Routing v2

Replace/add these files at the same paths in AI Studio.

REQUIRED SUPABASE ACTION:
1. Apply supabase/migrations/20260819000002_groq_dedicated_routing_v2.sql to the existing ai-contracts Supabase database.
2. Set server-only GROQ_MAX_CREDENTIALS=20.
3. Keep SUPABASE_SECRET_KEY and ENCRYPTION_SECRET server-only.
4. Do not add VITE_ versions of these server secrets.

Routing is locked in server/config/aiPolicy.ts. Admins cannot select models or routing groups.
