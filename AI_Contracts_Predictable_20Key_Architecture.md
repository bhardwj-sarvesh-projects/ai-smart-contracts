# AI Contracts — Predictable 20-Key Groq Architecture

## 1. Goal

The previous working generation behavior was simple and predictable:

User request → one Groq request → one model → ~2,000 output-token default.

The new architecture preserves that predictability while keeping 20 encrypted Groq credentials and dedicated workload groups.

## 2. Credential pool

20 platform-managed credentials:

- API 01–03 → Architecture / Repository Analysis
- API 04–06 → Smart Contract Generation
- API 07–09 → Code Editing & Repair
- API 10–12 → Testing & Test Analysis
- API 13–15 → Security Audit & Remediation
- API 16–18 → Documentation & Copilot
- API 19–20 → Research & Compilation Analysis

The admin can manage credentials, but cannot select the model ladder or workload assignment.

## 3. Deterministic credential selection

For every workload:

1. Resolve the workload group.
2. Read enabled credentials from the authoritative credential store.
3. Keep only credentials whose immutable priority belongs to that group.
4. Use a round-robin cursor inside that group.
5. Skip credentials in cooldown.
6. Do not borrow unrelated workload groups.

Example:

Generation request 1 → API 04
Generation request 2 → API 05
Generation request 3 → API 06
Generation request 4 → API 04
...

This is deterministic and predictable.

## 4. Deterministic model selection

Each workload has exactly three server-controlled models.

Normal behavior:

- use Model #1
- only use Model #2 when Model #1 is unavailable for that credential
- only use Model #3 when Model #2 is also unavailable
- do NOT use all three models for a rate-limit error

This prevents a 429 from becoming three consecutive provider calls.

## 5. Current model ladders

Architecture:
1. openai/gpt-oss-120b
2. qwen/qwen3.6-27b
3. openai/gpt-oss-20b

Smart Contract Generation:
1. openai/gpt-oss-120b
2. openai/gpt-oss-20b
3. qwen/qwen3.6-27b

Editing / Repair:
1. openai/gpt-oss-120b
2. openai/gpt-oss-20b
3. qwen/qwen3.6-27b

Testing:
1. openai/gpt-oss-20b
2. openai/gpt-oss-120b
3. qwen/qwen3.6-27b

Security:
1. openai/gpt-oss-120b
2. qwen/qwen3.6-27b
3. openai/gpt-oss-20b

Documentation / Copilot:
1. openai/gpt-oss-20b
2. qwen/qwen3.6-27b
3. openai/gpt-oss-120b

Research / Compile:
1. groq/compound
2. openai/gpt-oss-120b
3. qwen/qwen3.6-27b

All model selection remains server-authoritative.

## 6. Token policy

Default output ceiling:
AI_DEFAULT_MAX_OUTPUT_TOKENS=2000

This is the predictable default that mirrors the previously working setup.

The token budget engine also respects:

- provider/model ceiling
- file type ceiling
- current observed provider TPM
- prompt/context size
- provider reset/cooldown

The application does not invent an 8,000 TPM ceiling. It learns the actual Groq organization limit from provider headers/errors.

## 7. Rate limiting

Groq TPM is an organization-level constraint.

Therefore API-key rotation does NOT create a new organization quota.

When Groq returns 429:

- record provider reset information
- enter a shared Groq cooldown
- do not immediately try all 20 keys
- do not cycle through all three models
- wait for the provider reset when appropriate
- then resume deterministically

This prevents a rate-limit storm.

## 8. Model availability

If one credential returns 404/403 because a model is unavailable:

- mark that credential/model pair unavailable for a short TTL
- try the next model for that same credential
- then continue to the next credential in the same workload group

This prevents a known-invalid model from being retried on every request.

## 9. Health checking

Credential health checks use the provider model-list endpoint rather than spending generation tokens on artificial "ping" completions.

This reduces unnecessary TPM consumption.

## 10. Generation flow

User
 ↓
UniversalPipeline
 ↓
one file generation task
 ↓
LLMRuntimeEngine
 ↓
context/token preflight
 ↓
AIService
 ↓
AIOrchestrator
 ↓
workload group
 ↓
deterministic API slot
 ↓
primary model
 ↓
Groq
 ↓
validation / normalization
 ↓
save file to workspace

If the primary model is genuinely unavailable:
primary → fallback model #2 → fallback model #3

If the provider is rate-limited:
request waits/cools down instead of cascading through all models.

## 11. Database

Credential storage remains unchanged.

Secrets remain server-side and encrypted.

No frontend API key exposure is introduced.

## 12. Why this is safer than the previous implementation

The previous 20-key implementation could effectively do:

API #04 → Model 1 → Model 2 → Model 3 → API #05 → Model 1 → ...

A single 429 could therefore create a cascade.

The new behavior is:

API #04 → Model 1
      ↳ 404 model access → Model 2
      ↳ 404 model access → Model 3
      ↳ 429 → STOP / cooldown

Then the next independent request starts at the next deterministic credential.

## 13. Important quota limitation

Twenty keys from the same Groq organization do not equal twenty independent TPM pools. The organization/provider limit still applies.

The application can make the routing deterministic and efficient, but it cannot bypass Groq's provider-enforced organization quota.

## 14. Existing application layers preserved

This patch intentionally does not change:

- Supabase database schema
- AI credential storage schema
- authentication
- admin roles
- user/project isolation
- project persistence
- contract compiler
- security audit engine
- deployment pipeline
- frontend routing
