# Project Profile Specification Report

## Overview
In Generation Pipeline V2, the `ProjectProfile` is the **Immutable Single Source of Truth**. The profile is generated deterministically by `ArchitecturePlanner.createProfile()` prior to any LLM execution. The LLM is NEVER permitted to decide or alter project paths, filenames, extensions, compilers, or directory structures.

---

## Profile Mapping Matrix

| Blockchain / Ecosystem | Language | Framework | Compiler | Workspace Template | Directory Layout Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EVM (Ethereum, Polygon, Base, Arbitrum, Optimism, BNB, Avalanche)** | `solidity` | `foundry` | `forge` | `FoundryTemplate` | `contracts/Contract.sol`, `interfaces/IContract.sol`, `libraries/Lib.sol`, `test/Contract.t.sol`, `foundry.toml` |
| **EVM (Hardhat)** | `solidity` | `hardhat` | `hardhat` | `HardhatTemplate` | `contracts/Contract.sol`, `scripts/deploy.ts`, `test/Contract.test.ts`, `hardhat.config.ts` |
| **Solana (Anchor)** | `rust` | `anchor` | `anchor` | `AnchorTemplate` | `programs/my_contract/src/lib.rs`, `tests/anchor-test.ts`, `Anchor.toml`, `Cargo.toml` |
| **Solana (Solang)** | `solidity` | `solang` | `solang` | `SolangTemplate` | `contracts/Contract.sol`, `tests/solang-test.ts`, `solang.toml` |
| **Aptos** | `move` | `aptos-framework` | `aptos-move` | `AptosTemplate` | `sources/my_contract.move`, `tests/move_test.move`, `Move.toml` |
| **Sui** | `move` | `sui-framework` | `sui-move` | `SuiTemplate` | `sources/my_contract.move`, `tests/move_test.move`, `Move.toml` |
| **Cosmos** | `rust` | `cosmwasm` | `cargo-build` | `CosmWasmTemplate` | `contracts/my_contract/src/contract.rs`, `Cargo.toml` |
| **Hyperledger** | `typescript` / `go` | `fabric` | `generic` | `FabricTemplate` | `chaincode/my_contract/contract.ts`, `config/connection.json` |
| **Starknet** | `cairo` | `scarb` | `generic` | `ScarbTemplate` | `src/lib.cairo`, `src/my_contract.cairo`, `Scarb.toml` |

---

## Profile Enforcement Mechanisms
1. **`ArchitecturePlanner.createProfile(req)`**: Deterministically produces an immutable, frozen `ProjectProfile` object.
2. **`ArchitecturePlanner.validateProfileFileMismatch(profile, filePath)`**: Throws `PROJECT_PROFILE_MISMATCH` if any generated file path violates the profile's allowed ecosystem structure.
3. **`WorkspaceIsolationValidator.validate(files, profile)`**: Rejects any file containing prohibited cross-ecosystem syntax or file paths during workspace validation.
