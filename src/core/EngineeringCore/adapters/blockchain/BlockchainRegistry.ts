import { BlockchainAdapter } from './BlockchainAdapter';

export class EVMAdapter implements BlockchainAdapter {
  constructor(
    public id: string,
    public name: string
  ) {}

  supportedLanguages = ['solidity', 'vyper'];
  defaultLanguage = 'solidity';
  supportedFrameworks = ['foundry', 'hardhat'];
  defaultFramework = 'foundry';
  compilerVersions = ['0.8.20', '0.8.24', '0.8.26'];
  standards = ['ERC-20', 'ERC-721', 'ERC-1155', 'ERC-4626', 'EIP-2612', 'ERC-1967'];
  defaultSDK = 'ethers.js / viem';
  deploymentStrategy = 'EIP-1559 Deterministic Factory Deployment via CREATE2';
  securityPatterns = ['Checks-Effects-Interactions', 'ReentrancyGuard', 'AccessControl', 'SafeERC20', 'Pausable'];
  bestPractices = ['Use custom errors instead of string reverts', 'Storage packing', 'Immutable variables', 'NatSpec docs'];
}

export class SolanaAdapter implements BlockchainAdapter {
  id = 'solana';
  name = 'Solana';
  supportedLanguages = ['rust'];
  defaultLanguage = 'rust';
  supportedFrameworks = ['anchor'];
  defaultFramework = 'anchor';
  compilerVersions = ['1.75.0', '1.78.0'];
  standards = ['SPL-Token', 'SPL-Token-2022', 'Metaplex NFT'];
  defaultSDK = '@solana/web3.js / Anchor TS';
  deploymentStrategy = 'Solana CLI program deploy / BPF loader';
  securityPatterns = ['Account owner validation', 'Signer validation', 'Rent exemption check', 'Discriminator checking'];
  bestPractices = ['Use Anchor macros', 'PDA seed derivation security', 'Space calculations for accounts'];
}

export class AptosAdapter implements BlockchainAdapter {
  id = 'aptos';
  name = 'Aptos';
  supportedLanguages = ['move'];
  defaultLanguage = 'move';
  supportedFrameworks = ['aptos-framework'];
  defaultFramework = 'aptos-framework';
  compilerVersions = ['1.8.0', '2.0.0'];
  standards = ['Fungible Asset (FA)', 'Aptos Token V2'];
  defaultSDK = '@aptos-labs/ts-sdk';
  deploymentStrategy = 'Aptos CLI package publish';
  securityPatterns = ['Resource capability pattern', 'Signer authorization', 'Abort codes'];
  bestPractices = ['Use Move formal verification (Move Prover)', 'Module initializers'];
}

export class SuiAdapter implements BlockchainAdapter {
  id = 'sui';
  name = 'Sui';
  supportedLanguages = ['move'];
  defaultLanguage = 'move';
  supportedFrameworks = ['sui-framework'];
  defaultFramework = 'sui-framework';
  compilerVersions = ['1.20.0'];
  standards = ['Sui Coin', 'Sui NFT / Kiosk'];
  defaultSDK = '@mysten/sui';
  deploymentStrategy = 'Sui CLI publish package';
  securityPatterns = ['Object ownership models', 'Capability pattern', 'Transfer policy enforcement'];
  bestPractices = ['Shared object vs owned object distinction', 'Key abilities'];
}

export class StarknetAdapter implements BlockchainAdapter {
  id = 'starknet';
  name = 'StarkNet';
  supportedLanguages = ['cairo'];
  defaultLanguage = 'cairo';
  supportedFrameworks = ['scarb'];
  defaultFramework = 'scarb';
  compilerVersions = ['2.6.0', '2.7.0'];
  standards = ['SRC-20', 'SRC-721'];
  defaultSDK = 'starknet.js';
  deploymentStrategy = 'Starkli declare and deploy';
  securityPatterns = ['Component pattern (OpenZeppelin Cairo)', 'Caller verification', 'Storage accessors'];
  bestPractices = ['Use Cairo components', 'Pedersen/Poseidon hash efficiency'];
}

export class CosmosAdapter implements BlockchainAdapter {
  id = 'cosmos';
  name = 'Cosmos';
  supportedLanguages = ['rust'];
  defaultLanguage = 'rust';
  supportedFrameworks = ['cosmwasm'];
  defaultFramework = 'cosmwasm';
  compilerVersions = ['1.5.0', '2.0.0'];
  standards = ['CW20', 'CW721', 'CW1155'];
  defaultSDK = 'cosmjs';
  deploymentStrategy = 'Store code -> Instantiate contract';
  securityPatterns = ['Submessage reply handling', 'Storage map key isolation', 'Deposit escrow'];
  bestPractices = ['Use cw-storage-plus', 'Proper error enum handling'];
}

export class HyperledgerAdapter implements BlockchainAdapter {
  id = 'hyperledger';
  name = 'Hyperledger Fabric';
  supportedLanguages = ['go', 'typescript'];
  defaultLanguage = 'go';
  supportedFrameworks = ['fabric-contract-api'];
  defaultFramework = 'fabric-contract-api';
  compilerVersions = ['go 1.21', 'node 20'];
  standards = ['Fabric Chaincode Standard'];
  defaultSDK = 'fabric-network SDK';
  deploymentStrategy = 'Peer lifecycle chaincode package, approve, commit';
  securityPatterns = ['Private Data Collections (PDC)', 'Client Identity library validation (cid)'];
  bestPractices = ['Avoid phantom reads', 'Deterministic execution'];
}

export class BlockchainRegistry {
  private static adapters: Map<string, BlockchainAdapter> = new Map();

  static initialize() {
    if (this.adapters.size > 0) return;
    
    const evmBlockchains = ['ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche'];
    evmBlockchains.forEach((id) => {
      const name = id.charAt(0).toUpperCase() + id.slice(1);
      this.adapters.set(id, new EVMAdapter(id, name === 'Bnb' ? 'BNB Chain' : name));
    });

    this.adapters.set('solana', new SolanaAdapter());
    this.adapters.set('aptos', new AptosAdapter());
    this.adapters.set('sui', new SuiAdapter());
    this.adapters.set('starknet', new StarknetAdapter());
    this.adapters.set('cosmos', new CosmosAdapter());
    this.adapters.set('hyperledger', new HyperledgerAdapter());
  }

  static getAdapter(id: string): BlockchainAdapter {
    this.initialize();
    const normalized = (id || 'ethereum').toLowerCase().replace(/\s+/g, '');
    return this.adapters.get(normalized) || this.adapters.get('ethereum')!;
  }

  static getAll(): BlockchainAdapter[] {
    this.initialize();
    return Array.from(this.adapters.values());
  }
}
