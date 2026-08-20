# AI Contracts — Final AI Infrastructure / Credential Persistence Fix Report

## Audit basis

Audited the supplied `ai-smart-contract-development-platform (36).zip` codebase, including the existing Firebase Admin/Firestore credential infrastructure, Admin AI Infrastructure UI, AI orchestration path, authentication bootstrap, encryption utility, environment configuration, tests, and the prior Firestore fix documentation.

## Root causes found

### 1. Admin page performed unnecessary authenticated work
The Admin AI page made three separate authenticated requests on every mount/reload (`credentials`, `policy`, and `diagnostics`) and then performed another full credential reload after successful mutations.

### 2. Firestore reads could block the UI indefinitely
The server did not impose a bounded timeout around Firestore collection reads. The browser also had no request timeout around the Admin infrastructure request. A stalled Firestore/gRPC request therefore appeared as an endless “Loading credentials from Firestore…” state.

### 3. Credential reads repeatedly performed migration work
`list()` could invoke local-fallback migration logic on ordinary reads. That was unnecessary once Firestore had become the authoritative store and added latency to the critical path.

### 4. Server state was not cached/coalesced
Concurrent Admin requests could independently query Firestore. There was no short-lived authoritative credential cache or in-flight request coalescing.

### 5. Production telemetry could silently fall back to local disk
`record()` could write telemetry to `data/ai_credentials.json` even when production fallback was disabled. This violated the intended “Firestore is authoritative” boundary.

### 6. Encryption used an insecure hardcoded fallback secret
The old encryption utility silently substituted a hardcoded secret when `ENCRYPTION_SECRET` was missing. Anyone with source access could reproduce that key. New credentials now require an explicit server-side secret.

### 7. Existing encrypted credentials could be broken by an encryption migration
Changing encryption blindly would make existing Firestore credentials undecryptable. The new implementation is versioned: new writes use AES-256-GCM while old AES-256-CBC records remain readable.

### 8. Firebase Admin app selection could collide with another Admin SDK app
The previous implementation used the first initialized Admin SDK app. The new implementation uses a dedicated named Admin app (`ai-contracts-admin`) and validates the project.

### 9. The UI had a light-theme contrast defect
Credential names and some model-policy labels used dark-theme text classes unconditionally, making them nearly invisible in the light Admin Panel shown in the supplied screenshots.

### 10. Documentation still described the obsolete `(default)` database
Several project documents still told AI Studio to target `(default)`, while the actual working database is `ai-contracts`. Those documents were updated to remove the ambiguity.

## Implemented fixes

- Added `/api/admin/ai/overview` as the single Admin AI bootstrap endpoint.
- Added short-lived server-side credential caching and concurrent-read coalescing.
- Added 5-second Firestore operation timeouts.
- Added browser-side Admin infrastructure request timeouts.
- Removed unnecessary post-mutation full-list reloads.
- Kept authoritative read-back verification for writes/deletes.
- Added cache invalidation after every mutation and telemetry update.
- Kept local encrypted fallback explicitly development/recovery-only.
- Prevented production telemetry from silently writing to local disk.
- Replaced the hardcoded encryption fallback with mandatory `ENCRYPTION_SECRET`.
- Upgraded new encryption to AES-256-GCM with authenticated encryption.
- Preserved backwards compatibility for existing AES-256-CBC records.
- Added atomic local fallback writes using a temporary file + rename.
- Added explicit named Firebase Admin app initialization.
- Enforced `ai-contracts` as the authoritative Firestore database ID when an obsolete `default` value is supplied.
- Updated `.env.example` with the browser database ID variable.
- Updated Firebase/AI infrastructure documentation to match the current architecture.
- Fixed light-theme text contrast in the Admin AI Infrastructure UI.
- Updated persistence tests to provide a test-only encryption secret.

## Files changed

1. `server/utils/encryption.ts`
2. `server/services/AICredentialService.ts`
3. `server/services/FirebaseAdminAuth.ts`
4. `server/routes/aiInfrastructure.ts`
5. `src/components/AdminAIInfrastructure.tsx`
6. `server.ts`
7. `.env.example`
8. `server/services/AICredentialService.persistence.test.ts`
9. `server/services/AICredentialService.security.test.ts`
10. `AI_INFRASTRUCTURE_SETUP.md`
11. `FIREBASE_FIRESTORE_FIX.md`
12. `FIRESTORE_AND_AI_CREDENTIAL_FIX.md`
13. `AI_CREDENTIAL_FINAL_FIX_REPORT.md` (new)

## Required AI Studio environment values

```text
ENCRYPTION_SECRET=<random 32+ character server-only secret>
FIREBASE_SERVICE_ACCOUNT_JSON=<service-account JSON for smartcontract-ai-studio>
FIREBASE_EXPECTED_PROJECT_ID=smartcontract-ai-studio
FIREBASE_FIRESTORE_DATABASE_ID=ai-contracts
ADMIN_EMAILS=<admin email allowlist>
ALLOW_LOCAL_AI_CREDENTIAL_FALLBACK=false
VITE_FIREBASE_FIRESTORE_DATABASE_ID=ai-contracts
```

The service-account JSON must belong to `smartcontract-ai-studio`. Never put it into a `VITE_*` variable.

## Validation performed in this environment

- All six directly modified TypeScript/TSX runtime files were syntax/transpile checked with the TypeScript compiler API.
- A full `tsc --noEmit` attempt was also made, but dependency installation was unavailable in the execution environment, so the repository's external module/type dependencies were not present. The resulting errors are dependency-resolution errors rather than a clean project typecheck.
- No real API key or Firebase private key was included in the fixed files.

## Expected behavior after replacement

1. Open **System Control Panel → AI Infrastructure**.
2. The page makes one Admin overview request.
3. Existing credentials in Firestore `ai-contracts/aiCredentials` appear after the single read.
4. Adding a credential saves it server-side, verifies persistence, and immediately inserts the returned masked credential into the UI without a second full reload.
5. Refreshing the page reads the credential from Firestore again; it does not depend on browser localStorage or the local credential file.
6. If Firestore becomes unreachable, the UI receives a bounded error instead of spinning forever.
7. The raw Groq API key is never returned to the browser.
8. The stored Firestore document contains encrypted key material only.
