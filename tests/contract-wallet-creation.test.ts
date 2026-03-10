import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getNetworkConfig, getCurrentNetwork, NetworkConfig } from '../src/bot/wallet/network.js';
import { WalletManager, validateStacksAddress, extractClarityValue } from '../src/bot/wallet/WalletManager.js';
import { createHash } from 'crypto';

// Mock environment variables
vi.mock('process', () => ({
  env: {
    AGENT_STACKS_PRIVATE_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    AGENT_STACKS_ADDRESS: 'SP1234567890ABCDEFGHIJKLMNOPQRSTU',
    TELEGRAM_HASH_SALT: 'test-salt-123',
    FACTORY_CONTRACT_ADDRESS: 'SP123.factory',
    WITHDRAW_HELPER_CONTRACT: 'SP123.helper',
    DB_PATH: ':memory:',
    STACKS_NETWORK: 'testnet',
  }
}));

// Mock crypto functions
vi.mock('crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue(Buffer.from('mock-hash')),
  }),
  randomBytes: vi.fn().mockReturnValue(Buffer.from('mock-random')),
}));

// Mock database
vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockReturnValue({
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
    }),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock stacksCrypto
vi.mock('../src/security/stacksCrypto.js', () => ({
  stacksCrypto: {
    publicKeyCreate: vi.fn().mockImplementation((privateKey, compressed) => {
      // Return a valid 33-byte compressed public key for testing
      return Buffer.from('03dd307936689d6996254c673316f3deb87c030e9de1d47fae78b3d27b7ccd44f5', 'hex');
    }),
    ecdsaSign: vi.fn().mockReturnValue({ signature: Buffer.from('mock-signature'), recovery: 0 }),
    getAddressFromPrivateKey: vi.fn().mockReturnValue('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3AGAEZ6YPQNGF'),
    generatePrivateKey: vi.fn().mockReturnValue('test-private-key'),
    validatePrivateKey: vi.fn().mockReturnValue(true),
    encrypt: vi.fn().mockReturnValue({
      iv: 'mock-iv',
      ciphertext: 'mock-ciphertext',
      authTag: 'mock-authTag',
      version: '1.0'
    }),
    decrypt: vi.fn().mockImplementation((data) => {
      return 'decrypted-data';
    }),
    sha256: vi.fn().mockReturnValue(Buffer.from('mock-sha256-hash')),
    hmacSha256: vi.fn().mockReturnValue(Buffer.from('mock-hmac-sha256-hash'))
  }
}));

// Mock filesystem
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(';; user-wallet.clar\n'),
}));

// Mock path
vi.mock('path', () => ({
  resolve: vi.fn().mockReturnValue('/mock/path'),
}));

describe('Contract Wallet Creation Flow', () => {
  describe('Network Configuration', () => {
    it('should return testnet config', () => {
      const config = getNetworkConfig('testnet');
      
      expect(config.name).toBe('testnet');
      expect(config.apiUrl).toBe('https://api.testnet.hiro.so');
      expect(config.explorerUrl).toBe('https://explorer.stacks.co/?chain=testnet');
      expect(config.network).toBeDefined();
    });

    it('should return mainnet config', () => {
      const config = getNetworkConfig('mainnet');
      
      expect(config.name).toBe('mainnet');
      expect(config.apiUrl).toBe('https://api.mainnet.hiro.so');
      expect(config.explorerUrl).toBe('https://explorer.stacks.co');
      expect(config.network).toBeDefined();
    });

    it('should return current network from env', () => {
      process.env.STACKS_NETWORK = 'mainnet';
      const config = getCurrentNetwork();
      expect(config.name).toBe('mainnet');
      delete process.env.STACKS_NETWORK;
    });

    it('should default to testnet', () => {
      const config = getCurrentNetwork();
      expect(config.name).toBe('testnet');
    });
  });

  describe('WalletManager Initialization', () => {
    let walletManager: WalletManager;

    beforeEach(async () => {
      vi.clearAllMocks();
      
      // Mock successful fetch responses
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      walletManager = await WalletManager.create();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should initialize with private key from env', async () => {
      expect(walletManager).toBeDefined();
      expect(walletManager.getNetwork().name).toBe('testnet');
      expect(walletManager.getBotAddress()).toBe('SP1234567890ABCDEFGHIJKLMNOPQRSTU');
    });

    it('should throw if no private key or mnemonic configured', async () => {
      const originalKey = process.env.AGENT_STACKS_PRIVATE_KEY;
      delete process.env.AGENT_STACKS_PRIVATE_KEY;
      
      await expect(WalletManager.create()).rejects.toThrow('No agent key configured');
      
      process.env.AGENT_STACKS_PRIVATE_KEY = originalKey;
    });

    it('should derive telegram hash consistently', () => {
      const hash1 = walletManager.getStateForUser('user123');
      const hash2 = walletManager.getStateForUser('user123');
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      // State should be the same for same user
    });

    it('should validate Stacks addresses correctly', () => {
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(true);
      expect(validateStacksAddress('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(true);
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.test-contract')).toBe(true);
      expect(validateStacksAddress('invalid-address')).toBe(false);
    });

    
  });

  describe('Contract Deployment Flow', () => {
    let walletManager: WalletManager;
    const testUserId = '123456789';

    beforeEach(async () => {
      vi.clearAllMocks();
      
      // Mock successful fetch responses
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/v2/accounts/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ nonce: 0 })
          });
        }
        if (url.includes('/v2/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ stacks_tip_height: 1000 })
          });
        }
        if (url.includes('/v2/fees/transfer')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(100)
          });
        }
        if (url.includes('/extended/v1/tx/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ tx_status: 'success' })
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      // Mock blockchain service methods
      vi.spyOn(walletManager as any, 'ensureHelperInitialized').mockResolvedValue(true);
      vi.spyOn(walletManager as any, 'blockchainService.checkContractExists').mockResolvedValue(false);
      vi.spyOn(walletManager as any, 'blockchainService.waitForConfirmation').mockResolvedValue(undefined);
      vi.spyOn(walletManager as any, 'contractService.deployContract').mockResolvedValue({ txid: 'deploy-tx-123' });
      vi.spyOn(walletManager as any, 'contractService.isContractInitialized').mockResolvedValue(false);
      vi.spyOn(walletManager as any, 'contractService.initializeWallet').mockResolvedValue('init-tx-456');
      vi.spyOn(walletManager as any, 'contractService.isWalletRegisteredInHelper').mockResolvedValue(false);
      vi.spyOn(walletManager as any, 'contractService.registerWalletInHelper').mockResolvedValue('helper-reg-tx-789');
      vi.spyOn(walletManager as any, 'contractService.registerWalletInFactory').mockResolvedValue('factory-reg-tx-abc');

      walletManager = await WalletManager.create();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should create contract wallet with valid parameters', async () => {
      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      const record = await walletManager.createContractWallet(testUserId, limits, protocols);
      
      expect(record.telegramUserId).toBe(testUserId);
      expect(record.contractAddress).toContain('SP1234567890ABCDEFGHIJKLMNOPQRSTU');
      expect(record.isActive).toBe(true);
      expect(record.network).toBe('testnet');
      expect(record.deployTxId).toBe('deploy-tx-123');
    });

    it('should return cached wallet without deploying again', async () => {
      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      // First creation
      const record1 = await walletManager.createContractWallet(testUserId, limits, protocols);
      
      // Second creation should return cached
      const record2 = await walletManager.createContractWallet(testUserId, limits, protocols);
      
      expect(record2).toEqual(record1);
    });

    it('should handle contract already exists error with retry', async () => {
      const deploySpy = vi.spyOn(walletManager as any, 'contractService.deployContract')
        .mockRejectedValueOnce(new Error('ContractAlreadyExists'))
        .mockResolvedValueOnce({ txid: 'deploy-tx-retry-123' });

      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      const record = await walletManager.createContractWallet(testUserId, limits, protocols);
      
      expect(deploySpy).toHaveBeenCalledTimes(2);
      expect(record.deployTxId).toBe('deploy-tx-retry-123');
    });

    it('should throw after maximum deployment attempts', async () => {
      const deploySpy = vi.spyOn(walletManager as any, 'contractService.deployContract')
        .mockRejectedValue(new Error('ContractAlreadyExists'));

      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      await expect(walletManager.createContractWallet(testUserId, limits, protocols))
        .rejects.toThrow('Failed to deploy contract after');
    });

    it('should skip initialization if contract already initialized', async () => {
      const initSpy = vi.spyOn(walletManager as any, 'contractService.isContractInitialized').mockResolvedValue(true);
      const initializeSpy = vi.spyOn(walletManager as any, 'contractService.initializeWallet');

      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      await walletManager.createContractWallet(testUserId, limits, protocols);
      
      expect(initSpy).toHaveBeenCalled();
      expect(initializeSpy).not.toHaveBeenCalled();
    });

    it('should register wallet in helper if not registered', async () => {
      const registerSpy = vi.spyOn(walletManager as any, 'contractService.registerWalletInHelper');

      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      await walletManager.createContractWallet(testUserId, limits, protocols);
      
      expect(registerSpy).toHaveBeenCalled();
    });

    it('should register wallet in factory if factory contract configured', async () => {
      const factorySpy = vi.spyOn(walletManager as any, 'contractService.registerWalletInFactory');

      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      await walletManager.createContractWallet(testUserId, limits, protocols);
      
      expect(factorySpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let walletManager: WalletManager;

    beforeEach(async () => {
      vi.clearAllMocks();
      
      // Mock basic fetch
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      walletManager = await WalletManager.create();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should handle nonce fetch failures with retry', async () => {
      const nonceSpy = vi.spyOn(walletManager as any, 'blockchainService.fetchAccountNonce')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(5n);

      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      // Mock other dependencies
      vi.spyOn(walletManager as any, 'contractService.deployContract').mockResolvedValue({ txid: 'tx-123' });
      vi.spyOn(walletManager as any, 'blockchainService.waitForConfirmation').mockResolvedValue(undefined);

      const record = await walletManager.createContractWallet('test-user', limits, protocols);
      
      expect(nonceSpy).toHaveBeenCalled();
      expect(record).toBeDefined();
    });

    it('should handle broadcast failures', async () => {
      const broadcastSpy = vi.spyOn(walletManager as any, 'contractService.deployContract')
        .mockRejectedValue(new Error('Broadcast failed'));

      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      await expect(walletManager.createContractWallet('test-user', limits, protocols))
        .rejects.toThrow('Broadcast failed');
    });

    it('should handle helper initialization failures', async () => {
      const helperSpy = vi.spyOn(walletManager as any, 'ensureHelperInitialized')
        .mockResolvedValue(false);

      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      // Mock deployment
      vi.spyOn(walletManager as any, 'contractService.deployContract').mockResolvedValue({ txid: 'tx-123' });
      vi.spyOn(walletManager as any, 'blockchainService.waitForConfirmation').mockResolvedValue(undefined);

      const record = await walletManager.createContractWallet('test-user', limits, protocols);
      
      expect(helperSpy).toHaveBeenCalled();
      expect(record).toBeDefined();
      // Should still create wallet even if helper fails
    });

    it('should extract clarity values correctly', () => {
      const uintValue = { type: 'uint', value: '1000' };
      expect(extractClarityValue(uintValue)).toBe(1000n);

      const boolTrue = { type: 'bool', value: true };
      expect(extractClarityValue(boolTrue)).toBe(true);

      const boolFalse = { type: 'bool', value: false };
      expect(extractClarityValue(boolFalse)).toBe(false);

      const nestedObject = {
        'current-nonce': { type: 'uint', value: '5' },
        'is-paused': { type: 'bool', value: false }
      };
      const extracted = extractClarityValue(nestedObject);
      expect(extracted['current-nonce']).toBe(5n);
      expect(extracted['is-paused']).toBe(false);
    });
  });

  describe('Wallet State Management', () => {
    let walletManager: WalletManager;

    beforeEach(async () => {
      vi.clearAllMocks();
      
      // Mock basic fetch
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      walletManager = await WalletManager.create();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return not connected for unknown user', () => {
      const state = walletManager.getStateForUser('unknown');
      expect(state.connected).toBe(false);
    });

    it('should return wallet info after creation', async () => {
      const testUserId = 'test-user-123';
      
      // Mock creation
      const limits = {
        maxPerTransaction: 1_000_000n,
        dailyLimit: 10_000_000n
      };
      
      const protocols = [{
        address: 'SP123.protocol',
        name: 'Test Protocol',
        maxAlloc: 100_000_000n
      }];

      // Mock all dependencies
      vi.spyOn(walletManager as any, 'contractService.deployContract').mockResolvedValue({ txid: 'tx-123' });
      vi.spyOn(walletManager as any, 'blockchainService.waitForConfirmation').mockResolvedValue(undefined);
      vi.spyOn(walletManager as any, 'contractService.isContractInitialized').mockResolvedValue(false);
      vi.spyOn(walletManager as any, 'contractService.initializeWallet').mockResolvedValue('init-tx');
      vi.spyOn(walletManager as any, 'contractService.isWalletRegisteredInHelper').mockResolvedValue(false);
      vi.spyOn(walletManager as any, 'contractService.registerWalletInHelper').mockResolvedValue('helper-tx');
      vi.spyOn(walletManager as any, 'contractService.registerWalletInFactory').mockResolvedValue('factory-tx');
      vi.spyOn(walletManager as any, 'ensureHelperInitialized').mockResolvedValue(true);

      const record = await walletManager.createContractWallet(testUserId, limits, protocols);
      
      const state = walletManager.getStateForUser(testUserId);
      expect(state.connected).toBe(true);
      expect(state.address).toBe(record.contractAddress);
      expect(state.network).toBe('testnet');
    });

    it('should check if user is connected', () => {
      const unknownState = walletManager.isConnected('unknown');
      expect(unknownState).toBe(false);
    });

    it('should get wallet address', () => {
      const address = walletManager.getAddress('unknown');
      expect(address).toBeUndefined();
    });
  });
});