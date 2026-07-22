import { ProjectRequirements } from '../types';

export class RequirementAnalyzer {
  static extract(
    prompt: string,
    overrideBlockchain?: string,
    overrideLanguage?: string,
    overrideFramework?: string
  ): ProjectRequirements {
    const lower = prompt.toLowerCase();

    // Blockchain detection
    let blockchain = overrideBlockchain || 'ethereum';
    if (!overrideBlockchain) {
      if (lower.includes('solana')) blockchain = 'solana';
      else if (lower.includes('aptos')) blockchain = 'aptos';
      else if (lower.includes('sui')) blockchain = 'sui';
      else if (lower.includes('starknet') || lower.includes('cairo')) blockchain = 'starknet';
      else if (lower.includes('cosmos') || lower.includes('cosmwasm')) blockchain = 'cosmos';
      else if (lower.includes('polygon')) blockchain = 'polygon';
      else if (lower.includes('arbitrum')) blockchain = 'arbitrum';
      else if (lower.includes('optimism') || lower.includes('op stack')) blockchain = 'optimism';
      else if (lower.includes('base')) blockchain = 'base';
      else if (lower.includes('bnb') || lower.includes('binance')) blockchain = 'bnb';
      else if (lower.includes('avalanche')) blockchain = 'avalanche';
      else if (lower.includes('hyperledger') || lower.includes('fabric')) blockchain = 'hyperledger';
    }

    // Language detection
    let language = overrideLanguage || 'solidity';
    if (!overrideLanguage) {
      if (blockchain === 'solana' || blockchain === 'cosmos') language = 'rust';
      else if (blockchain === 'aptos' || blockchain === 'sui') language = 'move';
      else if (blockchain === 'starknet') language = 'cairo';
      else if (blockchain === 'hyperledger') language = 'go';
      else language = 'solidity';
    }

    // Framework detection
    let framework = overrideFramework || 'foundry';
    if (!overrideFramework) {
      if (blockchain === 'solana') framework = 'anchor';
      else if (blockchain === 'aptos') framework = 'aptos-framework';
      else if (blockchain === 'sui') framework = 'sui-framework';
      else if (blockchain === 'starknet') framework = 'scarb';
      else if (blockchain === 'cosmos') framework = 'cosmwasm';
      else if (blockchain === 'hyperledger') framework = 'fabric-contract-api';
      else framework = lower.includes('hardhat') ? 'hardhat' : 'foundry';
    }

    // Contract Type detection
    let contractType = 'ERC-20 Token';
    if (lower.includes('nft') || lower.includes('erc721') || lower.includes('erc-721')) contractType = 'NFT Collection (ERC-721)';
    else if (lower.includes('multi-token') || lower.includes('erc1155') || lower.includes('erc-1155')) contractType = 'Multi-Token (ERC-1155)';
    else if (lower.includes('vault') || lower.includes('erc4626') || lower.includes('yield')) contractType = 'Yield Vault (ERC-4626)';
    else if (lower.includes('staking') || lower.includes('reward')) contractType = 'Staking & Rewards Protocol';
    else if (lower.includes('dex') || lower.includes('amm') || lower.includes('swap') || lower.includes('liquidity')) contractType = 'DEX / Automated Market Maker';
    else if (lower.includes('dao') || lower.includes('governance') || lower.includes('governor')) contractType = 'DAO Governance Protocol';
    else if (lower.includes('marketplace') || lower.includes('auction')) contractType = 'Decentralized Marketplace';
    else if (lower.includes('lending') || lower.includes('borrow')) contractType = 'Lending & Borrowing Protocol';
    else if (lower.includes('bridge') || lower.includes('cross-chain') || lower.includes('layerzero')) contractType = 'Cross-Chain Messaging Protocol';

    // Security requirements
    const securityRequirements: string[] = ['Reentrancy Protection', 'Input Sanitization', 'Custom Errors'];
    if (lower.includes('owner') || lower.includes('admin') || lower.includes('role')) securityRequirements.push('AccessControl / Roles');
    if (lower.includes('pause') || lower.includes('emergency')) securityRequirements.push('Pausable Circuit Breakers');
    if (lower.includes('permit') || lower.includes('eip-2612') || lower.includes('signature')) securityRequirements.push('EIP-2612 Gasless Permit / ECDSA');
    if (lower.includes('timelock')) securityRequirements.push('Timelocked Operations');

    // Upgradeability
    const upgradeability = lower.includes('upgradeable') || lower.includes('proxy') || lower.includes('uups') || lower.includes('transparent');

    // Calculate confidence score
    let confidenceScore = 95;
    const clarificationQuestions: string[] = [];

    if (prompt.trim().length < 15) {
      confidenceScore = 50;
      clarificationQuestions.push('What specific asset or mechanism should this contract manage?');
      clarificationQuestions.push('Do you need role-based access control or multi-signature administration?');
    }

    return {
      businessGoal: prompt.slice(0, 120),
      projectType: contractType,
      contractType,
      blockchain,
      language,
      framework,
      compiler: language === 'solidity' ? '^0.8.20' : 'latest',
      standards: [contractType.split(' ')[0]],
      actors: ['Owner', 'User', 'Admin'],
      assets: ['Native Currency / Tokens'],
      dependencies: ['@openzeppelin/contracts'],
      upgradeability,
      securityRequirements,
      testingRequirements: ['Unit Tests', 'Security Reversion Edge Case Tests'],
      deploymentRequirements: ['Deterministic Factory Deployment', 'Verification on Block Explorer'],
      complexity: prompt.length > 300 ? 'Enterprise' : prompt.length > 100 ? 'High' : 'Medium',
      confidenceScore,
      clarificationQuestions: confidenceScore < 70 ? clarificationQuestions : undefined,
    };
  }
}
