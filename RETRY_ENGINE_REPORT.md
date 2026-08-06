# Per-File Retry Engine & Adaptive Intelligence Report

**Engine Standard:** `LLMRuntimeEngine` & Incremental Finalization Pipeline  
**Status:** ✅ ENFORCED & VERIFIED  

---

## Retry Engine Mechanics

### 1. Per-File Isolation Principle
When an AI response fails category validation (e.g. `app/index.html`), the pipeline isolates the failure to `app/index.html`. All other generated files in `generatedFiles` remain unmodified and locked. No workspace resets or full contract retries occur.

### 2. Progressive 3-Stage Retry Strategy

```
Attempt 1: Standard Prompt + Preprocessing Stripper
    │ (Validation Failure)
    ▼
Attempt 2: Concise Prompt Mode + Error Feedback (Delay: 50ms)
    │ (Validation Failure)
    ▼
Attempt 3: Strict Pure Code Mode + Reduced Output Budget (Delay: 50ms)
    │ (Validation Failure)
    ▼
Fast-Fail Abort: Throw Error immediately (< 3s total runtime)
```

- **Attempt #1:** Standard system instruction + `MarkdownFenceStripper.strip()`.
- **Attempt #2:** Adds concise formatting instruction: `[CONCISE FORMATTING MODE] Return ONLY raw source code for this file. Zero markdown fences, zero prose.`
- **Attempt #3:** Activates strict pure code mode + reduces output token budget by 50% (`safeOutputTokens / 2`) to ensure concise code generation.

---

## Structured Retry Logging Telemetry

Every retry event emits structured console logs with full observability details:

```json
{
  "file": "app/index.html",
  "attempt": 2,
  "validationStage": "FRONTEND_VALIDATION",
  "provider": "gemini",
  "promptTokens": 412,
  "completionTokens": 0,
  "failureReason": "INVALID_AI_RESPONSE: HTML file app/index.html contains raw markdown code fences",
  "retryDurationMs": 142
}
```

---

## Engineering Certification Safeguards

- `EngineeringCertificationEngine` performs **ZERO LLM calls** and **ZERO retries**.
- If any required file is missing from the workspace, `EngineeringCertificationEngine` throws `WORKSPACE_INCOMPLETE: Workspace contains no project files.` immediately.
