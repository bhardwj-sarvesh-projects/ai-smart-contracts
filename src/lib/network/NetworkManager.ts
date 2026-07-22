export interface NetworkInfo {
  id: string;
  name: string;
  blockchain: 'ethereum' | 'solana' | 'sui' | 'aptos' | string;
  isTestnet: boolean;
  chainIdHex?: string;
  chainIdDec?: number;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrl: string;
}

export const NETWORKS: NetworkInfo[] = [
  // Ethereum & EVM Networks
  {
    id: 'ethereum-mainnet',
    name: 'Ethereum Mainnet',
    blockchain: 'ethereum',
    isTestnet: false,
    chainIdHex: '0x1',
    chainIdDec: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://etherscan.io'
  },
  {
    id: 'ethereum-sepolia',
    name: 'Ethereum Sepolia',
    blockchain: 'ethereum',
    isTestnet: true,
    chainIdHex: '0xaa36a7',
    chainIdDec: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://sepolia.etherscan.io'
  },
  {
    id: 'ethereum-holesky',
    name: 'Ethereum Holesky',
    blockchain: 'ethereum',
    isTestnet: true,
    chainIdHex: '0x4268',
    chainIdDec: 17000,
    rpcUrl: 'https://ethereum-holesky-rpc.publicnode.com',
    nativeCurrency: { name: 'Holesky Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://holesky.etherscan.io'
  },

  // Polygon
  {
    id: 'polygon-mainnet',
    name: 'Polygon PoS Mainnet',
    blockchain: 'ethereum',
    isTestnet: false,
    chainIdHex: '0x89',
    chainIdDec: 137,
    rpcUrl: 'https://polygon-rpc.com',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    blockExplorerUrl: 'https://polygonscan.com'
  },
  {
    id: 'polygon-amoy',
    name: 'Polygon Amoy Testnet',
    blockchain: 'ethereum',
    isTestnet: true,
    chainIdHex: '0x13882',
    chainIdDec: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    blockExplorerUrl: 'https://amoy.polygonscan.com'
  },

  // Arbitrum
  {
    id: 'arbitrum-one',
    name: 'Arbitrum One',
    blockchain: 'ethereum',
    isTestnet: false,
    chainIdHex: '0xa4b1',
    chainIdDec: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://arbiscan.io'
  },
  {
    id: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    blockchain: 'ethereum',
    isTestnet: true,
    chainIdHex: '0x66eee',
    chainIdDec: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://sepolia.arbiscan.io'
  },

  // Optimism
  {
    id: 'optimism-mainnet',
    name: 'OP Mainnet',
    blockchain: 'ethereum',
    isTestnet: false,
    chainIdHex: '0xa',
    chainIdDec: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://optimistic.etherscan.io'
  },
  {
    id: 'optimism-sepolia',
    name: 'OP Sepolia Testnet',
    blockchain: 'ethereum',
    isTestnet: true,
    chainIdHex: '0xaa37dc',
    chainIdDec: 11155420,
    rpcUrl: 'https://sepolia.optimism.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://sepolia-optimism.etherscan.io'
  },

  // Base
  {
    id: 'base-mainnet',
    name: 'Base Mainnet',
    blockchain: 'ethereum',
    isTestnet: false,
    chainIdHex: '0x2105',
    chainIdDec: 8453,
    rpcUrl: 'https://mainnet.base.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://basescan.org'
  },
  {
    id: 'base-sepolia',
    name: 'Base Sepolia Testnet',
    blockchain: 'ethereum',
    isTestnet: true,
    chainIdHex: '0x14a34',
    chainIdDec: 84532,
    rpcUrl: 'https://sepolia.base.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrl: 'https://sepolia.basescan.org'
  },

  // BNB Chain
  {
    id: 'bsc-mainnet',
    name: 'BNB Smart Chain Mainnet',
    blockchain: 'ethereum',
    isTestnet: false,
    chainIdHex: '0x38',
    chainIdDec: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    blockExplorerUrl: 'https://bscscan.com'
  },
  {
    id: 'bsc-testnet',
    name: 'BNB Smart Chain Testnet',
    blockchain: 'ethereum',
    isTestnet: true,
    chainIdHex: '0x61',
    chainIdDec: 97,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    blockExplorerUrl: 'https://testnet.bscscan.com'
  },

  // Avalanche
  {
    id: 'avalanche-cchain',
    name: 'Avalanche C-Chain',
    blockchain: 'ethereum',
    isTestnet: false,
    chainIdHex: '0xa86a',
    chainIdDec: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    blockExplorerUrl: 'https://snowtrace.io'
  },
  {
    id: 'avalanche-fuji',
    name: 'Avalanche Fuji Testnet',
    blockchain: 'ethereum',
    isTestnet: true,
    chainIdHex: '0xa869',
    chainIdDec: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    blockExplorerUrl: 'https://testnet.snowtrace.io'
  },

  // Solana
  {
    id: 'solana-mainnet',
    name: 'Solana Mainnet-Beta',
    blockchain: 'solana',
    isTestnet: false,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
    blockExplorerUrl: 'https://explorer.solana.com'
  },
  {
    id: 'solana-devnet',
    name: 'Solana Devnet',
    blockchain: 'solana',
    isTestnet: true,
    rpcUrl: 'https://api.devnet.solana.com',
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
    blockExplorerUrl: 'https://explorer.solana.com?cluster=devnet'
  },
  {
    id: 'solana-testnet',
    name: 'Solana Testnet',
    blockchain: 'solana',
    isTestnet: true,
    rpcUrl: 'https://api.testnet.solana.com',
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
    blockExplorerUrl: 'https://explorer.solana.com?cluster=testnet'
  },

  // Sui
  {
    id: 'sui-mainnet',
    name: 'Sui Mainnet',
    blockchain: 'sui',
    isTestnet: false,
    rpcUrl: 'https://fullnode.mainnet.sui.io:443',
    nativeCurrency: { name: 'Sui', symbol: 'SUI', decimals: 9 },
    blockExplorerUrl: 'https://suiscan.xyz/mainnet'
  },
  {
    id: 'sui-testnet',
    name: 'Sui Testnet',
    blockchain: 'sui',
    isTestnet: true,
    rpcUrl: 'https://fullnode.testnet.sui.io:443',
    nativeCurrency: { name: 'Sui', symbol: 'SUI', decimals: 9 },
    blockExplorerUrl: 'https://suiscan.xyz/testnet'
  },
  {
    id: 'sui-devnet',
    name: 'Sui Devnet',
    blockchain: 'sui',
    isTestnet: true,
    rpcUrl: 'https://fullnode.devnet.sui.io:443',
    nativeCurrency: { name: 'Sui', symbol: 'SUI', decimals: 9 },
    blockExplorerUrl: 'https://suiscan.xyz/devnet'
  },

  // Aptos
  {
    id: 'aptos-mainnet',
    name: 'Aptos Mainnet',
    blockchain: 'aptos',
    isTestnet: false,
    rpcUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
    nativeCurrency: { name: 'Aptos Coin', symbol: 'APT', decimals: 8 },
    blockExplorerUrl: 'https://explorer.aptoslabs.com/?network=mainnet'
  },
  {
    id: 'aptos-testnet',
    name: 'Aptos Testnet',
    blockchain: 'aptos',
    isTestnet: true,
    rpcUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
    nativeCurrency: { name: 'Aptos Coin', symbol: 'APT', decimals: 8 },
    blockExplorerUrl: 'https://explorer.aptoslabs.com/?network=testnet'
  },
  {
    id: 'aptos-devnet',
    name: 'Aptos Devnet',
    blockchain: 'aptos',
    isTestnet: true,
    rpcUrl: 'https://fullnode.devnet.aptoslabs.com/v1',
    nativeCurrency: { name: 'Aptos Coin', symbol: 'APT', decimals: 8 },
    blockExplorerUrl: 'https://explorer.aptoslabs.com/?network=devnet'
  }
];

export class NetworkManager {
  static getAllNetworks(): NetworkInfo[] {
    return NETWORKS;
  }

  static getNetworksByBlockchain(blockchain: string): NetworkInfo[] {
    const normalized = blockchain.toLowerCase();
    return NETWORKS.filter(n => n.blockchain === normalized || (normalized === 'ethereum' && n.blockchain === 'ethereum'));
  }

  static getNetworkById(id: string): NetworkInfo | undefined {
    return NETWORKS.find(n => n.id === id);
  }

  static getExplorerTxUrl(networkId: string, txHash: string): string {
    const net = this.getNetworkById(networkId) || NETWORKS[1]; // default Sepolia
    return `${net.blockExplorerUrl}/tx/${txHash}`;
  }

  static getExplorerAddressUrl(networkId: string, address: string): string {
    const net = this.getNetworkById(networkId) || NETWORKS[1];
    return `${net.blockExplorerUrl}/address/${address}`;
  }
}
