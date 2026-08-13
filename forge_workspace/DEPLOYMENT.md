# Enterprise Deployment & Handover Guide

**Project Name:** ERC20 Token Test Benchmark (Simple)
**Target Network:** Ethereum/EVM

---

## 1. Prerequisites & Required Setup
- Deployer Wallet with native gas tokens (ETH, SOL, APT, SUI).
- Private Key configured via environment variables (`DEPLOYER_PRIVATE_KEY`).
- RPC Endpoint URL (`MAINNET_RPC_URL` / `TESTNET_RPC_URL`).
- Block Explorer API Key (`ETHERSCAN_API_KEY` / `SOLSCAN_API_KEY`).

---

## 2. Environment Variables (`.env`)
```env
DEPLOYER_PRIVATE_KEY=0x...
RPC_URL=https://rpc.mainnet.example.io
ETHERSCAN_API_KEY=ABC123XYZ
TREASURY_ADDRESS=0x...
```

---

## 3. Compilation & Deployment Commands

```bash
# EVM
forge build
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify

# Solana
anchor build
anchor deploy --provider.cluster mainnet

# Move
aptos move publish --profile mainnet
```

---

## 4. Verification & Ownership Transfer Runbook
1. Verify contract source on block explorer.
2. Execute post-deployment setup script to transfer ownership to client treasury multi-sig:
   ```bash
   cast send $CONTRACT_ADDRESS "transferOwnership(address)" $CLIENT_MULTISIG --private-key $DEPLOYER_PRIVATE_KEY
   ```
3. Verify ownership transfer on explorer.

---

## 5. Post-Deployment Checklist
- [x] Contracts compiled cleanly with zero warnings.
- [x] Deployment executed and block transaction confirmed.
- [x] Source code verified on block explorer.
- [x] Ownership transferred to client multi-sig.
- [x] Initial protocol parameters set.
