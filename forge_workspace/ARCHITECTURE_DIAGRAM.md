# System Architecture Diagram

**Project Name:** ERC20 Token Test Benchmark (Simple)

```mermaid
graph TD
    subgraph Client Layer
        Web3App[Web3 DApp / SDK]
        CLI[Command Line & Scripts]
    end

    subgraph Blockchain Runtime (Ethereum/EVM)
        ContractCore[ERC20 Token Test Benchmark (Simple) Core Contract]
        AccessControlModule[Access Control & Roles]
        VaultModule[Vault & Escrow Manager]
        EmergencyModule[Pausable Circuit Breaker]
    end

    subgraph External System
        TreasuryWallet[Treasury Multi-sig]
        Indexer[Subgraph / Event Indexer]
    end

    Web3App --> ContractCore
    CLI --> ContractCore
    ContractCore --> AccessControlModule
    ContractCore --> VaultModule
    ContractCore --> EmergencyModule
    VaultModule --> TreasuryWallet
    ContractCore --> Indexer
```
