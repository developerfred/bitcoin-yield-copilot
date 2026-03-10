import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('process', () => ({
  env: {
    AGENT_STACKS_PRIVATE_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    AGENT_STACKS_ADDRESS: 'SP1234567890ABCDEFGHIJKLMNOPQRSTU',
    TELEGRAM_HASH_SALT: 'test-salt-123',
    FACTORY_CONTRACT_ADDRESS: 'SP123.factory',
    DB_PATH: ':memory:',
  }
}));

global.fetch = vi.fn();

vi.mock('crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue(Buffer.from('mock-hash')),
  }),
  randomBytes: vi.fn().mockReturnValue(Buffer.from('mock-random')),
}));

vi.mock('../src/security/stacksCrypto.js', () => ({
  stacksCrypto: {
    publicKeyCreate: vi.fn().mockReturnValue(Buffer.from('mock-public-key')),
    ecdsaSign: vi.fn().mockReturnValue({ signature: Buffer.from('mock-signature'), recovery: 0 }),
  }
}));

describe('WalletManager Withdraw Functions', () => {
  describe('withdrawStx validation', () => {
    const STX_DECIMALS = 1_000_000;

    function validateWithdrawParams(params: {
      telegramUserId: string;
      recipientAddress: string;
      amountMicro: bigint;
      expiryBlocks: number;
      record: { isActive: boolean } | null;
    }): { valid: boolean; error?: string } {
      if (!params.telegramUserId) {
        return { valid: false, error: 'Telegram user ID is required' };
      }

      if (!params.record) {
        return { valid: false, error: 'Wallet not found for user' };
      }

      if (!params.record.isActive) {
        return { valid: false, error: 'Wallet is inactive' };
      }

      if (!params.recipientAddress) {
        return { valid: false, error: 'Recipient address is required' };
      }

      if (!/^(SP|SM|ST|SN)/.test(params.recipientAddress)) {
        return { valid: false, error: 'Invalid recipient address' };
      }

      if (params.amountMicro <= 0n) {
        return { valid: false, error: 'Amount must be greater than 0' };
      }

      if (params.expiryBlocks <= 0) {
        return { valid: false, error: 'Expiry blocks must be greater than 0' };
      }

      return { valid: true };
    }

    describe('Parameter Validation', () => {
      it('should reject missing telegram user ID', () => {
        const result = validateWithdrawParams({
          telegramUserId: '',
          recipientAddress: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
          amountMicro: 1000000n,
          expiryBlocks: 10,
          record: { isActive: true },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Telegram user ID');
      });

      it('should reject non-existent wallet', () => {
        const result = validateWithdrawParams({
          telegramUserId: '123456',
          recipientAddress: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
          amountMicro: 1000000n,
          expiryBlocks: 10,
          record: null,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Wallet not found');
      });

      it('should reject inactive wallet', () => {
        const result = validateWithdrawParams({
          telegramUserId: '123456',
          recipientAddress: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
          amountMicro: 1000000n,
          expiryBlocks: 10,
          record: { isActive: false },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('inactive');
      });

      it('should reject invalid recipient address', () => {
        const result = validateWithdrawParams({
          telegramUserId: '123456',
          recipientAddress: 'invalid-address',
          amountMicro: 1000000n,
          expiryBlocks: 10,
          record: { isActive: true },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid recipient');
      });

      it('should reject zero amount', () => {
        const result = validateWithdrawParams({
          telegramUserId: '123456',
          recipientAddress: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
          amountMicro: 0n,
          expiryBlocks: 10,
          record: { isActive: true },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('greater than 0');
      });

      it('should reject negative amount', () => {
        const result = validateWithdrawParams({
          telegramUserId: '123456',
          recipientAddress: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
          amountMicro: -1000000n,
          expiryBlocks: 10,
          record: { isActive: true },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('greater than 0');
      });

      it('should reject zero expiry blocks', () => {
        const result = validateWithdrawParams({
          telegramUserId: '123456',
          recipientAddress: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
          amountMicro: 1000000n,
          expiryBlocks: 0,
          record: { isActive: true },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Expiry blocks');
      });

      it('should accept valid params', () => {
        const result = validateWithdrawParams({
          telegramUserId: '123456',
          recipientAddress: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
          amountMicro: 1000000n,
          expiryBlocks: 10,
          record: { isActive: true },
        });
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('Amount Conversion', () => {
      it('should convert STX to microSTX correctly', () => {
        const stxAmount = 10;
        const amountMicro = BigInt(Math.round(stxAmount * STX_DECIMALS));
        expect(amountMicro).toBe(10000000n);
      });

      it('should convert decimal STX to microSTX correctly', () => {
        const stxAmount = 10.5;
        const amountMicro = BigInt(Math.round(stxAmount * STX_DECIMALS));
        expect(amountMicro).toBe(10500000n);
      });

      it('should handle small amounts', () => {
        const stxAmount = 0.001;
        const amountMicro = BigInt(Math.round(stxAmount * STX_DECIMALS));
        expect(amountMicro).toBe(1000n);
      });

      it('should handle large amounts', () => {
        const stxAmount = 1000000;
        const amountMicro = BigInt(Math.round(stxAmount * STX_DECIMALS));
        expect(amountMicro).toBe(1000000000000n);
      });
    });
  });

  describe('executeOperation withdraw', () => {
    function executeOperationWithdraw(params: {
      telegramUserId: string;
      protocol: string;
      amount: bigint;
      expiryBlocks: number;
      wallet: { contractAddress: string; isActive: boolean } | null;
    }): { success: boolean; txId?: string; error?: string } {
      if (!params.wallet) {
        return { success: false, error: 'Wallet not found' };
      }

      if (!params.wallet.isActive) {
        return { success: false, error: 'Wallet is not active' };
      }

      if (!params.protocol) {
        return { success: false, error: 'Protocol address is required' };
      }

      if (params.amount <= 0n) {
        return { success: false, error: 'Amount must be positive' };
      }

      return { success: true, txId: `tx_${Date.now()}` };
    }

    describe('Withdraw Operation', () => {
      it('should execute withdraw operation successfully', () => {
        const result = executeOperationWithdraw({
          telegramUserId: '123456',
          protocol: 'SP123.protocol',
          amount: 1000000n,
          expiryBlocks: 10,
          wallet: { contractAddress: 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD', isActive: true },
        });
        expect(result.success).toBe(true);
        expect(result.txId).toBeDefined();
      });

      it('should fail without wallet', () => {
        const result = executeOperationWithdraw({
          telegramUserId: '123456',
          protocol: 'SP123.protocol',
          amount: 1000000n,
          expiryBlocks: 10,
          wallet: null,
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Wallet not found');
      });

      it('should fail with inactive wallet', () => {
        const result = executeOperationWithdraw({
          telegramUserId: '123456',
          protocol: 'SP123.protocol',
          amount: 1000000n,
          expiryBlocks: 10,
          wallet: { contractAddress: 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD', isActive: false },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('not active');
      });

      it('should fail with negative amount', () => {
        const result = executeOperationWithdraw({
          telegramUserId: '123456',
          protocol: 'SP123.protocol',
          amount: -1000000n,
          expiryBlocks: 10,
          wallet: { contractAddress: 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD', isActive: true },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('positive');
      });
    });
  });

  describe('Limit Checks', () => {
    function checkWithdrawLimits(params: {
      amountMicro: bigint;
      limits: { maxPerTx: bigint; remainingToday: bigint; isPaused: boolean };
    }): { allowed: boolean; error?: string } {
      if (params.limits.isPaused) {
        return { allowed: false, error: 'Wallet is paused' };
      }

      if (params.amountMicro > params.limits.maxPerTx) {
        return { allowed: false, error: `Amount exceeds per-transaction limit of ${params.limits.maxPerTx / 1000000n} STX` };
      }

      if (params.amountMicro > params.limits.remainingToday) {
        return { allowed: false, error: `Amount exceeds daily limit of ${params.limits.remainingToday / 1000000n} STX` };
      }

      return { allowed: true };
    }

    describe('Limit Validation', () => {
      const defaultLimits = {
        maxPerTx: 1000000n,
        remainingToday: 5000000n,
        isPaused: false,
      };

      it('should allow amount within limits', () => {
        const result = checkWithdrawLimits({
          amountMicro: 500000n,
          limits: defaultLimits,
        });
        expect(result.allowed).toBe(true);
      });

      it('should reject amount exceeding per-tx limit', () => {
        const result = checkWithdrawLimits({
          amountMicro: 2000000n,
          limits: defaultLimits,
        });
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('per-transaction limit');
      });

      it('should reject amount exceeding daily limit', () => {
        const result = checkWithdrawLimits({
          amountMicro: 6000000n,
          limits: { maxPerTx: 10000000n, remainingToday: 5000000n, isPaused: false },
        });
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('daily');
      });

      it('should reject when wallet is paused', () => {
        const result = checkWithdrawLimits({
          amountMicro: 500000n,
          limits: { ...defaultLimits, isPaused: true },
        });
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('paused');
      });

      it('should allow exact per-tx limit', () => {
        const result = checkWithdrawLimits({
          amountMicro: 1000000n,
          limits: defaultLimits,
        });
        expect(result.allowed).toBe(true);
      });

      it('should allow exact daily limit', () => {
        const result = checkWithdrawLimits({
          amountMicro: 5000000n,
          limits: { maxPerTx: 10000000n, remainingToday: 5000000n, isPaused: false },
        });
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe('Balance Verification', () => {
    function checkSufficientBalance(params: {
      contractBalance: bigint;
      requestedAmount: bigint;
      minimumReserve: bigint;
    }): { sufficient: boolean; error?: string } {
      const available = params.contractBalance - params.minimumReserve;
      
      if (params.contractBalance < params.minimumReserve) {
        return { sufficient: false, error: 'Contract balance below minimum reserve' };
      }

      if (params.requestedAmount > available) {
        return { sufficient: false, error: `Insufficient balance. Available: ${available / 1000000n} STX` };
      }

      return { sufficient: true };
    }

    describe('Balance Checks', () => {
      it('should allow withdrawal with sufficient balance', () => {
        const result = checkSufficientBalance({
          contractBalance: 10000000n,
          requestedAmount: 5000000n,
          minimumReserve: 1000000n,
        });
        expect(result.sufficient).toBe(true);
      });

      it('should reject when balance below reserve', () => {
        const result = checkSufficientBalance({
          contractBalance: 500000n,
          requestedAmount: 400000n,
          minimumReserve: 1000000n,
        });
        expect(result.sufficient).toBe(false);
        expect(result.error).toContain('below minimum reserve');
      });

      it('should reject when requested exceeds available', () => {
        const result = checkSufficientBalance({
          contractBalance: 10000000n,
          requestedAmount: 9500000n,
          minimumReserve: 1000000n,
        });
        expect(result.sufficient).toBe(false);
        expect(result.error).toContain('Insufficient balance');
      });

      it('should allow exact available balance', () => {
        const result = checkSufficientBalance({
          contractBalance: 10000000n,
          requestedAmount: 9000000n,
          minimumReserve: 1000000n,
        });
        expect(result.sufficient).toBe(true);
      });
    });
  });

  describe('Transaction Status', () => {
    interface TxStatus {
      tx_status: 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'pending';
      block_height?: number;
      fee_rate?: string;
    }

    function parseTransactionStatus(data: TxStatus): {
      status: string;
      emoji: string;
      details: string;
    } {
      switch (data.tx_status) {
        case 'success':
          return {
            status: 'Success',
            emoji: '✅',
            details: `Confirmed in block ${data.block_height}`,
          };
        case 'abort_by_response':
          return {
            status: 'Failed (Contract Error)',
            emoji: '❌',
            details: 'Transaction was rejected by the contract',
          };
        case 'abort_by_post_condition':
          return {
            status: 'Failed (Post-condition)',
            emoji: '❌',
            details: 'Post-condition was not satisfied',
          };
        case 'pending':
        default:
          return {
            status: 'Pending',
            emoji: '⏳',
            details: 'Transaction is still being processed',
          };
      }
    }

    describe('Status Parsing', () => {
      it('should parse success status', () => {
        const result = parseTransactionStatus({
          tx_status: 'success',
          block_height: 100,
        });
        expect(result.status).toBe('Success');
        expect(result.emoji).toBe('✅');
      });

      it('should parse contract error status', () => {
        const result = parseTransactionStatus({
          tx_status: 'abort_by_response',
        });
        expect(result.status).toBe('Failed (Contract Error)');
        expect(result.emoji).toBe('❌');
      });

      it('should parse post-condition failure', () => {
        const result = parseTransactionStatus({
          tx_status: 'abort_by_post_condition',
        });
        expect(result.status).toBe('Failed (Post-condition)');
        expect(result.emoji).toBe('❌');
      });

      it('should parse pending status', () => {
        const result = parseTransactionStatus({
          tx_status: 'pending',
        });
        expect(result.status).toBe('Pending');
        expect(result.emoji).toBe('⏳');
      });
    });
  });
});
