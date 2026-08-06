# Deterministic Template Resolution Matrix

**Standard:** `(Blockchain + Language + Framework)` Triplet Resolution  
**Status:** ✅ ENFORCED & VERIFIED  

---

## Ecosystem Acceptance Matrix

| Blockchain | Language | Framework | Resolved Template | Workspace Layout | Compiler | Validator |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ethereum** | Solidity | Foundry | `FoundryTemplate` | `contracts/*.sol`, `test/*.t.sol`, `foundry.toml` | `forge` | `SolidityValidator` |
| **Ethereum** | Solidity | Hardhat | `HardhatTemplate` | `contracts/*.sol`, `test/*.test.ts`, `hardhat.config.ts` | `hardhat` | `SolidityValidator` |
| **Solana** | Rust | Anchor | `AnchorTemplate` | `programs/*/src/lib.rs`, `Anchor.toml`, `Cargo.toml` | `anchor` | `RustValidator` |
| **Solana** | Solidity | Solang | `SolangTemplate` | `contracts/*.sol`, `solang.toml`, `tests/*.ts` | `solang` | `SolidityValidator` |
| **Aptos** | Move | Aptos-Framework | `AptosTemplate` | `sources/*.move`, `Move.toml` | `aptos-move` | `MoveValidator` |
| **Sui** | Move | Sui-Framework | `SuiTemplate` | `sources/*.move`, `Move.toml` | `sui-move` | `MoveValidator` |
| **Cosmos** | Rust | CosmWasm | `CosmWasmTemplate` | `contracts/*/src/contract.rs`, `Cargo.toml` | `cargo-build` | `RustValidator` |
| **Starknet** | Cairo | Scarb | `ScarbTemplate` | `src/lib.cairo`, `Scarb.toml` | `scarb` | `CairoValidator` |

---

## Architectural Safeguards

1. **No Silent Substitutions:** Unsupported triplet combinations immediately throw `UNSUPPORTED_PROJECT_PROFILE`.
2. **Strict Isolation:** Solang never generates Anchor Rust files (`programs/lib.rs`), and Anchor never generates Solidity (`contracts/*.sol`).
