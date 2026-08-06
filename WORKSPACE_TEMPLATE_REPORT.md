# Workspace Template Enforcement Report

**Module:** `ArchitecturePlanner` & `WorkspaceManager`  
**Status:** ✅ ENFORCED & VERIFIED  

---

## Workspace Layout Specifications

### 1. Solana + Solang (`SolangTemplate`)
- **Strictly Prohibited:** `programs/`, `lib.rs`, `Anchor.toml`
- **Layout:**
  - `contracts/${ContractName}.sol`
  - `tests/solang-test.ts`
  - `scripts/deploy.ts`
  - `solang.toml`
  - `package.json`

### 2. Solana + Anchor (`AnchorTemplate`)
- **Strictly Prohibited:** `contracts/`, `.sol`
- **Layout:**
  - `programs/${program_name}/src/lib.rs`
  - `tests/anchor-test.ts`
  - `migrations/deploy.ts`
  - `Anchor.toml`
  - `Cargo.toml`

### 3. EVM Foundry (`FoundryTemplate`)
- **Layout:**
  - `contracts/${ContractName}.sol`
  - `interfaces/I${ContractName}.sol`
  - `libraries/${ContractName}Lib.sol`
  - `test/${ContractName}.t.sol`
  - `foundry.toml`

### 4. Aptos / Sui Move (`AptosTemplate` / `SuiTemplate`)
- **Layout:**
  - `Move.toml`
  - `sources/${module_name}.move`
  - `tests/move_test.move`
