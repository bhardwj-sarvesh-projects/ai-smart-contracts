# Pipeline Migration Report

## Executive Summary
This document confirms the full, non-hybrid migration from Generation Pipeline V1 to **Generation Pipeline V2**. All legacy multi-file JSON generation contracts, parsing hacks, and client/LLM-owned file naming paths have been completely removed or refactored into the **Planner-Owned Architecture**.

---

## Migration Matrix

| Component | V1 Architecture (Legacy) | V2 Architecture (Current) | Migration Status |
| :--- | :--- | :--- | :--- |
| **Project Profile** | Dynamic / Scattered | `ArchitecturePlanner.createProfile()` | **100% Complete** |
| **Filename Ownership** | LLM / JSON response | `ArchitecturePlanner` / Deterministic Layout | **100% Complete** |
| **Response Format** | Multi-file JSON (`{ project: { files: [] } }`) | Pure Raw Source Code | **100% Complete** |
| **Generation Engine** | Single-shot JSON payload | Deterministic Task Queue (Per-File Iteration) | **100% Complete** |
| **Response Parsing** | `ResponseParser.parseAndNormalize()` | `MarkdownFenceStripper` + Per-File Validator | **100% Complete** |
| **Workspace Isolation** | Mixed ecosystem files allowed | `WorkspaceIsolationValidator` | **100% Complete** |
| **Retry Strategy** | Naive whole-project retry | `LLMRuntimeEngine.executeWithAdaptiveRetry` | **100% Complete** |
| **Certification Engine** | Coupled with generation failures | Independent, Deterministic Gate Verification | **100% Complete** |

---

## Primary Architectural Pillars Enforced
1. **Single Source of Truth (`ProjectProfile`)**: The `ArchitecturePlanner` resolves blockchain, language, framework, compiler, validator, and directory layout prior to any LLM execution.
2. **Deterministic Task Queue**: Each workspace file is assigned a discrete task in a sequential queue. The LLM generates source code for one specific file path at a time.
3. **Pure Code Mode**: System prompts demand raw code output. Responses undergo stripping via `MarkdownFenceStripper` and normalization via `WhitespaceNormalizer`.
4. **Adaptive Failure Recovery**: Retries occur strictly on a per-file level with progressive prompt tightening and workspace context pruning.
5. **Fail-Fast Profile Validation**: `ArchitecturePlanner.validateProfileFileMismatch()` guarantees that files generated for EVM cannot contain Solana/Move paths, and vice versa.
