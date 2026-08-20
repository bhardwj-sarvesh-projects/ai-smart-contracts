# Replacement Manifest

## Important: the two ZIPs uploaded with this turn are legacy reference builds

The uploaded `ai-smart-contract-development-platform (2).zip` and
`ai-smart-contract-development-platform (5).zip` contain the older single-provider
architecture (their `GroqProvider.ts` defaults to a single model and a 2,000-token
fallback). They do **not** contain the current Supabase-backed 20-credential
orchestrator that is running in your latest screenshots.

Therefore they were used as the **behavioral reference only**:
- deterministic single request
- default 2,000 output tokens
- no provider-key storm

Do NOT replace the current Supabase credential service with the legacy Firebase/local-file
implementation from those older archives.

## Replace these files in the CURRENT 20-key codebase

| Package path | Project-root location |
|---|---|
| `server/config/aiPolicy.ts` | `server/config/aiPolicy.ts` |
| `server/config/aiPolicy.test.ts` | `server/config/aiPolicy.test.ts` |
| `server/services/AIOrchestrator.ts` | `server/services/AIOrchestrator.ts` |
| `server/services/AIService.ts` | `server/services/AIService.ts` |
| `server/providers/GroqProvider.ts` | `server/providers/GroqProvider.ts` |
| `src/core/EngineeringCore/runtime/TokenBudgetEngine.ts` | `src/core/EngineeringCore/runtime/TokenBudgetEngine.ts` |
| `src/core/EngineeringCore/runtime/LLMRuntimeEngine.ts` | `src/core/EngineeringCore/runtime/LLMRuntimeEngine.ts` |
| `src/core/EngineeringCore/adapters/provider/ProviderRegistry.ts` | `src/core/EngineeringCore/adapters/provider/ProviderRegistry.ts` |

No Supabase schema or credential-storage file is intentionally replaced.
