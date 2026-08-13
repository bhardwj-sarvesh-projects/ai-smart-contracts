# System Flow & Data Architecture Diagram

**Project Name:** ERC20 Token Test Benchmark (Simple)

```mermaid
graph TD
    User([User / Web3 Wallet]) -->|1. Submit Call| Contract[ERC20 Token Test Benchmark (Simple) Smart Contract]
    Contract -->|2. Verify Reentrancy & Role| AccessControl{Access Control & Security}
    AccessControl -->|Passed| Vault[Escrow / Token Vault]
    AccessControl -->|Unauthorized / Paused| Revert[Revert Execution]
    Vault -->|3. Calculate Fee| Treasury[Protocol Treasury]
    Vault -->|4. Complete Settlement| Beneficiary([Beneficiary / Recipient])
```
