import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => ({
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn().mockReturnValue({ changes: 1 }),
    }),
    exec: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('../src/bot/wallet/WalletManager.js', () => ({
  getWalletManager: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockReturnValue('ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD'),
    getCachedWallet: vi.fn().mockReturnValue({
      contractAddress: 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD',
      network: 'testnet',
    }),
    isConnected: vi.fn().mockReturnValue(true),
    getRemainingLimits: vi.fn().mockResolvedValue({
      maxPerTx: 1000000n,
      remainingToday: 5000000n,
    }),
  }),
}));

describe('Address Validation', () => {
  function validateStacksAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    
    address = address.trim();
    
    const validPrefix = /^(SP|SM|ST|SN)/.test(address);
    if (!validPrefix) return false;
    
    const parts = address.split('.');
    
    if (parts.length === 1) {
      const body = address.substring(2);
      return /^[A-Za-z0-9]{28,40}$/.test(body);
    } 
    else if (parts.length === 2) {
      const [accountPart, contractName] = parts;
      
      if (!accountPart || !accountPart.startsWith('SP') && !accountPart.startsWith('SM') && 
          !accountPart.startsWith('ST') && !accountPart.startsWith('SN')) {
        return false;
      }
      
      const accountBody = accountPart.substring(2);
      if (!/^[A-Za-z0-9]{28,40}$/.test(accountBody)) return false;
      
      return /^[a-zA-Z0-9_-]{1,128}$/.test(contractName);
    }
    
    return false;
  }

  describe('Account Addresses', () => {
    it('should validate mainnet SP address', () => {
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(true);
    });

    it('should validate mainnet SM address', () => {
      expect(validateStacksAddress('SM2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(true);
    });

    it('should validate testnet ST address', () => {
      expect(validateStacksAddress('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(true);
    });

    it('should validate testnet SN address', () => {
      expect(validateStacksAddress('SN2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(true);
    });

    it('should reject invalid address', () => {
      expect(validateStacksAddress('invalid')).toBe(false);
    });

    it('should reject address with wrong prefix', () => {
      expect(validateStacksAddress('AB2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe(false);
    });

    it('should reject address shorter than 28 chars', () => {
      expect(validateStacksAddress('SP123')).toBe(false);
    });

    it('should reject address longer than 40 chars', () => {
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G1234567890')).toBe(false);
    });

    it('should trim whitespace', () => {
      expect(validateStacksAddress('  SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G  ')).toBe(true);
    });

    it('should handle empty string', () => {
      expect(validateStacksAddress('')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(validateStacksAddress(null as any)).toBe(false);
      expect(validateStacksAddress(undefined as any)).toBe(false);
    });
  });

  describe('Contract Addresses', () => {
    it('should validate contract address with valid account prefix', () => {
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.my-contract')).toBe(true);
    });

    it('should validate contract with ST prefix', () => {
      expect(validateStacksAddress('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.alex-v1')).toBe(true);
    });

    it('should validate contract with hyphens and underscores', () => {
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.my-contract_123')).toBe(true);
    });

    it('should reject contract with invalid account part', () => {
      expect(validateStacksAddress('INVALID.my-contract')).toBe(false);
    });

    it('should reject contract with empty contract name', () => {
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.')).toBe(false);
    });

    it('should reject contract name with invalid characters', () => {
      expect(validateStacksAddress('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.contract@123')).toBe(false);
    });

    it('should reject contract name longer than 128 chars', () => {
      const longName = 'a'.repeat(129);
      expect(validateStacksAddress(`SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G.${longName}`)).toBe(false);
    });
  });
});

describe('Withdraw Amount Validation', () => {
  const STX_DECIMALS = 1_000_000;

  function parseWithdrawAmount(amountStr: string): { valid: boolean; microAmount?: bigint; error?: string } {
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
      return { valid: false, error: 'Please enter a valid positive amount.' };
    }

    const amountMicro = BigInt(Math.round(amount * STX_DECIMALS));
    return { valid: true, microAmount: amountMicro };
  }

  describe('Amount Parsing', () => {
    it('should parse valid whole number', () => {
      const result = parseWithdrawAmount('10');
      expect(result.valid).toBe(true);
      expect(result.microAmount).toBe(10000000n);
    });

    it('should parse valid decimal', () => {
      const result = parseWithdrawAmount('10.5');
      expect(result.valid).toBe(true);
      expect(result.microAmount).toBe(10500000n);
    });

    it('should parse small amounts', () => {
      const result = parseWithdrawAmount('0.001');
      expect(result.valid).toBe(true);
      expect(result.microAmount).toBe(1000n);
    });

    it('should reject zero', () => {
      const result = parseWithdrawAmount('0');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('should reject negative', () => {
      const result = parseWithdrawAmount('-10');
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric', () => {
      const result = parseWithdrawAmount('abc');
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = parseWithdrawAmount('');
      expect(result.valid).toBe(false);
    });
  });

  describe('Limit Checks', () => {
    function checkLimits(amountMicro: bigint, limits: { maxPerTx: bigint; remainingToday: bigint }): { allowed: boolean; error?: string } {
      if (amountMicro > limits.remainingToday) {
        return { allowed: false, error: 'Daily limit exceeded' };
      }
      
      if (amountMicro > limits.maxPerTx) {
        return { allowed: false, error: 'Transaction limit exceeded' };
      }
      
      return { allowed: true };
    }

    it('should allow amount within all limits', () => {
      const result = checkLimits(5000000n, { maxPerTx: 10000000n, remainingToday: 50000000n });
      expect(result.allowed).toBe(true);
    });

    it('should reject amount exceeding daily limit', () => {
      const result = checkLimits(60000000n, { maxPerTx: 10000000n, remainingToday: 50000000n });
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Daily');
    });

    it('should reject amount exceeding per-tx limit', () => {
      const result = checkLimits(20000000n, { maxPerTx: 10000000n, remainingToday: 50000000n });
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Transaction');
    });

    it('should handle exact daily limit', () => {
      const result = checkLimits(50000000n, { maxPerTx: 100000000n, remainingToday: 50000000n });
      expect(result.allowed).toBe(true);
    });

    it('should handle exact per-tx limit', () => {
      const result = checkLimits(10000000n, { maxPerTx: 10000000n, remainingToday: 50000000n });
      expect(result.allowed).toBe(true);
    });
  });
});

describe('Withdrawal Address Storage', () => {
  interface WithdrawalAddressRow {
    stacks_address: string;
  }

  function loadWithdrawalAddress(db: any, telegramId: string): string | null {
    try {
      const row = db
        .prepare('SELECT stacks_address FROM withdrawal_addresses WHERE telegram_id = ?')
        .get(telegramId) as WithdrawalAddressRow | undefined;
      
      return row?.stacks_address ?? null;
    } catch (error) {
      console.error('[Withdraw] Error loading withdrawal address:', error);
      return null;
    }
  }

  function saveWithdrawalAddress(db: any, telegramId: string, address: string): boolean {
    try {
      db.prepare(`
        INSERT INTO withdrawal_addresses (telegram_id, stacks_address, updated_at)
        VALUES (?, ?, unixepoch())
        ON CONFLICT(telegram_id) DO UPDATE SET
          stacks_address = excluded.stacks_address,
          updated_at = unixepoch()
      `).run(telegramId, address);
      return true;
    } catch (error) {
      console.error('[Withdraw] Error saving address:', error);
      return false;
    }
  }

  function removeWithdrawalAddress(db: any, telegramId: string): boolean {
    try {
      db.prepare('DELETE FROM withdrawal_addresses WHERE telegram_id = ?').run(telegramId);
      return true;
    } catch (error) {
      console.error('[Withdraw] Error removing address:', error);
      return false;
    }
  }

  describe('Load Address', () => {
    it('should return null when no address exists', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(undefined),
        }),
      };
      
      const result = loadWithdrawalAddress(mockDb as any, '123456');
      expect(result).toBeNull();
    });

    it('should return address when exists', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ stacks_address: 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD' }),
        }),
      };
      
      const result = loadWithdrawalAddress(mockDb as any, '123456');
      expect(result).toBe('ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD');
    });

    it('should return null on database error', () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database error');
        }),
      };
      
      const result = loadWithdrawalAddress(mockDb as any, '123456');
      expect(result).toBeNull();
    });
  });

  describe('Save Address', () => {
    it('should save new address successfully', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 }),
        }),
      };
      
      const result = saveWithdrawalAddress(mockDb as any, '123456', 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD');
      expect(result).toBe(true);
    });

    it('should handle database error', () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database error');
        }),
      };
      
      const result = saveWithdrawalAddress(mockDb as any, '123456', 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD');
      expect(result).toBe(false);
    });
  });

  describe('Remove Address', () => {
    it('should remove address successfully', () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1 }),
        }),
      };
      
      const result = removeWithdrawalAddress(mockDb as any, '123456');
      expect(result).toBe(true);
    });

    it('should handle database error', () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database error');
        }),
      };
      
      const result = removeWithdrawalAddress(mockDb as any, '123456');
      expect(result).toBe(false);
    });
  });
});

describe('Callback Data Parsing', () => {
  function parseWithdrawCallback(data: string): { action: string; amount?: number; destination?: string } {
    const parts = data.split(':');
    return {
      action: parts[1],
      amount: parts[2] ? parseFloat(parts[2]) : undefined,
      destination: parts[3] ? parts.slice(3).join(':') : undefined,
    };
  }

  describe('Confirm Callback', () => {
    it('should parse confirm callback with amount and destination', () => {
      const result = parseWithdrawCallback('withdraw:confirm:5.5:ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD');
      expect(result.action).toBe('confirm');
      expect(result.amount).toBe(5.5);
      expect(result.destination).toBe('ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD');
    });

    it('should handle destination with colons', () => {
      const result = parseWithdrawCallback('withdraw:confirm:5:ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD:contract-name');
      expect(result.action).toBe('confirm');
      expect(result.amount).toBe(5);
      expect(result.destination).toBe('ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD:contract-name');
    });
  });

  describe('Cancel Callback', () => {
    it('should parse cancel callback', () => {
      const result = parseWithdrawCallback('withdraw:cancel');
      expect(result.action).toBe('cancel');
      expect(result.amount).toBeUndefined();
      expect(result.destination).toBeUndefined();
    });
  });
});

describe('Error Message Mapping', () => {
  function mapWithdrawError(errorMessage: string): string {
    if (errorMessage.includes('423')) {
      return 'Wallet não registrada no withdraw-helper.';
    } else if (errorMessage.includes('402')) {
      return 'Assinatura inválida.';
    } else if (errorMessage.includes('403')) {
      return 'Limite por transação excedido.';
    } else if (errorMessage.includes('419')) {
      return 'Limite diário excedido.';
    } else if (errorMessage.includes('415')) {
      return 'Saldo insuficiente no contrato.';
    } else if (errorMessage.includes('414')) {
      return 'Saldo insuficiente no contrato.';
    }
    return errorMessage;
  }

  describe('Error Mapping', () => {
    it('should map error 423', () => {
      expect(mapWithdrawError('Error 423: some error')).toContain('não registrada');
    });

    it('should map error 402', () => {
      expect(mapWithdrawError('Transaction failed: 402')).toContain('Assinatura');
    });

    it('should map error 403', () => {
      expect(mapWithdrawError('ERR 403: limit exceeded')).toContain('transação');
    });

    it('should map error 419', () => {
      expect(mapWithdrawError('419 daily limit')).toContain('diário');
    });

    it('should map error 415', () => {
      expect(mapWithdrawError('insufficient balance 415')).toContain('Saldo insuficiente');
    });

    it('should map error 414', () => {
      expect(mapWithdrawError('error code 414')).toContain('Saldo insuficiente');
    });

    it('should return original message for unknown errors', () => {
      expect(mapWithdrawError('Unknown error')).toBe('Unknown error');
    });
  });
});

describe('Network Detection', () => {
  function detectNetwork(address: string): 'mainnet' | 'testnet' {
    return address.startsWith('ST') || address.startsWith('SN') ? 'testnet' : 'mainnet';
  }

  describe('Network Detection', () => {
    it('should detect mainnet SP address', () => {
      expect(detectNetwork('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe('mainnet');
    });

    it('should detect mainnet SM address', () => {
      expect(detectNetwork('SM2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe('mainnet');
    });

    it('should detect testnet ST address', () => {
      expect(detectNetwork('ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe('testnet');
    });

    it('should detect testnet SN address', () => {
      expect(detectNetwork('SN2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G')).toBe('testnet');
    });
  });
});
