import { getCurrentNetwork, NetworkConfig } from './network.js';

/**
 * Wallet connection state
 */
export interface WalletState {
  connected: boolean;
  address?: string;
  pubKey?: string;
  network?: string;
}

/**
 * Validate a Stacks address format
 * Supports mainnet (SP/SM) and testnet (ST/SN) addresses
 */
export function validateStacksAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const pattern = /^(SP|SM|ST|SN)[A-HJ-NP-Za-km-z1-9]{38,50}$/;
  return pattern.test(address.trim());
}

/**
 * Detect network from Stacks address prefix
 */
export function detectNetworkFromAddress(address: string): 'mainnet' | 'testnet' | null {
  if (address.startsWith('SP') || address.startsWith('SM')) return 'mainnet';
  if (address.startsWith('ST') || address.startsWith('SN')) return 'testnet';
  return null;
}

/**
 * Wallet connection manager
 * Handles wallet state for a user session
 */
export class WalletManager {
  private state: WalletState = { connected: false };
  private networkConfig: NetworkConfig;

  constructor(network?: NetworkConfig) {
    this.networkConfig = network || getCurrentNetwork();
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
  setConnected(address: string, pubKey?: string): void {
    this.state = {
      connected: true,
      address,
      pubKey,
      network: this.networkConfig.name,
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
   * Get network config
   */
  getNetwork(): NetworkConfig {
    return this.networkConfig;
  }
}

/**
 * Create default wallet manager instance
 */
export function createWalletManager(network?: NetworkConfig): WalletManager {
  return new WalletManager(network);
}
