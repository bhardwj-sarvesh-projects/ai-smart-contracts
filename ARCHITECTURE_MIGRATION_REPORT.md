# Architecture Migration Report: Legacy Monolith to Incremental V2

**Migration Date:** August 6, 2026  
**System Target:** Enterprise Smart Contract & DApp Project Generation Engine  

---

## 1. Migration Rationale & Root Causes

| Legacy Flaw | Root Cause | V2 Architectural Solution |
| :--- | :--- | :--- |
| **`INVALID_AI_RESPONSE`** | LLM forced to format multi-file JSON arrays with escaped strings, causing JSON truncation and syntax errors. | **Raw Source Only:** LLM generates raw source code for one file at a time. Zero JSON wrappers. |
| **Solidity `pragma` Failure** | Explanatory text or markdown fences inserted before contract code. | **Response Normalizer & Pre-Validation Check:** `MarkdownFenceStripper` strips headers/fences; `SmartContractValidator` enforces `pragma solidity` on line 1. |
| **Context Window Overflow** | Multi-file completions exceeded provider output limits (4k-8k tokens). | **Incremental Task Queue:** Each file is generated independently with pruned workspace context (<2k tokens). |
| **Workspace Corruption** | Invalid files written directly to workspace state, breaking compiler for subsequent turns. | **Validation Gate Before Write:** Files are validated in memory; invalid files trigger per-file retries and are never written to workspace until certified. |
| **Certification Engine Crashes** | Certification engine tried to parse and fix raw LLM outputs. | **Strict Decoupling:** `EngineeringCertificationEngine` runs purely on compiled workspace code, zero LLM dependencies. |

---

## 2. Core Architectural Changes

### A. Planner-Owned Topological Task Queue
- `ProjectPlanner` produces a flat list of `ProjectTask` items sorted by dependency depth (Interfaces → Libraries → Base Contracts → Primary Contracts → Deploy Scripts → Config/Docs).

### B. Adaptive Per-File Retry Engine
- Managed inside `LLMRuntimeEngine.executeWithAdaptiveRetry`:
  - **Attempt 1:** Standard single-file generation prompt.
  - **Attempt 2:** Dynamic error context injection + explicit syntax directives.
  - **Attempt 3:** Pure Code Mode (strictly raw output, halved output budget).

### C. Category-Aware Validators
- Dedicated validators enforce structural constraints per file category:
  - `SmartContractValidator`: `pragma solidity` (Solidity), `anchor_lang` (Rust), `module` (Move).
  - `FrontendValidator`: `<!DOCTYPE html>` or `<html>` tag check.
  - `ConfigurationValidator`: TOML parsing and ENV key-value structure validation.
  - `DocumentationValidator`: Markdown structure validation & code fence sanity checks.

---

## 3. Migration Verification Summary

- **Build Status:** `npm run build` / `compile_applet` passed cleanly.
- **Type Safety:** `tsc --noEmit` / `lint_applet` passed with 0 errors.
- **Acceptance Tests:** `src/test_pipeline_v2_acceptance.ts` passed 100% of test scenarios.
