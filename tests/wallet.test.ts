import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNetworkConfig, getCurrentNetwork } from '../src/bot/wallet/network.ts';

describe('Wallet Network', () => {
  describe('getNetworkConfig', () => {
    it('should return testnet config', () => {
      const config = getNetworkConfig('testnet');
      expect(config.name).toBe('testnet');
      expect(config.apiUrl).toBe('https://api.testnet.hiro.so');
    });

    it('should return mainnet config', () => {
      const config = getNetworkConfig('mainnet');
      expect(config.name).toBe('mainnet');
      expect(config.apiUrl).toBe('https://api.mainnet.hiro.so');
    });

    it('should return devnet config', () => {
      const config = getNetworkConfig('devnet');
      expect(config.name).toBe('devnet');
      expect(config.apiUrl).toBe('http://localhost:3999');
    });
  });

  describe('getCurrentNetwork', () => {
    it('should return testnet by default', () => {
      delete process.env.STACKS_NETWORK;
      const config = getCurrentNetwork();
      expect(config.name).toBe('testnet');
    });

    it('should return network from env', () => {
      process.env.STACKS_NETWORK = 'mainnet';
      const config = getCurrentNetwork();
      expect(config.name).toBe('mainnet');
      delete process.env.STACKS_NETWORK;
    });
  });
});
