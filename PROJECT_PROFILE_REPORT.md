# Single Source of Truth: Project Profile Architecture

**Engine Standard:** Universal Engineering Core (`UniversalPipeline`)  
**Architecture Version:** v2.0.0-SSOT  
**Status:** ✅ ENFORCED & VERIFIED  

---

## Executive Summary

The project generation pipeline previously allowed multiple independent engines to infer project metadata (blockchain, language, framework, compiler, validator, layout) independently. This led to inconsistent behaviors (e.g. Solana + Solang incorrectly resolving into Anchor Rust `programs/lib.rs`).

This issue is permanently resolved by establishing **`ProjectProfile`** as the single, immutable source of truth for the entire core.

---

## ProjectProfile Architecture

```
                                  [ ArchitecturePlanner ]
                                             │
                                  creates ProjectProfile (ONCE)
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │   ProjectProfile (FROZEN) │
                               └─────────────┬─────────────┘
                                             │
      ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
      ▼                  ▼                   ▼                   ▼                  ▼
[ Workspace ]   [ ResponseParser ]  [ IncrementalGen ]   [ CompilerEngine ]  [ CertEngine ]
```

### Immutable Fields
- **`projectId`**: Unique identifier for the generation execution
- **`blockchain`**: Resolved chain (`ethereum`, `solana`, `aptos`, `sui`, `cosmos`, etc.)
- **`language`**: Resolved language (`solidity`, `rust`, `move`, `go`, `cairo`, `typescript`)
- **`framework`**: Resolved framework (`foundry`, `hardhat`, `anchor`, `solang`, `aptos-framework`, `sui-framework`)
- **`compiler`**: Target compiler (`forge`, `hardhat`, `anchor`, `solang`, `aptos-move`, `sui-move`)
- **`validator`**: Target validator (`SolidityValidator`, `RustValidator`, `MoveValidator`, `FrontendValidator`)
- **`workspaceTemplate`**: Target layout (`FoundryTemplate`, `HardhatTemplate`, `AnchorTemplate`, `SolangTemplate`, `AptosTemplate`, `SuiTemplate`)
- **`directoryLayout`**: Complete array of relative file paths for the workspace
- **`packageManager`**: `forge`, `cargo`, `npm`, `move`, `scarb`
- **`deploymentTarget`**: Execution environment target
- **`testingFramework`**: Framework-matched unit/integration test runner

---

## Fail-Fast Rules (Phase 9)

If any generated file violates the immutable `ProjectProfile`, the pipeline throws `PROJECT_PROFILE_MISMATCH` and aborts immediately:

- **Solang Projects:** Throw if `programs/`, `lib.rs`, or `Anchor.toml` is created.
- **Anchor Projects:** Throw if `contracts/` or `.sol` is created.
- **EVM Projects:** Throw if `programs/`, `lib.rs`, `Anchor.toml`, `Move.toml`, or `sources/` is created.
