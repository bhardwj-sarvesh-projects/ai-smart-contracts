# Groq 20-Key Dedicated Routing Implementation Report

## Implemented

- Increased the authoritative Groq credential ceiling from 15 to 20.
- Added deterministic API slot identities `API 01` through `API 20`.
- Added server-owned routing groups. Administrators cannot choose a group.
- Added three locked models to every routing group. Administrators cannot choose or edit models.
- Changed AI orchestration from one global key pool to task-specific credential pools.
- Kept model failover inside the same dedicated API group.
- Preserved encrypted Supabase storage and server-only secret decryption.
- Added `routing_group` persistence in Supabase.
- Added a database unique slot constraint and 1-20 slot enforcement.
- Replaced the previous database trigger's 15-key ceiling with a 20-key ceiling.
- Updated the Admin AI Infrastructure UI to show API slot, workload group, and that three models are locked.
- Added routing-group data to the admin policy/overview API.
- Added regression tests for 20 slots, three models per group, and deterministic task-to-slot mappings.

## Routing table

| Slots | Work | Models |
|---|---|---|
| 01-03 | Architecture / Repository Analysis | GPT-OSS 120B, Llama 3.3 70B, GPT-OSS 20B |
| 04-06 | Smart Contract Generation | GPT-OSS 120B, GPT-OSS 20B, Llama 3.3 70B |
| 07-09 | Editing / Repair | GPT-OSS 120B, GPT-OSS 20B, Llama 3.3 70B |
| 10-12 | Testing / Test Analysis | GPT-OSS 20B, GPT-OSS 120B, Llama 3.3 70B |
| 13-15 | Security / Security Remediation | GPT-OSS 120B, Llama 3.3 70B, GPT-OSS 20B |
| 16-18 | Documentation / Copilot | Llama 3.3 70B, GPT-OSS 20B, GPT-OSS 120B |
| 19-20 | Research | Groq Compound, GPT-OSS 120B, Llama 3.3 70B |

## Request algorithm

For a generation request, for example:

`API 04 -> GPT-OSS 120B -> GPT-OSS 20B -> Llama 3.3 70B -> API 05 -> ... -> API 06`

A 401/403 or rate-limit event puts that key into cooldown and moves to the next dedicated key. A model-specific availability/compatibility error advances to the next model on the same key.

## Supabase action required

Run:

`supabase/migrations/20260819000002_groq_dedicated_routing_v2.sql`

Then deploy the server with:

`GROQ_MAX_CREDENTIALS=20`

No `VITE_GROQ_MAX_CREDENTIALS` variable is required.
