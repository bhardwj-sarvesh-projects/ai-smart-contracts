# ERC20 Token Test Benchmark (Simple)

Enterprise-grade Fungible Token Standard (ERC20 / SPL / Coin) architecture deployed on Ethereum/EVM.

## Project Architecture
- `src/`: Production smart contract source files
- `test/`: Automated unit, fuzz, and edge-case test suite
- `script/`: Network deployment scripts
- `src/interfaces/`: Standard protocol NatSpec interfaces

## Verification & Testing
```bash
forge test --vvv
forge script script/DeployTestToken.s.sol --rpc-url sepolia --broadcast