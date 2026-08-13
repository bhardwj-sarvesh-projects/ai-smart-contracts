# Legacy Removal Report

## Executive Summary
This report catalogs the systematic elimination of Generation Pipeline V1 code paths, legacy JSON schemas, and hybrid execution patterns across the entire codebase.

---

## Files Refactored / Legacy Code Eliminated

### 1. `EnterprisePromptBuilder.ts`
- **Eliminated**: Strict JSON object schema instructions (`{ "project": { "files": [...] } }`).
- **Eliminated**: Formatting instructions requesting multi-file JSON trees.
- **Enforced**: Pure raw source code output instructions per file path without markdown or wrapper objects.

### 2. `ResponseParser.ts`
- **Eliminated**: `parseAndNormalize()` JSON tree parser logic.
- **Enforced**: Direct raw source code extraction via `MarkdownFenceStripper` and dispatch to category validators.

### 3. `UniversalPipeline.ts`
- **Eliminated**: Hybrid fallback modes that permitted multi-file JSON parsing.
- **Enforced**: Full 12-stage execution flow with deterministic per-file task queue generation driven by `ProjectProfile`.

### 4. `LLMRuntimeEngine.ts`
- **Eliminated**: Unbounded token allocations and unmonitored retry loops.
- **Enforced**: Dynamic token budgeting (`calculateDynamicBudget`), context pruning (`pruneWorkspaceFiles`), provider capability auto-detection, and observability logging.

### 5. `WorkspaceIsolationValidator.ts`
- **Eliminated**: Cross-ecosystem pollution (e.g. Anchor `.rs` files appearing in EVM Foundry projects, or `.sol` files in Solana projects).
- **Enforced**: Strict fail-fast checks enforcing `validateProfileFileMismatch`.

---

## Legacy Code Elimination Checklist
- [x] Multi-file JSON project payload schema deleted from system prompts.
- [x] AI-owned file naming and path generation disabled.
- [x] Multi-file JSON response parser replaced with single-file normalization.
- [x] Engineering certification decoupled from LLM execution failures.
- [x] Multi-ecosystem file leaks blocked at validation and planner levels.
