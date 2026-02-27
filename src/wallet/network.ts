import { StacksTestnet, StacksMainnet, StacksDevnet } from '@stacks/network';

/**
 * Network configuration for Stacks blockchain
 * Supports mainnet, testnet, and devnet environments
 */
export type NetworkName = 'mainnet' | 'testnet' | 'devnet';

export interface NetworkConfig {
  name: NetworkName;
  network: StacksTestnet | StacksMainnet | StacksDevnet;
  apiUrl: string;
  explorerUrl: string;
  bitcoinExplorerUrl: string;
}

const networks: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    network: new StacksMainnet(),
    apiUrl: 'https://stacks-node-api.mainnet.alexlab.co',
    explorerUrl: 'https://explorer.stacks.co',
    bitcoinExplorerUrl: 'https://blockstream.info',
  },
  testnet: {
    name: 'testnet',
    network: new StacksTestnet({
      url: 'https://stacks-node-api.testnet.alexlab.co',
    }),
    apiUrl: 'https://stacks-node-api.testnet.alexlab.co',
    explorerUrl: 'https://explorer.stacks.co/?chain=testnet',
    bitcoinExplorerUrl: 'https://blockstream.info/testnet',
  },
  devnet: {
    name: 'devnet',
    network: new StacksDevnet({
      url: 'http://localhost:3999',
    }),
    apiUrl: 'http://localhost:3999',
    explorerUrl: 'http://localhost:3000',
    bitcoinExplorerUrl: 'https://blockstream.info/testnet',
  },
};

/**
 * Get network configuration by name
 */
export function getNetworkConfig(networkName: NetworkName): NetworkConfig {
  return networks[networkName];
}

/**
 * Get current network from environment
 */
export function getCurrentNetwork(): NetworkConfig {
  const networkName = (process.env.STACKS_NETWORK as NetworkName) || 'testnet';
  return getNetworkConfig(networkName);
}
