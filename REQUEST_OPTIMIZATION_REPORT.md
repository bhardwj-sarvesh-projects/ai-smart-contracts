# Request Optimization Report

## Root Cause
Sending the entire workspace as context for single-file incremental generation led to excessive payload sizes, bloated context windows, slower execution speeds, and token quota exhaustion (such as HTTP 402 or Rate Limit errors).

---

## Workspace & Prompt Pruning
The new `LLMRuntimeEngine` introduces strict context pruning rules. When generating exactly **ONE** file, the workspace is pruned to include only relevant dependencies:

- **What is Included:**
  1. The **Current task** details and instructions.
  2. **Relevant imports** (specifically matching the dependencies of the target file).
  3. **Dependency interfaces** (such as standard contract interfaces, ERC standards).
  4. The **Project folder manifest** (for directory structural context).
  5. Previously generated files **ONLY** if they are imported or directly referenced by the file being built.

- **What is Strictly Excluded:**
  - `README.md` and other documentation files.
  - Verification, quality, audit, deployment, or certification reports (`PIPELINE_REFACTOR_REPORT.md`, `TASK_METADATA_REPORT.md`, `SOURCE_GENERATION_REPORT.md`, `COPILOT_REPORT.md`).
  - Cryptographic checksum logs (`EVIDENCE_MANIFEST.json`).
  - Unrelated contracts that have no import relation or reference to the target file.

---

## Adaptive Retry & Self-Healing Algorithm
When an LLM request fails, the engine analyzes the failure and executes an adaptive, self-healing recovery loop:

```
  [LLM Request Fails]
          │
          ▼
 [Analyze Error Logs]
          │
          ├─► Token Limit / Quota Exceeded? ────────┐
          ├─► Context Limit Exceeded? ──────────────┼─► [Scale Context Down by 50%]
          └─► Provider Overload? ───────────────────┘          │
                                                               ▼
                                                    [Scale Down Output Budget]
                                                               │
                                                               ▼
                                                       [Retry Request]
```

- **Maximum Retries:** `3` adaptive retries.
- **Payload Scaling:** Each subsequent retry mathematically decreases the workspace context size (dropping 50% of the less-relevant files) and scales down output token budgets to guarantee acceptance.
- **Rate-limit Backoff:** Introduces an exponential delay (`500ms * attempts`) to let provider systems recover.

---

## Observability & Performance Metrics
To ensure full request visibility, the runtime tracks key metrics without exposing sensitive authentication tokens:

- **Provider & Model identifier:** (e.g. `gemini`, `models/gemini-3.5-flash`)
- **Prompt & Completion Tokens:** (Estimated via length heuristics)
- **Requested vs Allowed Max Tokens:**
- **Prompt & Context Sizes:** (In characters)
- **Execution Latency:** (In milliseconds)
- **Failure Logs:** (Describing target limits, if hit)
