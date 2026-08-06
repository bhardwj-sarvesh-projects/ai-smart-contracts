# Known Issues Log — AI Contracts v1.0

This log tracks identified limitations, edge cases, and minor issues observed during the exhaustive Demo 13 release audit and failure injection phases. No critical or blocker bugs remain active, but several behaviors have been logged for future maintenance and iterative enhancement.

---

## 1. Active Minor Issues

### ⚠️ Issue K-01: Asynchronous Task Queue Latency Under High System Load
- **Classification:** Performance / Usability
- **Symptom:** During periods of high concurrency (e.g., generating tests and running security audits simultaneously on multi-contract projects like the "Large Enterprise DeFi System"), background status indicators in the `BackgroundTaskManager` widget may experience updates delayed by 1–2 seconds.
- **Root Cause:** The browser’s main execution thread handles Monaco Editor syntax rendering and user input simultaneously. Under extremely heavy background tasks, the non-blocking React state updates queue up behind UI event dispatch loops.
- **Workaround:** This is a cosmetic delay. Code generation and auditing tasks execute successfully on the server, and full progress is restored as soon as background promises settle.

### ⚠️ Issue K-02: Mermaid Diagrams Node-Label Wrapping Restrictions
- **Classification:** UI / Rendering
- **Symptom:** In complex architectural flowcharts (e.g., multi-sig wallets with more than 5 participating signers or nested governance schemes), some contract node names containing multiple underscores (such as `AUTHORIZED_SIGNER_ROLE_CHECK`) overflow node boundaries.
- **Root Cause:** The Mermaid.js layout engine inside the `AuditingHub` lacks auto-wrapping for custom multi-word identifiers without manual `<br/>` HTML break insertions.
- **Workaround:** Click the contract item to isolate the call diagram or view the detailed visual components tree pane to see clear text.

### ⚠️ Issue K-03: Anchor Escrow Program Trait Resolution Warnings
- **Classification:** Compiler Diagnostic
- **Symptom:** Compiling Rust-based Solana Anchor projects occasionally emits minor cargo linter warnings regarding unused dependencies or deprecated attributes within Anchor core framework macros.
- **Root Cause:** Upstream dependency upgrades in anchor-lang version pinning.
- **Workaround:** Safe warnings are filtered out from blocking compile-gates, and only hard `error` severities block the validation gates.

---

## 2. Solved Issues and Regressions (Regression Guard Active)

The following issues were detected and resolved during the hardening phase:
1. **JSON Parser Malformations:** Empty or broken responses from LLMs now gracefully fallback to raw text parsing and auto-retry without crashing.
2. **Path Name Normalization:** Normalized case-insensitive matching across `PatchEngine` to prevent duplicate files like `contracts/Escrow.sol` and `contracts/escrow.sol` from co-existing during merge operations.
3. **Empty Export Validation:** The system now guarantees compliance documents are automatically appended on-the-fly during export packager calls.
