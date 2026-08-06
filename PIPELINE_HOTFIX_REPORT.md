# Pipeline Hotfix Architecture Report: Pre-Certification AI Output Isolation & Auto Cleanup

**Architecture Standard:** Project Generation Pipeline Hotfix  
**Status:** ✅ CERTIFIED & VERIFIED  

---

## Executive Summary

A critical issue in the project generation pipeline allowed raw, uncleaned, or syntactically invalid AI outputs (containing markdown fences, leading/trailing commentary, markdown headings, bullet lists, or missing pragma declarations) to bypass per-file validation layers and leak into downstream compiler and certification engines (`EngineeringCertificationEngine`).

This hotfix establishes a strict **Pre-Certification Boundary** and **Per-File Adaptive Auto-Cleanup & Retry Loop**, ensuring invalid AI responses are intercepted immediately upon generation and never reach workspace writers, compilers, or certification engines.

---

## Enforced Pipeline Architecture

```
[ AI Generation ]
       │
       ▼
[ ResponseParser ]
       │
       ▼
[ MarkdownFenceStripper.strip(content, path) ]  <── Stage 1: Auto Cleanup
       │
       ▼
[ Category & Language Validator ]                <── Stage 2: Syntax Gate
       ├── SmartContractValidator (Pragma check, zero leakage)
       ├── FrontendValidator (Script/DOM balance)
       ├── ConfigurationValidator (TOML/JSON structure)
       └── DocumentationValidator (Markdown structure)
       │
       ├─── (If Validation Fails) ────► [ Per-File Retry (Max 3) ] ──┐
       │                                 ├── Target Path Prompt      │
       │                                 ├── Raw Source Constraint   │
       │                                 └── Fast Fail if Exhausted  │
       ▼                                                             │
[ Workspace Writer ] ◄───────────────────────────────────────────────┘
       │
       ▼
[ CompilerEngine ]
       │
       ▼
[ EngineeringCertificationEngine ] (Only Certified, Validated Source)
```

---

## Key Technical Enhancements

### 1. Response Auto-Cleanup (`MarkdownFenceStripper`)
- Automatically strips opening/closing triple-backtick fences (` ```solidity `, ` ```rust `, ` ```move `, etc.).
- Strips leading AI explanations, prose headers, markdown headings, bullet lists, and AI commentary from code files (`.sol`, `.rs`, `.move`, `.ts`, `.toml`, `.json`).
- Intelligently preserves markdown structures for documentation files (`.md`).
- Strips trailing commentary after code block termination.

### 2. Solidity Validator (`SmartContractValidator`)
- Enforces that after cleanup, the first non-comment, non-empty line MUST begin with `pragma solidity`.
- Accounts for SPDX license headers and multiline comment blocks (`/* ... */`) preceding `pragma solidity`.
- Completely rejects JSON leakage, markdown leakage, TOML leakage, and ENV variable leakage.

### 3. Per-File Adaptive Retry Loop (`LLMRuntimeEngine`)
- Intercepts validation errors inside `LLMRuntimeEngine.executeWithAdaptiveRetry` per file.
- Does NOT regenerate the entire project workspace if a single file fails validation.
- Constructs precise per-file retry prompts specifying target file path, language, framework, and required starting syntax (`First line MUST be: pragma solidity ^0.8.20;`).
- Fast-fails and halts the pipeline immediately if 3 retries are exhausted for a single file.

### 4. Absolute Certification Boundary
- `EngineeringCertificationEngine` is strictly isolated downstream of workspace file writing and compiler gates.
- Invalid AI outputs can NEVER leak into certification.

---

## Acceptance Verification Results

- [x] **Response Cleanup:** Markdown, explanations, headings, and commentary automatically removed before validation.
- [x] **Solidity Validation:** `.sol` files verified to start with `pragma solidity` (accounting for leading SPDX comments).
- [x] **Anchor Rust Validation:** `lib.rs` verified to contain `anchor_lang`.
- [x] **Documentation Validation:** `README.md` verified to preserve markdown headers, bullet lists, and internal code blocks.
- [x] **Configuration Validation:** `foundry.toml` verified to validate cleanly as TOML.
- [x] **Per-File Retry Strategy:** Invalid attempt 1 intercepted and recovered on attempt 2 per-file.
- [x] **Certification Boundary:** Zero invalid AI responses reach `EngineeringCertificationEngine`.
