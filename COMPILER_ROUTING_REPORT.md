# Deterministic Compiler Routing Report

**Module:** `CompilerEngine`  
**Status:** ✅ ENFORCED & VERIFIED  

---

## Routing Mechanics

`CompilerEngine.detectCompiler()` routes toolchain selection strictly according to the immutable `ProjectProfile`:

```
               ┌─────────────────────────────────────┐
               │    ProjectProfile.compiler Field    │
               └──────────────────┬──────────────────┘
                                  │
      ┌──────────────┬────────────┼────────────┬──────────────┐
      ▼              ▼            ▼            ▼              ▼
   [ forge ]    [ hardhat ]   [ anchor ]   [ solang ]   [ aptos/sui-move ]
```

### Supported Compiler Targets
- **`forge`**: EVM Foundry toolchain (`forge build`)
- **`hardhat`**: EVM Hardhat toolchain (`hardhat compile`)
- **`anchor`**: Solana Anchor Rust framework (`anchor build`)
- **`solang`**: Solana Solidity Compiler (`solang compile`)
- **`aptos-move`**: Aptos Move CLI (`aptos move compile`)
- **`sui-move`**: Sui Move CLI (`sui move build`)
- **`scarb`**: Starknet Scarb Cairo compiler (`scarb build`)
- **`cargo-build`**: CosmWasm / Generic Rust compiler

---

## Fail-Fast Protection
Compilation routing never relies on file extensions alone when `ProjectProfile` is available.
Solidity on Solana is routed strictly to `solang` and never to `forge` or `anchor`.
