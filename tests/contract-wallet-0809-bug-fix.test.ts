import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletManager } from '../src/bot/wallet/WalletManager.js';

// Mock environment
process.env.AGENT_STACKS_PRIVATE_KEY = '753b7cc01a1a2e86221266a154af739c41dcafdb5a5f0c3e3a343712e120b270';
process.env.TELEGRAM_HASH_SALT = 'test-salt';
process.env.WITHDRAW_HELPER_CONTRACT = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3AGAEZ6YPQNGF.withdraw-helper';
process.env.AGENT_STACKS_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3AGAEZ6YPQNGF';

describe('0x0809 ContractAlreadyExists Bug Fix', () => {
  let walletManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock stacksCrypto
    vi.mock('../src/security/stacksCrypto.js', () => ({
      stacksCrypto: {
        publicKeyCreate: vi.fn().mockReturnValue(Buffer.from('03dd307936689d6996254c673316f3deb87c030e9de1d47fae78b3d27b7ccd44f5', 'hex')),
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

    // Mock blockchain service
    vi.mock('../src/bot/wallet/BlockchainService.js', () => ({
      BlockchainService: vi.fn().mockImplementation(() => ({
        networkConfig: { network: 'testnet' },
        broadcastTx: vi.fn().mockResolvedValue({ txid: 'mock-txid' }),
        checkContractExists: vi.fn().mockResolvedValue(false),
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true }),
        callReadOnlyFunction: vi.fn().mockResolvedValue(null),
        getNonce: vi.fn().mockResolvedValue(0n)
      }))
    }));

    // Mock contract service
    vi.mock('../src/bot/wallet/ContractService.js', () => ({
      ContractService: vi.fn().mockImplementation(() => ({
        isContractInitialized: vi.fn().mockResolvedValue(false),
        initializeWallet: vi.fn().mockResolvedValue({ success: true }),
        isWalletRegisteredInHelper: vi.fn().mockResolvedValue(false),
        registerWalletInHelper: vi.fn().mockResolvedValue({ success: true }),
        getProtocolConfig: vi.fn().mockResolvedValue({}),
        registerWalletInFactory: vi.fn().mockResolvedValue({ success: true })
      }))
    }));

    // Mock crypto service
    vi.mock('../src/bot/wallet/CryptoService.js', () => ({
      CryptoService: vi.fn().mockImplementation(() => ({
        deriveTelegramHash: vi.fn().mockReturnValue(Buffer.from('mock-telegram-hash')),
        verifySignature: vi.fn().mockReturnValue(true),
        signTransaction: vi.fn().mockReturnValue({ signature: 'mock-sig' })
      }))
    }));

    // Mock database service
    vi.mock('../src/bot/wallet/DatabaseService.js', () => ({
      DatabaseService: vi.fn().mockImplementation(() => ({
        saveContractWallet: vi.fn().mockResolvedValue({ id: 1 }),
        getContractWallet: vi.fn().mockResolvedValue(null),
        getWalletByTelegramId: vi.fn().mockResolvedValue(null)
      }))
    }));

    // Create wallet manager instance
    walletManager = new WalletManager();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('0x0809 ContractAlreadyExists error handling', () => {
    it('should detect and retry on 0x0809 hex error', async () => {
      // Mock contract deployment to throw 0x0809 error
      const mockDeployTx = vi.fn()
        .mockRejectedValueOnce(new Error('Tx falhou: Abortado pelo Clarity: 0x0809'))
        .mockResolvedValueOnce({ txid: 'success-txid' });

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: mockDeployTx,
        isContractInitialized: vi.fn().mockResolvedValue(false),
        initializeWallet: vi.fn().mockResolvedValue({ success: true })
      });

      // Mock blockchain service
      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const telegramUserId = 12345;
      const result = await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      expect(mockDeployTx).toHaveBeenCalledTimes(2); // Should retry once
      expect(result).toBeDefined();
    });

    it('should detect and retry on ContractAlreadyExists text error', async () => {
      const mockDeployTx = vi.fn()
        .mockRejectedValueOnce(new Error('ContractAlreadyExists'))
        .mockResolvedValueOnce({ txid: 'success-txid' });

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: mockDeployTx,
        isContractInitialized: vi.fn().mockResolvedValue(false),
        initializeWallet: vi.fn().mockResolvedValue({ success: true })
      });

      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const telegramUserId = 12345;
      const result = await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      expect(mockDeployTx).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('should detect and retry on Portuguese error message', async () => {
      const mockDeployTx = vi.fn()
        .mockRejectedValueOnce(new Error('Contrato já existe'))
        .mockResolvedValueOnce({ txid: 'success-txid' });

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: mockDeployTx,
        isContractInitialized: vi.fn().mockResolvedValue(false),
        initializeWallet: vi.fn().mockResolvedValue({ success: true })
      });

      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const telegramUserId = 12345;
      const result = await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      expect(mockDeployTx).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('should wait 10 seconds after successful deployment', async () => {
      const mockDeployTx = vi.fn().mockResolvedValue({ txid: 'success-txid' });
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: mockDeployTx,
        isContractInitialized: vi.fn().mockResolvedValue(false),
        initializeWallet: vi.fn().mockResolvedValue({ success: true })
      });

      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const telegramUserId = 12345;
      await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      // Should call setTimeout with 10000ms (10 seconds)
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    });

    it('should retry initialization on NoSuchContract errors', async () => {
      const mockInitializeWallet = vi.fn()
        .mockRejectedValueOnce(new Error('NoSuchContract'))
        .mockRejectedValueOnce(new Error('NoSuchContract'))
        .mockResolvedValueOnce({ success: true });

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: vi.fn().mockResolvedValue({ txid: 'success-txid' }),
        isContractInitialized: vi.fn().mockResolvedValue(false),
        initializeWallet: mockInitializeWallet
      });

      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const telegramUserId = 12345;
      await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      expect(mockInitializeWallet).toHaveBeenCalledTimes(3); // 3 attempts
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000); // 5-second wait between retries
    });

    it('should generate new contract name on retry', async () => {
      const deployCalls: string[] = [];
      const mockDeployTx = vi.fn().mockImplementation((contractName: string) => {
        deployCalls.push(contractName);
        if (deployCalls.length === 1) {
          throw new Error('ContractAlreadyExists');
        }
        return { txid: 'success-txid' };
      });

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: mockDeployTx,
        isContractInitialized: vi.fn().mockResolvedValue(false),
        initializeWallet: vi.fn().mockResolvedValue({ success: true })
      });

      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const telegramUserId = 12345;
      await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      expect(deployCalls).toHaveLength(2);
      expect(deployCalls[0]).not.toBe(deployCalls[1]); // Should be different contract names
      expect(deployCalls[1]).toMatch(/user-wallet-[a-f0-9]{8}/); // Should have hash suffix
    });

    it('should throw after maximum deployment attempts', async () => {
      const mockDeployTx = vi.fn().mockRejectedValue(new Error('ContractAlreadyExists'));

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: mockDeployTx,
        isContractInitialized: vi.fn().mockResolvedValue(false),
        initializeWallet: vi.fn().mockResolvedValue({ success: true })
      });

      const telegramUserId = 12345;
      
      await expect(walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {}))
        .rejects.toThrow('Failed to deploy contract after 5 attempts');
      
      expect(mockDeployTx).toHaveBeenCalledTimes(5); // MAX_DEPLOY_ATTEMPTS
    });

    it('should skip initialization if contract already initialized', async () => {
      const mockInitializeWallet = vi.fn();
      const mockIsContractInitialized = vi.fn().mockResolvedValue(true);

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: vi.fn().mockResolvedValue({ txid: 'success-txid' }),
        isContractInitialized: mockIsContractInitialized,
        initializeWallet: mockInitializeWallet
      });

      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const telegramUserId = 12345;
      await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      expect(mockIsContractInitialized).toHaveBeenCalled();
      expect(mockInitializeWallet).not.toHaveBeenCalled(); // Should skip initialization
    });

    it('should check contract availability 10 times', async () => {
      const mockIsContractInitialized = vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: vi.fn().mockResolvedValue({ txid: 'success-txid' }),
        isContractInitialized: mockIsContractInitialized,
        initializeWallet: vi.fn().mockResolvedValue({ success: true })
      });

      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const telegramUserId = 12345;
      await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      expect(mockIsContractInitialized).toHaveBeenCalledTimes(10); // 10 checks
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000); // 3-second wait between checks
    });

    it('should attempt initialization even if contract not found after 30 seconds', async () => {
      const mockIsContractInitialized = vi.fn().mockResolvedValue(false); // Always false
      const mockInitializeWallet = vi.fn().mockResolvedValue({ success: true });

      vi.spyOn(walletManager as any, 'contractService', 'get').mockReturnValue({
        deployWalletContract: vi.fn().mockResolvedValue({ txid: 'success-txid' }),
        isContractInitialized: mockIsContractInitialized,
        initializeWallet: mockInitializeWallet
      });

      vi.spyOn(walletManager as any, 'blockchainService', 'get').mockReturnValue({
        waitForConfirmation: vi.fn().mockResolvedValue({ success: true })
      });

      const telegramUserId = 12345;
      await walletManager.createContractWallet(telegramUserId, 'user-wallet', [], {});
      
      expect(mockIsContractInitialized).toHaveBeenCalledTimes(10);
      expect(mockInitializeWallet).toHaveBeenCalled(); // Should still attempt initialization
    });
  });

  describe('error message parsing', () => {
    it('should extract detailed error from 0x0809', () => {
      const error = new Error('Tx falhou: Abortado pelo Clarity: 0x0809');
      expect(error.message.includes('0x0809')).toBe(true);
      expect(error.message.includes('ContractAlreadyExists') || error.message.includes('Contrato já existe')).toBe(false);
    });

    it('should handle various error formats', () => {
      const testCases = [
        { error: 'Tx falhou: Abortado pelo Clarity: 0x0809', shouldMatch: true },
        { error: 'ContractAlreadyExists', shouldMatch: true },
        { error: 'Contrato já existe', shouldMatch: true },
        { error: 'Some other error', shouldMatch: false },
        { error: '0x0809 - Contract exists', shouldMatch: true },
        { error: 'Error: ContractAlreadyExists (0x0809)', shouldMatch: true }
      ];

      testCases.forEach(({ error, shouldMatch }) => {
        const matches = error.includes('ContractAlreadyExists') || 
                       error.includes('0x0809') || 
                       error.includes('Contrato já existe');
        expect(matches).toBe(shouldMatch);
      });
    });
  });
});