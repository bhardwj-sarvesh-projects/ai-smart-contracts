# LLM Runtime Report

## Root Cause Analysis
The previous incremental generation pipeline faced runtime bottlenecks due to inefficient LLM execution. The primary failures included:
- **HTTP 402/Quota limits:** Unfiltered context payload sizes exceeding provider capabilities or affordable budget limits.
- **Excessively large prompts:** Sending the entire workspace, including unrelated contracts, documentation (like README, REPORTS, and Certifications), causing context-window bloat.
- **Static output limiters:** Constant, rigid maximum output token properties (e.g. `2000` or `4000`) irrespective of the specific provider.
- **Blind retries:** Resubmitting the exact same failed prompt without adapting or pruning context sizes, leading to consecutive, identical API failures.
- **Non-deterministic executions:** Let-alone stages (like Engineering Certification, Exporting, and Documentation sync) inappropriately calling LLMs rather than utilizing deterministic templates.

---

## Runtime Architecture Overview
We have refactored the runtime to introduce a **Production-Grade LLM Execution layer** that wraps the raw execution engine. The new architecture abstracts provider limits, dynamically calculates token budgets, prunes prompt workspaces to the absolute minimum dependencies, and implements an adaptive, self-healing retry loop.

```
       [Raw User Prompt / Pipeline Queue]
                       │
                       ▼
            [Workspace Pruning Module]
   (Drops Markdown, Checksums, Unrelated files)
                       │
                       ▼
          [Dynamic Token Budgeting]
   (Checks Provider Limit -> Calculates Margin -> Clamps)
                       │
                       ▼
           [Adaptive Retry Engine]
   (Success) ───► [Execution Observability]
   (Failure) ───► [Prune Context 50% & Retry] (Max 3)
```

---

## Active Engine Boundaries & AI Permission Matrix
To minimize API usage and guarantee zero non-deterministic overhead, we enforce strict AI execution boundaries.

| Engine / Component | Calls LLM? | Method of Execution |
| :--- | :---: | :--- |
| **SmartContractGenerationEngine** | **YES** | Delegates strictly through `UniversalPipeline` |
| **CopilotEngine** | **YES** | Contextual edits |
| **Security Remediation** | **YES** | Self-healing code repair |
| **EngineeringCertificationEngine**| **NO** | 100% Deterministic string templates |
| **ExportEngine** | **NO** | 100% Deterministic checksums & zip creation |
| **Documentation Sync** | **NO** | 100% Deterministic markdown guides |
| **Release & Quality Reports** | **NO** | 100% Deterministic analysis templates |

---

## Acceptance Verification Results
- **Lint Verification:** `tsc --noEmit` passed cleanly.
- **Compilation Gates:** Zero build-time syntax errors.
- **Adaptive Execution:** Verified that runtime automatically shrinks payload size and adjusts budgets without requiring any human intervention.
- **Finalization Completeness:** The entire post-generation audit and certification pipeline completes successfully with absolutely zero external AI dependencies.
