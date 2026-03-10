import { createNetwork, STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';

export type NetworkName = 'mainnet' | 'testnet' | 'devnet';

export interface NetworkConfig {
  name: NetworkName;
  network: any;
  apiUrl: string;
  explorerUrl: string;
  bitcoinExplorerUrl: string;
}

const networks: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    network: createNetwork(STACKS_MAINNET, 'https://api.mainnet.hiro.so'),
    apiUrl: 'https://api.mainnet.hiro.so',
    explorerUrl: 'https://explorer.stacks.co',
    bitcoinExplorerUrl: 'https://blockstream.info',
  },
  testnet: {
    name: 'testnet',
    network: createNetwork(STACKS_TESTNET, 'https://api.testnet.hiro.so'),
    apiUrl: 'https://api.testnet.hiro.so',
    explorerUrl: 'https://explorer.stacks.co/?chain=testnet',
    bitcoinExplorerUrl: 'https://blockstream.info/testnet',
  },
  devnet: {
    name: 'devnet',
    network: createNetwork(STACKS_TESTNET, 'http://localhost:3999'),
    apiUrl: 'http://localhost:3999',
    explorerUrl: 'http://localhost:3000',
    bitcoinExplorerUrl: 'https://blockstream.info/testnet',
  },
};

export function getNetworkConfig(networkName: NetworkName): NetworkConfig {
  return networks[networkName];
}

export function getCurrentNetwork(): NetworkConfig {
  const networkName = (process.env.STACKS_NETWORK as NetworkName) || 'testnet';
  return getNetworkConfig(networkName);
}
