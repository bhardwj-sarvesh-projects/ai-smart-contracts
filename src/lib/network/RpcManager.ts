import { NETWORKS, NetworkInfo } from './NetworkManager';
import { ethers } from 'ethers';

export interface RpcEndpoint {
  url: string;
  latencyMs?: number;
  isHealthy: boolean;
  lastChecked?: number;
}

export class RpcManager {
  private static endpointsMap: Map<string, RpcEndpoint[]> = new Map();

  // Initialize RPC endpoints pool per network ID
  private static initEndpoints() {
    if (this.endpointsMap.size > 0) return;

    // Multi-RPC endpoints for failover & latency check
    const rpcPools: Record<string, string[]> = {
      'ethereum-mainnet': [
        'https://eth.llamarpc.com',
        'https://rpc.ankr.com/eth',
        'https://cloudflare-eth.com',
        'https://ethereum-rpc.publicnode.com'
      ],
      'ethereum-sepolia': [
        'https://rpc.sepolia.org',
        'https://ethereum-sepolia-rpc.publicnode.com',
        'https://rpc2.sepolia.org',
        'https://gateway.tenderly.co/public/sepolia'
      ],
      'ethereum-holesky': [
        'https://ethereum-holesky-rpc.publicnode.com',
        'https://rpc.holesky.ethpandaops.io',
        'https://holesky.drpc.org'
      ],
      'polygon-mainnet': [
        'https://polygon-rpc.com',
        'https://rpc.ankr.com/polygon',
        'https://polygon-bor-rpc.publicnode.com'
      ],
      'polygon-amoy': [
        'https://rpc-amoy.polygon.technology',
        'https://polygon-amoy-bor-rpc.publicnode.com'
      ],
      'arbitrum-one': [
        'https://arb1.arbitrum.io/rpc',
        'https://arbitrum-one-rpc.publicnode.com',
        'https://rpc.ankr.com/arbitrum'
      ],
      'arbitrum-sepolia': [
        'https://sepolia-rollup.arbitrum.io/rpc',
        'https://arbitrum-sepolia-rpc.publicnode.com'
      ],
      'optimism-mainnet': [
        'https://mainnet.optimism.io',
        'https://optimism-rpc.publicnode.com'
      ],
      'optimism-sepolia': [
        'https://sepolia.optimism.io',
        'https://optimism-sepolia-rpc.publicnode.com'
      ],
      'base-mainnet': [
        'https://mainnet.base.org',
        'https://base-rpc.publicnode.com'
      ],
      'base-sepolia': [
        'https://sepolia.base.org',
        'https://base-sepolia-rpc.publicnode.com'
      ],
      'bsc-mainnet': [
        'https://bsc-dataseed.binance.org',
        'https://bsc-rpc.publicnode.com'
      ],
      'bsc-testnet': [
        'https://data-seed-prebsc-1-s1.binance.org:8545',
        'https://bsc-testnet-rpc.publicnode.com'
      ],
      'avalanche-cchain': [
        'https://api.avax.network/ext/bc/C/rpc',
        'https://avalanche-c-chain-rpc.publicnode.com'
      ],
      'avalanche-fuji': [
        'https://api.avax-test.network/ext/bc/C/rpc',
        'https://avalanche-fuji-c-chain-rpc.publicnode.com'
      ],
      'solana-mainnet': [
        'https://api.mainnet-beta.solana.com',
        'https://solana-rpc.publicnode.com'
      ],
      'solana-devnet': [
        'https://api.devnet.solana.com'
      ],
      'solana-testnet': [
        'https://api.testnet.solana.com'
      ],
      'sui-mainnet': [
        'https://fullnode.mainnet.sui.io:443'
      ],
      'sui-testnet': [
        'https://fullnode.testnet.sui.io:443'
      ],
      'sui-devnet': [
        'https://fullnode.devnet.sui.io:443'
      ],
      'aptos-mainnet': [
        'https://fullnode.mainnet.aptoslabs.com/v1'
      ],
      'aptos-testnet': [
        'https://fullnode.testnet.aptoslabs.com/v1'
      ],
      'aptos-devnet': [
        'https://fullnode.devnet.aptoslabs.com/v1'
      ]
    };

    NETWORKS.forEach(net => {
      const urls = rpcPools[net.id] || [net.rpcUrl];
      const endpoints: RpcEndpoint[] = urls.map(url => ({
        url,
        isHealthy: true
      }));
      this.endpointsMap.set(net.id, endpoints);
    });
  }

  /**
   * Measure latency & check endpoint health
   */
  static async checkEndpointHealth(url: string, isEVM: boolean = true): Promise<{ isHealthy: boolean; latencyMs: number }> {
    const start = performance.now();
    try {
      if (isEVM) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
        });
        const duration = Math.round(performance.now() - start);
        if (res.ok) {
          const json = await res.json();
          return { isHealthy: Boolean(json.result), latencyMs: duration };
        }
      } else {
        const res = await fetch(url, { method: 'GET' });
        const duration = Math.round(performance.now() - start);
        return { isHealthy: res.ok, latencyMs: duration };
      }
    } catch (e) {
      // Endpoint unreachable
    }
    return { isHealthy: false, latencyMs: 9999 };
  }

  /**
   * Get best healthy RPC endpoint for target network with automatic failover
   */
  static async getHealthyEndpoint(networkId: string): Promise<string> {
    this.initEndpoints();
    const endpoints = this.endpointsMap.get(networkId);
    const network = NETWORKS.find(n => n.id === networkId);

    if (!endpoints || endpoints.length === 0) {
      return network ? network.rpcUrl : 'https://rpc.sepolia.org';
    }

    const isEVM = !network || network.blockchain === 'ethereum';

    for (const ep of endpoints) {
      const health = await this.checkEndpointHealth(ep.url, isEVM);
      ep.isHealthy = health.isHealthy;
      ep.latencyMs = health.latencyMs;
      ep.lastChecked = Date.now();

      if (ep.isHealthy) {
        return ep.url;
      }
    }

    // Fallback to primary network default
    return network ? network.rpcUrl : 'https://rpc.sepolia.org';
  }

  /**
   * Real RPC balance fetching for EVM and Solana accounts
   */
  static async getRealBalance(address: string, networkId: string): Promise<{ balance: string; symbol: string }> {
    const network = NETWORKS.find(n => n.id === networkId) || NETWORKS[1];
    const symbol = network.nativeCurrency.symbol;

    try {
      const rpcUrl = await this.getHealthyEndpoint(networkId);

      if (network.blockchain === 'ethereum') {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const balWei = await provider.getBalance(address);
        const formatted = parseFloat(ethers.formatEther(balWei)).toFixed(4);
        return { balance: formatted, symbol };
      } else if (network.blockchain === 'solana') {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [address]
          })
        });
        const data = await res.json();
        if (data.result && typeof data.result.value === 'number') {
          const sol = (data.result.value / 1e9).toFixed(4);
          return { balance: sol, symbol };
        }
      }
    } catch (err) {
      console.warn(`[RPC MANAGER] Failed fetching real balance for ${address} on ${networkId}:`, err);
    }

    return { balance: '0.0000', symbol };
  }

  /**
   * Real gas estimation query on chain
   */
  static async estimateGas(networkId: string, from: string, data?: string): Promise<number> {
    const network = NETWORKS.find(n => n.id === networkId) || NETWORKS[1];
    if (network.blockchain !== 'ethereum') {
      return 250000;
    }

    try {
      const rpcUrl = await this.getHealthyEndpoint(networkId);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const est = await provider.estimateGas({
        from: from.startsWith('0x') ? from : undefined,
        data: data || '0x'
      });
      return Number(est);
    } catch (err) {
      console.warn(`[RPC MANAGER] Live gas estimation query returned default baseline:`, err);
      return 350000;
    }
  }
}
