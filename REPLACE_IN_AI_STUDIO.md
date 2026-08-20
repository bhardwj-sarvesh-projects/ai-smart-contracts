# AI Studio replacement guide

Replace/add the files in this package at the exact paths shown below.

## Replace

- `.env.example`
- `server.ts`
- `server/utils/encryption.ts`
- `server/services/AICredentialService.ts`
- `server/services/FirebaseAdminAuth.ts`
- `server/routes/aiInfrastructure.ts`
- `src/components/AdminAIInfrastructure.tsx`
- `server/services/AICredentialService.persistence.test.ts`
- `server/services/AICredentialService.security.test.ts`
- `AI_INFRASTRUCTURE_SETUP.md`
- `FIREBASE_FIRESTORE_FIX.md`
- `FIRESTORE_AND_AI_CREDENTIAL_FIX.md`

## Add

- `AI_CREDENTIAL_FINAL_FIX_REPORT.md`
- this file

## Before running

Set these server-side variables in AI Studio:

`ENCRYPTION_SECRET=<random 32+ character secret>`

`FIREBASE_SERVICE_ACCOUNT_JSON=<service-account JSON for smartcontract-ai-studio>`

`FIREBASE_EXPECTED_PROJECT_ID=smartcontract-ai-studio`

`FIREBASE_FIRESTORE_DATABASE_ID=ai-contracts`

`ADMIN_EMAILS=<admin email allowlist>`

`ALLOW_LOCAL_AI_CREDENTIAL_FALLBACK=false`

And expose the client-safe database identifier to Vite:

`VITE_FIREBASE_FIRESTORE_DATABASE_ID=ai-contracts`

Do not put the service-account JSON, Groq key, private key, or encryption secret in a `VITE_*` variable.

## Important

Do not delete the existing `aiCredentials` collection in Firestore. Existing credentials are intended to remain usable. The new encryption implementation can read legacy AES-256-CBC records and writes new credentials using AES-256-GCM.

## Groq 20-Key Dedicated Routing v2

After replacing the files from this release, apply the new Supabase migration:

`supabase/migrations/20260819000002_groq_dedicated_routing_v2.sql`

Then set the server environment variable:

`GROQ_MAX_CREDENTIALS=20`

Do not add a browser `VITE_` version of this variable. Do not expose `SUPABASE_SECRET_KEY` or `ENCRYPTION_SECRET` to the browser.

The Admin panel does not accept model or routing-group selections. API slots are allocated automatically in order from the lowest free slot (01-20), and the server maps each slot to its dedicated workload group.
