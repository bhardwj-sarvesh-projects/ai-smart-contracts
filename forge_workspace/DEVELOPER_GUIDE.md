# Developer Contribution & Technical Setup Guide

**Project Name:** ERC20 Token Test Benchmark (Simple)
**Target Network:** Ethereum/EVM
**Last Updated:** 2026-08-12T07:04:31.290Z

---

## 1. Environment Setup & Toolchain Prerequisites

To build, test, and contribute to **ERC20 Token Test Benchmark (Simple)**, ensure you have installed the required toolchain:

- **EVM (Solidity):** Foundry (`forge` v0.2.0+) or Hardhat v2.20+ with Node.js v20 LTS.
- **Solana (Rust / Anchor):** Solana CLI v1.18+, Rust toolchain v1.75+, Anchor CLI v0.30+.
- **Move (Aptos / Sui):** Aptos CLI v3.0+ / Sui CLI v1.20+.

---

## 2. Directory & Source Layout Guidelines

- Maintain strict modularity: split contracts, state storage, and access controls into isolated libraries.
- All code modifications **MUST** update unit and fuzz tests under the `test/` or `tests/` folder.
- Ensure custom error definitions are used instead of string `require` messages.

---

## 3. Local Build & Development Flow

```bash
# 1. Clone repository
git clone <repository-url>
cd erc20 token test benchmark (simple)

# 2. Build smart contracts
# EVM
forge build
# Anchor
anchor build

# 3. Run automated tests with verbose output
# EVM
forge test -vvv
# Anchor
anchor test
```

---

## 4. Code Quality & Formatting Standards

1. All Solidity code must target `pragma solidity ^0.8.20;`.
2. Format code using `forge fmt` (Solidity), `cargo fmt` (Rust), or `aptos move fmt`.
3. Do not check in private keys or environment credentials. Use `.env.example` templates.

---

## 5. Submitting Pull Requests & Synchronizing Docs
Whenever modifying function signatures, state variables, or business rules:
1. Update `API_REFERENCE.md`.
2. Re-verify `ARCHITECTURE.md` and `KNOWLEDGE_INDEX.md`.
3. Run `npm run test` or `forge test` to verify regression suites.
