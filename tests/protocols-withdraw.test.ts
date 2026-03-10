import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Protocol Withdraw Tests', () => {
  describe('Protocol Address Resolution', () => {
    const PROTOCOL_ADDRESSES: Record<string, string> = {
      zest: 'SP00000000000000000000000000000000000000.zest-v1',
      alex: 'SP00000000000000000000000000000000000001.alex-v1',
      hermetica: 'SP00000000000000000000000000000000000002.hermetica-v1',
      bitflow: 'SP00000000000000000000000000000000000003.bitflow-v1',
    };

    function resolveProtocolAddress(protocolName: string): string | null {
      return PROTOCOL_ADDRESSES[protocolName.toLowerCase()] || null;
    }

    describe('Address Resolution', () => {
      it('should resolve Zest protocol address', () => {
        expect(resolveProtocolAddress('zest')).toBe(PROTOCOL_ADDRESSES.zest);
      });

      it('should resolve ALEX protocol address', () => {
        expect(resolveProtocolAddress('alex')).toBe(PROTOCOL_ADDRESSES.alex);
      });

      it('should resolve Hermetica protocol address', () => {
        expect(resolveProtocolAddress('hermetica')).toBe(PROTOCOL_ADDRESSES.hermetica);
      });

      it('should resolve Bitflow protocol address', () => {
        expect(resolveProtocolAddress('bitflow')).toBe(PROTOCOL_ADDRESSES.bitflow);
      });

      it('should be case insensitive', () => {
        expect(resolveProtocolAddress('ZEST')).toBe(PROTOCOL_ADDRESSES.zest);
        expect(resolveProtocolAddress('Alex')).toBe(PROTOCOL_ADDRESSES.alex);
        expect(resolveProtocolAddress('HERMETICA')).toBe(PROTOCOL_ADDRESSES.hermetica);
      });

      it('should return null for unknown protocol', () => {
        expect(resolveProtocolAddress('unknown')).toBeNull();
        expect(resolveProtocolAddress('random-protocol')).toBeNull();
      });
    });
  });

  describe('Protocol Withdraw Validation', () => {
    const SUPPORTED_TOKENS = ['sBTC', 'STX', 'USDC'];

    function validateProtocolWithdraw(params: {
      protocol: string;
      token: string;
      amount: number;
    }): { valid: boolean; error?: string } {
      if (!params.protocol) {
        return { valid: false, error: 'Protocol is required' };
      }

      if (!SUPPORTED_TOKENS.includes(params.token)) {
        return { valid: false, error: `Token ${params.token} not supported. Supported: ${SUPPORTED_TOKENS.join(', ')}` };
      }

      if (!params.amount || params.amount <= 0) {
        return { valid: false, error: 'Amount must be greater than 0' };
      }

      return { valid: true };
    }

    describe('Validation', () => {
      it('should accept valid Zest withdraw', () => {
        const result = validateProtocolWithdraw({
          protocol: 'zest',
          token: 'sBTC',
          amount: 1.5,
        });
        expect(result.valid).toBe(true);
      });

      it('should accept valid ALEX withdraw', () => {
        const result = validateProtocolWithdraw({
          protocol: 'alex',
          token: 'STX',
          amount: 100,
        });
        expect(result.valid).toBe(true);
      });

      it('should accept Hermetica withdraw', () => {
        const result = validateProtocolWithdraw({
          protocol: 'hermetica',
          token: 'sBTC',
          amount: 0.5,
        });
        expect(result.valid).toBe(true);
      });

      it('should reject unknown protocol', () => {
        const result = validateProtocolWithdraw({
          protocol: 'unknown-protocol',
          token: 'sBTC',
          amount: 1,
        });
        expect(result.valid).toBe(false);
      });
        expect(result.valid).toBe(false);
      });

      it('should reject unsupported token', () => {
        const result = validateProtocolWithdraw({
          protocol: 'zest',
          token: 'BTC',
          amount: 1,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not supported');
      });

      it('should reject zero amount', () => {
        const result = validateProtocolWithdraw({
          protocol: 'zest',
          token: 'sBTC',
          amount: 0,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('greater than 0');
      });

      it('should reject negative amount', () => {
        const result = validateProtocolWithdraw({
          protocol: 'zest',
          token: 'sBTC',
          amount: -1,
        });
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Protocol Balance Check', () => {
    interface ProtocolPosition {
      protocol: string;
      token: string;
      amount: number;
      apy: number;
    }

    function findPosition(positions: ProtocolPosition[], protocol: string, token: string): ProtocolPosition | null {
      return positions.find(p => 
        p.protocol.toLowerCase() === protocol.toLowerCase() && 
        p.token.toUpperCase() === token.toUpperCase()
      ) || null;
    }

    function canWithdraw(positions: ProtocolPosition[], protocol: string, token: string, amount: number): { allowed: boolean; error?: string } {
      const position = findPosition(positions, protocol, token);

      if (!position) {
        return { allowed: false, error: `No ${token} position in ${protocol}` };
      }

      if (amount > position.amount) {
        return { allowed: false, error: `Insufficient balance. Position: ${position.amount} ${token}` };
      }

      return { allowed: true };
    }

    describe('Position Lookup', () => {
      const positions: ProtocolPosition[] = [
        { protocol: 'zest', token: 'sBTC', amount: 2.5, apy: 8.2 },
        { protocol: 'alex', token: 'STX', amount: 1000, apy: 6.5 },
        { protocol: 'hermetica', token: 'sBTC', amount: 1.0, apy: 6.1 },
      ];

      it('should find Zest position', () => {
        const pos = findPosition(positions, 'zest', 'sBTC');
        expect(pos).not.toBeNull();
        expect(pos?.amount).toBe(2.5);
      });

      it('should find ALEX position', () => {
        const pos = findPosition(positions, 'alex', 'STX');
        expect(pos).not.toBeNull();
        expect(pos?.amount).toBe(1000);
      });

      it('should return null for non-existent position', () => {
        const pos = findPosition(positions, 'zest', 'STX');
        expect(pos).toBeNull();
      });

      it('should be case insensitive', () => {
        const pos = findPosition(positions, 'ZEST', 'SBTC');
        expect(pos).not.toBeNull();
      });
    });

    describe('Withdraw Permission', () => {
      const positions: ProtocolPosition[] = [
        { protocol: 'zest', token: 'sBTC', amount: 2.5, apy: 8.2 },
      ];

      it('should allow withdraw within balance', () => {
        const result = canWithdraw(positions, 'zest', 'sBTC', 1.0);
        expect(result.allowed).toBe(true);
      });

      it('should allow withdraw of entire balance', () => {
        const result = canWithdraw(positions, 'zest', 'sBTC', 2.5);
        expect(result.allowed).toBe(true);
      });

      it('should reject withdraw exceeding balance', () => {
        const result = canWithdraw(positions, 'zest', 'sBTC', 3.0);
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('Insufficient balance');
      });

      it('should reject withdraw from non-existent protocol', () => {
        const result = canWithdraw(positions, 'unknown', 'sBTC', 1.0);
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('No position');
      });

      it('should reject withdraw from wrong token', () => {
        const result = canWithdraw(positions, 'zest', 'STX', 1.0);
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('No STX position');
      });
    });
  });

  describe('Withdraw Callback Generation', () => {
    function createWithdrawCallback(protocol: string, amount: number): string {
      return `confirm_withdraw_${protocol}_${amount}`;
    }

    function parseWithdrawCallback(callbackData: string): { action: string; protocol: string; amount: number } | null {
      const match = callbackData.match(/confirm_withdraw_(.+)_(\d+\.?\d*)/);
      if (!match) return null;

      return {
        action: 'withdraw',
        protocol: match[1],
        amount: parseFloat(match[2]),
      };
    }

    describe('Callback Creation', () => {
      it('should create callback for Zest withdraw', () => {
        const callback = createWithdrawCallback('zest', 1.5);
        expect(callback).toBe('confirm_withdraw_zest_1.5');
      });

      it('should create callback for ALEX withdraw', () => {
        const callback = createWithdrawCallback('alex', 100);
        expect(callback).toBe('confirm_withdraw_alex_100');
      });

      it('should handle decimal amounts', () => {
        const callback = createWithdrawCallback('zest', 0.5);
        expect(callback).toBe('confirm_withdraw_zest_0.5');
      });
    });

    describe('Callback Parsing', () => {
      it('should parse Zest callback', () => {
        const result = parseWithdrawCallback('confirm_withdraw_zest_1.5');
        expect(result?.action).toBe('withdraw');
        expect(result?.protocol).toBe('zest');
        expect(result?.amount).toBe(1.5);
      });

      it('should parse ALEX callback', () => {
        const result = parseWithdrawCallback('confirm_withdraw_alex_100');
        expect(result?.action).toBe('withdraw');
        expect(result?.protocol).toBe('alex');
        expect(result?.amount).toBe(100);
      });

      it('should return null for invalid callback', () => {
        const result = parseWithdrawCallback('invalid_callback');
        expect(result).toBeNull();
      });
    });
  });

  describe('Multi-Step Withdraw Flow', () => {
    type WithdrawStep = 'initiate' | 'confirm' | 'broadcast' | 'complete' | 'failed';

    interface WithdrawFlowState {
      step: WithdrawStep;
      protocol: string;
      token: string;
      amount: number;
      txId?: string;
      error?: string;
    }

    function nextWithdrawStep(state: WithdrawFlowState, action: string): WithdrawFlowState {
      switch (state.step) {
        case 'initiate':
          if (action === 'confirm') {
            return { ...state, step: 'broadcast' };
          }
          return { ...state, step: 'failed', error: 'User cancelled' };

        case 'broadcast':
          return { ...state, step: 'complete' };

        default:
          return state;
      }
    }

    describe('Flow State Machine', () => {
      it('should transition from initiate to broadcast on confirm', () => {
        const state: WithdrawFlowState = {
          step: 'initiate',
          protocol: 'zest',
          token: 'sBTC',
          amount: 1.0,
        };

        const nextState = nextWithdrawStep(state, 'confirm');
        expect(nextState.step).toBe('broadcast');
      });

      it('should transition from initiate to failed on cancel', () => {
        const state: WithdrawFlowState = {
          step: 'initiate',
          protocol: 'zest',
          token: 'sBTC',
          amount: 1.0,
        };

        const nextState = nextWithdrawStep(state, 'cancel');
        expect(nextState.step).toBe('failed');
        expect(nextState.error).toBe('User cancelled');
      });

      it('should transition from broadcast to complete', () => {
        const state: WithdrawFlowState = {
          step: 'broadcast',
          protocol: 'zest',
          token: 'sBTC',
          amount: 1.0,
        };

        const nextState = nextWithdrawStep(state, 'complete');
        expect(nextState.step).toBe('complete');
      });

      it('should stay at complete state', () => {
        const state: WithdrawFlowState = {
          step: 'complete',
          protocol: 'zest',
          token: 'sBTC',
          amount: 1.0,
        };

        const nextState = nextWithdrawStep(state, 'any');
        expect(nextState.step).toBe('complete');
      });
    });
  });

  describe('Explorer URL Generation', () => {
    function generateExplorerUrl(txId: string, network: 'mainnet' | 'testnet'): string {
      const baseUrl = network === 'mainnet'
        ? 'https://explorer.hiro.so/txid'
        : 'https://explorer.hiro.so/txid?chain=testnet';
      return `${baseUrl}/${txId}`;
    }

    describe('URL Generation', () => {
      it('should generate mainnet explorer URL', () => {
        const url = generateExplorerUrl('0xabc123', 'mainnet');
        expect(url).toBe('https://explorer.hiro.so/txid/0xabc123');
      });

      it('should generate testnet explorer URL', () => {
        const url = generateExplorerUrl('0xabc123', 'testnet');
        expect(url).toBe('https://explorer.hiro.so/txid?chain=testnet/0xabc123');
      });

      it('should handle long transaction IDs', () => {
        const txId = '0x' + 'a'.repeat(64);
        const url = generateExplorerUrl(txId, 'mainnet');
        expect(url).toContain(txId);
      });
    });
  });
});
