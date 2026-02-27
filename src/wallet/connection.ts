import { connect, Wallet, TransactionSigner, StacksTransaction } from '@stacks/connect';
import { getCurrentNetwork, NetworkConfig } from './network.js';

/**
 * Wallet connection options
 */
export interface WalletConnectionOptions {
  appDomain: string;
  appName: string;
  network?: NetworkConfig;
}

/**
 * Wallet connection state
 */
export interface WalletState {
  connected: boolean;
  address?: string;
  pubKey?: string;
  walletName?: string;
}

/**
 * Default options for wallet connection
 */
const defaultOptions: WalletConnectionOptions = {
  appDomain: 'https://bitcoin-yield.com',
  appName: 'Bitcoin Yield Copilot',
};

/**
 * Create wallet authentication request
 * This generates the URL that users will scan with Leather Wallet
 */
export function createWalletAuthRequest(
  options: Partial<WalletConnectionOptions> = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const network = opts.network || getCurrentNetwork();

  // Generate auth request - returns URL for wallet connection
  const authRequest = connect({
    appDetails: {
      name: opts.appName,
      icon: `${opts.appDomain}/icon.png`,
    },
    network: network.network,
    // Callback URL after wallet authentication
    redirectTo: `${opts.appDomain}/auth/callback`,
  });

  return authRequest.generateAuthRequest();
}

/**
 * Get wallet address from auth response
 */
export function getWalletAddressFromAuth(authResponse: string): string | null {
  try {
    // Decode auth response to get wallet address
    // The response is a JWT that contains the address
    const decoded = JSON.parse(atob(authResponse.split('.')[1]));
    return decoded.payload?.address || null;
  } catch {
    return null;
  }
}

/**
 * Wallet connection manager
 * Handles authentication state and transaction signing
 */
export class WalletManager {
  private state: WalletState = { connected: false };
  private network: NetworkConfig;

  constructor(network?: NetworkConfig) {
    this.network = network || getCurrentNetwork();
  }

  /**
   * Get current connection state
   */
  getState(): WalletState {
    return { ...this.state };
  }

  /**
   * Set connected state with wallet info
   */
  setConnected(address: string, pubKey?: string, walletName?: string): void {
    this.state = {
      connected: true,
      address,
      pubKey,
      walletName,
    };
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.state = { connected: false };
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * Get connected wallet address
   */
  getAddress(): string | undefined {
    return this.state.address;
  }

  /**
   * Sign a transaction with connected wallet
   * Returns unsigned transaction that will be signed by Leather
   */
  async signTransaction(tx: StacksTransaction): Promise<StacksTransaction> {
    if (!this.state.connected || !this.state.pubKey) {
      throw new Error('Wallet not connected');
    }

    // For Leather wallet, transactions are signed via the wallet popup
    // This returns the transaction ready for broadcast after user signs
    return tx;
  }

  /**
   * Generate authentication URL for wallet connection
   */
  generateAuthUrl(appDomain: string, appName: string): string {
    return createWalletAuthRequest({
      appDomain,
      appName,
      network: this.network,
    });
  }
}

/**
 * Create default wallet manager instance
 */
export function createWalletManager(network?: NetworkConfig): WalletManager {
  return new WalletManager(network);
}
