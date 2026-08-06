# Regression Testing Results — AI Contracts v1.0

This report tracks the performance of the full benchmark project suite during the release candidate hardening cycle. Regression testing ensures that fixes applied to specific subsystems (such as security remediation and compiler outputs) did not break existing features.

---

## 1. Regression Test Coverage

The regression suite verified both standard smart contract functionality and developer workflow tooling across 18 target projects.

### Language and Platform Matrix

- **Solidity Frameworks:** Hardhat, Foundry
- **Solana Frameworks:** Anchor, Rust Native
- **Move Frameworks:** Aptos-CLI, Sui-CLI

---

## 2. Test Execution Dashboard

| Benchmark Project | Initial Generation | Syntax Compiler | Threat Modelling | Remediation | Verification | Regression Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **ERC20 Token** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **ERC721 NFT** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **ERC1155 Suite** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **NFT Marketplace** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Escrow Vault** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **DAO Governance** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Staking Pool** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Vesting Vaults** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Crowdfunding** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Lottery Pool** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Multisig Wallet** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Payment Splitter**| ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **SPL Token** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Anchor Escrow** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **NFT Program** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Coin Module** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Escrow Module** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Coin Package** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Escrow Package** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |
| **Large DeFi Core** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | 🟢 Stable |

---

## 3. Regression Safeguard Log

During Phase 7 regression validation, two potential regression vectors were detected and resolved:

1. **Vulnerability Map Key Collisions:**
   - *Symptom:* After modifying the structure of audit findings to include precise line numbers, the UI experienced rendering exceptions when multiple findings mapped to the same line.
   - *Fix:* Added composite keys `vuln.id` or `${vuln.file}-${vuln.line}-${vuln.title}` in component rendering lists. No active rendering errors remain.

2. **Zip Path Delimiters:**
   - *Symptom:* On Windows-based target deployment runs, exported file tree paths in the ZIP bundle occasionally mixed backslashes (`\`) and forward slashes (`/`), confusing localized unzipping utilities.
   - *Fix:* Added rigid path normalization across the exporter, standardizing all output ZIP delimiters to `/`.
