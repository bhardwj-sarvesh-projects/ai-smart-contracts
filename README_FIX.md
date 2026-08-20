AI Contracts - Groq MODEL_UNAVAILABLE fix

Changed files:
1. aiPolicy.ts
   - Removed llama-3.3-70b-versatile from production routing because the configured Groq organization returned 404/no-access for it.
   - Replaced that fallback with the currently supported llama-3.1-8b-instant model.
2. AIOrchestrator.ts
   - Remembers model-specific 404/availability failures per credential for 10 minutes so a known unavailable fallback is not repeatedly retried.
   - Preserves the exact failing model on provider errors so structured diagnostics report the real model instead of incorrectly falling back to the primary route model.
3. ProviderRegistry.ts
   - Removed llama-3.3-70b-versatile from the production-compatible model list.
4. aiPolicy.test.ts
   - Added regression coverage ensuring llama-3.3-70b-versatile is not present in production routes and generation uses llama-3.1-8b-instant as the fallback.

No database migrations, Supabase schema changes, authentication changes, credential storage changes, or frontend changes were made.

Validation performed in the uploaded environment:
- Confirmed there are no remaining llama-3.3-70b-versatile references in server/src production code.
- Confirmed modified TypeScript files have balanced structural delimiters.
- Full npm lint/build/test could not be executed because the uploaded project has no node_modules and dependency installation timed out in the execution environment. Run npm install (or npm ci if the lockfile is authoritative), then npm run lint, npx vitest run, and npm run build in AI Studio before deployment.
