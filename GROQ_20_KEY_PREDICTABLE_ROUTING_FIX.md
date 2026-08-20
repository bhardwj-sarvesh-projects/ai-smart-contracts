# AI Contracts — Groq 20-Key Predictable Routing Fix

## Scope

This patch addresses the repeated Groq `429 RATE_LIMIT_ERROR`, model `404 MODEL_UNAVAILABLE`, unnecessary three-attempt pipeline failures, and the mismatch between the intended 20-key resilience pool and the actual runtime behavior.

## Root causes found in the supplied codebase

1. The token budget engine assumed a hard-coded 8,000 TPM Groq ceiling before the provider had returned the real account/project limit.
2. Raw single-file generation defaulted to the global 65,536-token ceiling instead of the stable legacy-style ~2,000-token default.
3. A rate-limit failure was not treated as terminal at the credential/model level, so the orchestrator could try additional models against the same rate-limited credential.
4. The task router preferred only its three dedicated keys and did not overflow to the remaining healthy keys.
5. The model policy contained a three-model ladder with repeated/legacy model choices. The supplied runtime had also produced a mismatch where the configured model and the provider error named different models.
6. Model availability was not discovered per credential. Groq model access can vary by organization/project permissions.
7. Client-side `GenerationService` converted structured server errors into a plain `Error`, losing status/code metadata. This caused terminal provider/model failures to be handled as generic pipeline retries.
8. The Admin infrastructure screen described a locked 65,536-token platform ceiling even though predictable generation should use a smaller per-file default.

## New routing behavior

Preferred order remains workload-aware:

- Architecture / repository analysis → API 01–03 preferred
- Smart contract generation → API 04–06 preferred
- Editing / repair → API 07–09 preferred
- Testing → API 10–12 preferred
- Security → API 13–15 preferred
- Documentation / Copilot → API 16–18 preferred
- Research → API 19–20 preferred

However, the router now overflows to any other healthy enabled API slot when the preferred group is unavailable.

For each credential:

1. Discover models visible to that credential when possible.
2. Use the first available model in the server-owned model ladder.
3. Do not repeatedly call a model that returned a known 404/403 model-access error.
4. Treat rate-limit/auth/billing failures as credential-level failures and move away from the key.
5. If Groq explicitly reports an organization-level TPM limit, wait once for the provider reset window instead of hammering all 20 keys in the same organization.

## Model policy

The platform uses current production-capable Groq IDs:

- `openai/gpt-oss-120b` — primary complex coding/reasoning route
- `llama-3.3-70b-versatile` — fallback
- `llama-3.1-8b-instant` — lightweight fallback
- `groq/compound` — research route

The router does not trust a model merely because it is in the global catalog; it checks what the specific credential can access.

## Token behavior

- Raw single-file generation default: **2,000 output tokens**
- Explicitly requested larger budgets remain supported.
- Model-specific maximums remain enforced.
- The runtime no longer invents an 8,000 TPM ceiling before Groq provides rate-limit information through headers/errors.
- Once Groq returns actual rate-limit headers, the runtime uses those values for adaptive budgeting.

## Database impact

No database schema or credential-storage changes are included in this patch.

The existing encrypted Supabase credential storage and 20-slot schema remain intact.

## Files included

Each file is stored in this package at the exact path where it belongs in the project root.

- `.env.example`
- `server/config/aiPolicy.ts`
- `server/config/aiPolicy.test.ts`
- `server/services/AIService.ts`
- `server/services/AICredentialService.ts`
- `server/services/AIOrchestrator.ts`
- `server/providers/GroqProvider.ts`
- `server/routes/aiInfrastructure.ts`
- `src/core/EngineeringCore/runtime/TokenBudgetEngine.ts`
- `src/core/EngineeringCore/runtime/LLMRuntimeEngine.ts`
- `src/core/EngineeringCore/adapters/provider/ProviderRegistry.ts`
- `src/features/generation/GenerationService.ts`
- `src/components/AdminAIInfrastructure.tsx`

## Deployment

1. Replace the listed files in the same project-root locations.
2. Keep the existing Supabase migrations and encrypted `ai_credentials` table unchanged.
3. Set:
   `GROQ_MAX_CREDENTIALS=20`
4. Optional:
   `AI_DEFAULT_MAX_OUTPUT_TOKENS=2000`
5. Rebuild:
   `npm run build`
6. Start:
   `npm start`
7. Test one generation first. Then test a second generation to confirm key/model failover.

## Important Groq quota limitation

Twenty API keys do not automatically create twenty independent TPM pools when those keys belong to the same Groq organization. Groq documents TPM/rate limits at the organization level. Therefore this patch makes the application route and fail over correctly, but it cannot manufacture additional provider quota. If all 20 keys are under the same organization and that organization is capped at 8,000 TPM, the application must still respect that shared ceiling. Higher provider/project limits or separate quota domains are required for materially higher aggregate throughput.

## Validation performed in this environment

- The supplied ZIP was extracted and the production routing/runtime source was inspected.
- The changed TypeScript files were syntax-checked with the installed TypeScript compiler in no-resolution mode; no syntax diagnostics were produced.
- A full dependency-backed `npm run lint` / Vitest run could not be completed in this environment because the ZIP does not contain `node_modules` and dependency installation timed out. Therefore no claim of a clean full-project test run is made here.
