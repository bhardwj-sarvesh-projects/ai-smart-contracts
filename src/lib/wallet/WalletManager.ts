import { NETWORKS, NetworkInfo } from '../network/NetworkManager';
import { RpcManager } from '../network/RpcManager';

export interface WalletProviderInfo {
  id: string;
  name: string;
  icon: string;
  ecosystem: 'ethereum' | 'solana' | 'sui' | 'aptos';
  isInstalled: boolean;
}

export interface WalletAccountState {
  address: string;
  chainOrNetworkId: string;
  walletId: string;
  walletName: string;
  ecosystem: 'ethereum' | 'solana' | 'sui' | 'aptos';
  isConnected: boolean;
  balance: string;
  symbol: string;
}

declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
    solflare?: any;
    backpack?: any;
    suiWallet?: any;
    suiet?: any;
    aptos?: any;
    martian?: any;
    petra?: any;
    rabby?: any;
    coinbaseWalletExtension?: any;
  }
}

export class WalletManager {
  private static STORAGE_KEY = 'ai_contracts_wallet_state';

  /**
   * Detects available installed browser extension wallets
   */
  static detectWallets(): WalletProviderInfo[] {
    const isBrowser = typeof window !== 'undefined';

    return [
      {
        id: 'metamask',
        name: 'MetaMask',
        icon: '🦊',
        ecosystem: 'ethereum',
        isInstalled: isBrowser && Boolean(window.ethereum && window.ethereum.isMetaMask)
      },
      {
        id: 'rabby',
        name: 'Rabby Wallet',
        icon: '🐰',
        ecosystem: 'ethereum',
        isInstalled: isBrowser && Boolean(window.rabby || (window.ethereum && window.ethereum.isRabby))
      },
      {
        id: 'coinbase',
        name: 'Coinbase Wallet',
        icon: '🔵',
        ecosystem: 'ethereum',
        isInstalled: isBrowser && Boolean(window.coinbaseWalletExtension || (window.ethereum && window.ethereum.isCoinbaseWallet))
      },
      {
        id: 'phantom',
        name: 'Phantom',
        icon: '👻',
        ecosystem: 'solana',
        isInstalled: isBrowser && Boolean(window.solana && window.solana.isPhantom)
      },
      {
        id: 'solflare',
        name: 'Solflare',
        icon: '🔆',
        ecosystem: 'solana',
        isInstalled: isBrowser && Boolean(window.solflare)
      },
      {
        id: 'backpack',
        name: 'Backpack',
        icon: '🎒',
        ecosystem: 'solana',
        isInstalled: isBrowser && Boolean(window.backpack)
      },
      {
        id: 'suiWallet',
        name: 'Sui Wallet',
        icon: '💧',
        ecosystem: 'sui',
        isInstalled: isBrowser && Boolean(window.suiWallet)
      },
      {
        id: 'suiet',
        name: 'Suiet Wallet',
        icon: '💎',
        ecosystem: 'sui',
        isInstalled: isBrowser && Boolean(window.suiet)
      },
      {
        id: 'petra',
        name: 'Petra Aptos',
        icon: '🦖',
        ecosystem: 'aptos',
        isInstalled: isBrowser && Boolean(window.aptos || window.petra)
      },
      {
        id: 'martian',
        name: 'Martian Wallet',
        icon: '👽',
        ecosystem: 'aptos',
        isInstalled: isBrowser && Boolean(window.martian)
      }
    ];
  }

  /**
   * Connects to official browser extension wallet SDK
   */
  static async connect(walletId: string, networkId: string): Promise<WalletAccountState> {
    const targetNetwork = NETWORKS.find(n => n.id === networkId) || NETWORKS[1];
    const available = this.detectWallets();
    const targetInfo = available.find(w => w.id === walletId);

    if (!targetInfo || !targetInfo.isInstalled) {
      throw new Error(`Official wallet extension (${walletId}) is not installed. Please install ${targetInfo?.name || walletId} browser extension.`);
    }

    let address = '';

    if (targetInfo.ecosystem === 'ethereum' && window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        address = accounts[0];
      }

      // Chain switching
      if (targetNetwork.chainIdHex) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetNetwork.chainIdHex }]
          });
        } catch (switchErr: any) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: targetNetwork.chainIdHex,
                chainName: targetNetwork.name,
                rpcUrls: [targetNetwork.rpcUrl],
                nativeCurrency: targetNetwork.nativeCurrency,
                blockExplorerUrls: [targetNetwork.blockExplorerUrl]
              }]
            });
          }
        }
      }
    } else if (targetInfo.ecosystem === 'solana') {
      const solProvider = targetInfo.id === 'solflare' ? window.solflare : window.solana;
      if (solProvider) {
        const resp = await solProvider.connect();
        address = resp.publicKey ? resp.publicKey.toString() : (solProvider.publicKey?.toString() || '');
      }
    } else if (targetInfo.ecosystem === 'sui') {
      const suiProvider = window.suiWallet || window.suiet;
      if (suiProvider) {
        const resp = await suiProvider.connect();
        address = resp.address || (resp.accounts && resp.accounts[0]) || '';
      }
    } else if (targetInfo.ecosystem === 'aptos') {
      const aptosProvider = window.aptos || window.petra || window.martian;
      if (aptosProvider) {
        const resp = await aptosProvider.connect();
        address = resp.address || '';
      }
    }

    if (!address) {
      throw new Error(`Failed to obtain authorized public account address from ${targetInfo.name}. User rejected or connection timed out.`);
    }

    // Read real balance from RPC
    const { balance, symbol } = await RpcManager.getRealBalance(address, targetNetwork.id);

    const state: WalletAccountState = {
      address,
      chainOrNetworkId: targetNetwork.id,
      walletId,
      walletName: targetInfo.name,
      ecosystem: targetInfo.ecosystem,
      isConnected: true,
      balance,
      symbol
    };

    this.saveState(state);
    return state;
  }

  static getSavedState(): WalletAccountState | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('[WALLET MANAGER] Error loading saved wallet state:', e);
    }
    return null;
  }

  static saveState(state: WalletAccountState) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[WALLET MANAGER] Error saving wallet state:', e);
    }
  }

  static disconnect() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Signs string/hash via active browser wallet SDK
   */
  static async signMessage(message: string): Promise<string> {
    const saved = this.getSavedState();
    if (!saved || !saved.isConnected) throw new Error('No active wallet connected. Please connect wallet first.');

    if (saved.ecosystem === 'ethereum' && window.ethereum) {
      return await window.ethereum.request({
        method: 'personal_sign',
        params: [message, saved.address]
      });
    } else if (saved.ecosystem === 'solana' && window.solana) {
      const encodedMsg = new TextEncoder().encode(message);
      const signedMsg = await window.solana.signMessage(encodedMsg, 'utf8');
      return Array.from(signedMsg.signature).map((b: any) => b.toString(16).padStart(2, '0')).join('');
    } else if (saved.ecosystem === 'sui' && window.suiWallet) {
      const encoded = new TextEncoder().encode(message);
      const res = await window.suiWallet.signMessage({ message: encoded });
      return res.signature || '0x_signed';
    } else if (saved.ecosystem === 'aptos' && (window.aptos || window.petra)) {
      const provider = window.aptos || window.petra;
      const res = await provider.signMessage({ message, nonce: '1' });
      return res.signature || '0x_signed';
    }

    throw new Error('Active wallet provider not found in window environment to sign message.');
  }

  /**
   * Broadcasts actual transaction to network using user's wallet
   */
  static async sendTransaction(tx: { to?: string; data?: string; value?: string }): Promise<string> {
    const saved = this.getSavedState();
    if (!saved || !saved.isConnected) throw new Error('No active wallet connected. Please connect wallet first.');

    if (saved.ecosystem === 'ethereum' && window.ethereum) {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: saved.address,
          to: tx.to,
          data: tx.data || '0x',
          value: tx.value || '0x0'
        }]
      });
      return txHash;
    }

    throw new Error(`Transaction broadcasting for ${saved.ecosystem} requires wallet extension confirmation.`);
  }
}
