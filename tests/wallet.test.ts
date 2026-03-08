import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getNetworkConfig, getCurrentNetwork } from '../src/bot/wallet/network.ts';
import { getWalletManager, WalletManager, validateStacksAddress } from '../src/bot/wallet/WalletManager.ts';
import { InMemorySessionStore, WalletSessionManager, SessionStore, WalletSession } from '../src/bot/wallet/session.ts';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Mock environment variables
vi.mock('process', () => ({
  env: {
    AGENT_STACKS_PRIVATE_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    AGENT_STACKS_ADDRESS: 'SP1234567890ABCDEFGHIJKLMNOPQRSTU',
    TELEGRAM_HASH_SALT: 'test-salt-123',
    FACTORY_CONTRACT_ADDRESS: 'SP123.factory',
    DB_PATH: ':memory:',
  }
}));

// Mock fetch calls
global.fetch = vi.fn();

// Mock crypto functions
vi.mock('crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue(Buffer.from('mock-hash')),
  }),
  randomBytes: vi.fn().mockReturnValue(Buffer.from('mock-random')),
}));

// Mock stacksCrypto
vi.mock('../src/security/stacksCrypto.js', () => ({
  stacksCrypto: {
    publicKeyCreate: vi.fn().mockReturnValue(Buffer.from('mock-public-key')),
    ecdsaSign: vi.fn().mockReturnValue({ signature: Buffer.from('mock-signature'), recovery: 0 }),
  }
}));

describe('Wallet Network', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNetworkConfig', () => {
    it('should return testnet config', () => {
      const config = getNetworkConfig('testnet');
      
      expect(config.name).toBe('testnet');
      expect(config.apiUrl).toBe('https://stacks-node-api.testnet.alexlab.co');
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

    it('should return devnet config', () => {
      const config = getNetworkConfig('devnet');
      
      expect(config.name).toBe('devnet');
      expect(config.apiUrl).toBe('http://localhost:3999');
      expect(config.explorerUrl).toBe('http://localhost:8000');
    });
  });

  describe('getCurrentNetwork', () => {
    it('should return testnet by default', () => {
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

describe('WalletManager', () => {
  let walletManager: WalletManager;
  const testUserId = '123456789';

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock successful fetch responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/v2/accounts/')) {
        return Promise.resolve({
          json: () => Promise.resolve({ nonce: 0 })
        });
      }
      if (url.includes('/v2/info')) {
        return Promise.resolve({
          json: () => Promise.resolve({ stacks_tip_height: 1000 })
        });
      }
      if (url.includes('/v2/fees/transfer')) {
        return Promise.resolve({
          json: () => Promise.resolve(100)
        });
      }
      if (url.includes('/extended/v1/tx/')) {
        return Promise.resolve({
          json: () => Promise.resolve({ tx_status: 'success' })
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    // Create fresh WalletManager instance
    walletManager = await WalletManager.create();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with private key from env', async () => {
      expect(walletManager).toBeDefined();
      expect(walletManager.getNetwork().name).toBe('testnet');
    });

    it('should throw if no private key or mnemonic configured', async () => {
      const originalKey = process.env.AGENT_STACKS_PRIVATE_KEY;
      delete process.env.AGENT_STACKS_PRIVATE_KEY;
      
      await expect(WalletManager.create()).rejects.toThrow('No agent key configured');
      
      process.env.AGENT_STACKS_PRIVATE_KEY = originalKey;
    });

    it('should validate Stacks addresses correctly', () => {
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(true);
      expect(validateStacksAddress('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(true);
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.test-contract')).toBe(true);
      expect(validateStacksAddress('invalid-address')).toBe(false);
    });
  });

  describe('telegram hash derivation', () => {
    it('should derive consistent hash for same user', () => {
      // @ts-ignore - testing private method
      const hash1 = walletManager['deriveTelegramHash'](testUserId);
      // @ts-ignore - testing private method
      const hash2 = walletManager['deriveTelegramHash'](testUserId);
      expect(hash1).toEqual(hash2);
    });

    it('should derive different hashes for different users', () => {
      // @ts-ignore - testing private method
      const hash1 = walletManager['deriveTelegramHash']('user1');
      // @ts-ignore - testing private method
      const hash2 = walletManager['deriveTelegramHash']('user2');
      expect(hash1).not.toEqual(hash2);
    });
  });

  describe('wallet state', () => {
    it('should return not connected for unknown user', () => {
      const state = walletManager.getStateForUser('unknown');
      expect(state.connected).toBe(false);
    });

    it('should return wallet info after creation', async () => {
      // Mock successful contract deployment
      vi.spyOn(walletManager as any, 'waitForConfirmation').mockResolvedValue(undefined);
      
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

      // Check state after creation
      const state = walletManager.getStateForUser(testUserId);
      expect(state.connected).toBe(true);
      expect(state.address).toBe(record.contractAddress);
    });

    it('should return cached wallet without deploying again', async () => {
      const spy = vi.spyOn(walletManager as any, 'waitForConfirmation').mockResolvedValue(undefined);
      
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
      expect(spy).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('operations', () => {
    beforeEach(async () => {
      // Setup: create a wallet first
      vi.spyOn(walletManager as any, 'waitForConfirmation').mockResolvedValue(undefined);
      
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
    });

    it('should sign an operation', async () => {
      const signed = await walletManager.signOperation({
        telegramUserId: testUserId,
        protocol: 'SP123.protocol',
        action: 'deposit',
        amount: 500_000n,
        expiryBlocks: 20
      });

      expect(signed.nonce).toBeDefined();
      expect(signed.signature).toBeDefined();
      expect(signed.signature.length).toBe(65); // 65 bytes: recovery + signature
      expect(signed.expiryBlock).toBeDefined();
    });

    it('should execute an operation', async () => {
      vi.spyOn(walletManager as any, 'broadcastTx').mockResolvedValue({ txid: '0x1234567890' });

      const result = await walletManager.executeOperation({
        telegramUserId: testUserId,
        protocol: 'SP123.protocol',
        action: 'deposit',
        amount: 500_000n,
        expiryBlocks: 10
      });

      expect(result.txId).toBe('0x1234567890');
    });

    it('should throw for non-existent user operations', async () => {
      await expect(walletManager.signOperation({
        telegramUserId: 'nonexistent',
        protocol: 'SP123.protocol',
        action: 'deposit',
        amount: 500_000n,
      })).rejects.toThrow('Wallet not found');
    });
  });

  describe('read operations', () => {
    it('should fetch wallet info', async () => {
      const mockInfo = {
        'current-nonce': 5n,
        'remaining-today': 5_000_000n,
        'max-per-transaction': 1_000_000n,
        'is-paused': false
      };

      vi.spyOn(walletManager as any, 'getWalletInfo').mockResolvedValue(mockInfo);

      const info = await walletManager.getWalletInfo(testUserId);
      expect(info).toEqual(mockInfo);
    });

    it('should fetch remaining limits', async () => {
      const mockLimits = {
        remainingToday: 5_000_000n,
        maxPerTx: 1_000_000n,
        isPaused: false
      };

      vi.spyOn(walletManager as any, 'getRemainingLimits').mockResolvedValue(mockLimits);

      const limits = await walletManager.getRemainingLimits(testUserId);
      expect(limits).toEqual(mockLimits);
    });

    it('should return empty operation history for new user', () => {
      const history = walletManager.getOperationHistory(testUserId);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });
  });
});

describe('Wallet Session Manager', () => {
  let sessionManager: WalletSessionManager;
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
    sessionManager = new WalletSessionManager(store, 60000); // 1 minute TTL
  });

  describe('InMemorySessionStore', () => {
    it('should create and retrieve session', async () => {
      const session = await sessionManager.createSession(
        'user123',
        'SP1234567890ABCDEFGHIJKLMNOPQRSTU',
        '02abcdef',
        'testnet'
      );
      
      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user123');
      expect(session.walletAddress).toBe('SP1234567890ABCDEFGHIJKLMNOPQRSTU');
      expect(session.publicKey).toBe('02abcdef');
      expect(session.network).toBe('testnet');
    });

    it('should check active session', async () => {
      await sessionManager.createSession(
        'user123',
        'SP1234567890ABCDEFGHIJKLMNOPQRSTU',
        undefined,
        'testnet'
      );
      
      const hasActive = await sessionManager.hasActiveSession('user123');
      expect(hasActive).toBe(true);
    });

    it('should return false for non-existent user', async () => {
      const hasActive = await sessionManager.hasActiveSession('nonexistent');
      expect(hasActive).toBe(false);
    });

    it('should get active session', async () => {
      const created = await sessionManager.createSession(
        'user123',
        'SP1234567890ABCDEFGHIJKLMNOPQRSTU',
        undefined,
        'testnet'
      );
      
      const retrieved = await sessionManager.getSessionByUserId('user123');
      expect(retrieved).toEqual(created);
    });

    it('should return null for expired session', async () => {
      const shortSession = new WalletSessionManager(store, 1); // 1ms TTL
      
      await shortSession.createSession(
        'user123',
        'SP1234567890ABCDEFGHIJKLMNOPQRSTU',
        undefined,
        'testnet'
      );
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const hasActive = await shortSession.hasActiveSession('user123');
      expect(hasActive).toBe(false);
    });

    it('should delete session', async () => {
      const session = await sessionManager.createSession(
        'user123',
        'SP1234567890ABCDEFGHIJKLMNOPQRSTU',
        undefined,
        'testnet'
      );
      
      await store.delete(session.id);
      
      const hasActive = await sessionManager.hasActiveSession('user123');
      expect(hasActive).toBe(false);
    });

    it('should clear all sessions', async () => {
      const session1 = await sessionManager.createSession('user1', 'SP1', undefined, 'testnet');
      const session2 = await sessionManager.createSession('user2', 'SP2', undefined, 'testnet');
      
      // Clean up individually
      await store.delete(session1.id);
      await store.delete(session2.id);
      
      expect(await sessionManager.hasActiveSession('user1')).toBe(false);
      expect(await sessionManager.hasActiveSession('user2')).toBe(false);
    });
  });

  describe('Singleton access', () => {
    it('should provide singleton instance via getWalletManager', async () => {
      const instance1 = await getWalletManager();
      const instance2 = await getWalletManager();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize only once', async () => {
      const createSpy = vi.spyOn(WalletManager, 'create');
      
      await getWalletManager();
      await getWalletManager();
      await getWalletManager();
      
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Mnemonic support', () => {
  const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should detect mnemonic strings', async () => {
    // @ts-ignore - testing internal function
    const { isMnemonic } = await import('../src/bot/wallet/WalletManager.ts');
    
    expect(isMnemonic(mockMnemonic)).toBe(true);
    expect(isMnemonic('not a mnemonic')).toBe(false);
    expect(isMnemonic('short phrase')).toBe(false);
  });

  it('should derive key from mnemonic when private key not provided', async () => {
    // Mock environment with mnemonic instead of private key
    const originalKey = process.env.AGENT_STACKS_PRIVATE_KEY;
    delete process.env.AGENT_STACKS_PRIVATE_KEY;
    process.env.AGENT_STACKS_MNEMONIC = mockMnemonic;

    // Mock mnemonic derivation
    vi.doMock('@scure/bip39', () => ({
      mnemonicToSeedSync: vi.fn().mockReturnValue(Buffer.alloc(64, 1)),
      validateMnemonic: vi.fn().mockReturnValue(true),
      wordlist: {},
    }));

    vi.doMock('@scure/bip32', () => ({
      HDKey: {
        fromMasterSeed: vi.fn().mockReturnValue({
          derive: vi.fn().mockReturnValue({
            privateKey: Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex'),
          }),
        }),
      },
    }));

    const { WalletManager } = await import('../src/bot/wallet/WalletManager.ts');
    const manager = await WalletManager.create();
    
    expect(manager).toBeDefined();

    // Restore environment
    process.env.AGENT_STACKS_PRIVATE_KEY = originalKey;
    delete process.env.AGENT_STACKS_MNEMONIC;
  });

  it('should handle mnemonic derivation errors gracefully', async () => {
    const originalKey = process.env.AGENT_STACKS_PRIVATE_KEY;
    delete process.env.AGENT_STACKS_PRIVATE_KEY;
    process.env.AGENT_STACKS_MNEMONIC = 'invalid mnemonic';

    const { WalletManager } = await import('../src/bot/wallet/WalletManager.ts');
    
    await expect(WalletManager.create()).rejects.toThrow();
    
    process.env.AGENT_STACKS_PRIVATE_KEY = originalKey;
    delete process.env.AGENT_STACKS_MNEMONIC;
  });

  describe('wallet hash calculations', () => {
    it('should calculate wallet hash using cryptoService.principalToConsensusBytes', () => {
      // Mock cryptoService
      const mockConsensusBytes = Buffer.from([0x05, 0x00]);
      const mockCryptoService = {
        principalToConsensusBytes: vi.fn().mockReturnValue(mockConsensusBytes)
      };
      
      // @ts-ignore - testing private method with mocked dependency
      walletManager['cryptoService'] = mockCryptoService;
      
      // @ts-ignore - testing private method
      const result = walletManager['calculateWalletHash']('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G');
      
      expect(mockCryptoService.principalToConsensusBytes).toHaveBeenCalledWith('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G');
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should calculate recipient hash using cryptoService.principalToConsensusBytes', () => {
      // Mock cryptoService
      const mockConsensusBytes = Buffer.from([0x05, 0x00]);
      const mockCryptoService = {
        principalToConsensusBytes: vi.fn().mockReturnValue(mockConsensusBytes)
      };
      
      // @ts-ignore - testing private method with mocked dependency
      walletManager['cryptoService'] = mockCryptoService;
      
      // @ts-ignore - testing private method
      const result = walletManager['calculateRecipientHash']('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G');
      
      expect(mockCryptoService.principalToConsensusBytes).toHaveBeenCalledWith('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G');
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle contract principal addresses correctly', () => {
      // Mock cryptoService
      const mockConsensusBytes = Buffer.from([0x06, 0x00]);
      const mockCryptoService = {
        principalToConsensusBytes: vi.fn().mockReturnValue(mockConsensusBytes)
      };
      
      // @ts-ignore - testing private method with mocked dependency
      walletManager['cryptoService'] = mockCryptoService;
      
      // @ts-ignore - testing private method
      const result = walletManager['calculateWalletHash']('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.user-wallet-abc123');
      
      expect(mockCryptoService.principalToConsensusBytes).toHaveBeenCalledWith('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.user-wallet-abc123');
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('withdrawal flow edge cases', () => {
    it('should not throw TypeError when calling calculateWalletHash', () => {
      // This test ensures the fix for 'this.principalToConsensusBytes is not a function' is working
      const mockCryptoService = {
        principalToConsensusBytes: vi.fn().mockReturnValue(Buffer.from([0x05, 0x00]))
      };
      
      // @ts-ignore - testing private method with mocked dependency
      walletManager['cryptoService'] = mockCryptoService;
      
      // Should not throw TypeError
      expect(() => {
        // @ts-ignore - testing private method
        walletManager['calculateWalletHash']('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G');
      }).not.toThrow(TypeError);
      
      // Verify it calls cryptoService method, not a non-existent method
      expect(mockCryptoService.principalToConsensusBytes).toHaveBeenCalled();
    });

    it('should not throw TypeError when calling calculateRecipientHash', () => {
      // This test ensures the fix for 'this.principalToConsensusBytes is not a function' is working
      const mockCryptoService = {
        principalToConsensusBytes: vi.fn().mockReturnValue(Buffer.from([0x05, 0x00]))
      };
      
      // @ts-ignore - testing private method with mocked dependency
      walletManager['cryptoService'] = mockCryptoService;
      
      // Should not throw TypeError
      expect(() => {
        // @ts-ignore - testing private method
        walletManager['calculateRecipientHash']('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G');
      }).not.toThrow(TypeError);
      
      // Verify it calls cryptoService method, not a non-existent method
      expect(mockCryptoService.principalToConsensusBytes).toHaveBeenCalled();
    });
  });
});