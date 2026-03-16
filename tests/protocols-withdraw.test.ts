import { describe, it, expect } from 'vitest';

// Shared constants across all tests
const PROTOCOL_ADDRESSES: Record<string, string> = {
  zest: 'SP00000000000000000000000000000000000000.zest-v1',
  alex: 'SP00000000000000000000000000000000000001.alex-v1',
  hermetica: 'SP00000000000000000000000000000000000002.hermetica-v1',
  bitflow: 'SP00000000000000000000000000000000000003.bitflow-v1',
};

describe('Protocol Withdraw Tests', () => {
  describe('Protocol Address Resolution', () => {
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
      });

      it('should return null for unknown protocol', () => {
        expect(resolveProtocolAddress('unknown')).toBeNull();
      });
    });
  });

  describe('Protocol Withdraw Validation', () => {
    interface WithdrawRequest {
      protocol: string;
      token: string;
      amount: number;
    }

    const SUPPORTED_TOKENS = ['sBTC', 'STX', 'USDC'];
    const MIN_AMOUNT = 0.0001;

    function validateWithdraw(request: WithdrawRequest): { valid: boolean; error?: string } {
      if (!PROTOCOL_ADDRESSES[request.protocol.toLowerCase()]) {
        return { valid: false, error: `Unsupported protocol: ${request.protocol}` };
      }
      if (!SUPPORTED_TOKENS.includes(request.token)) {
        return { valid: false, error: `Unsupported token: ${request.token}` };
      }
      if (request.amount <= 0) {
        return { valid: false, error: 'Amount must be greater than 0' };
      }
      if (request.amount < MIN_AMOUNT) {
        return { valid: false, error: `Amount must be at least ${MIN_AMOUNT}` };
      }
      return { valid: true };
    }

    describe('Validation', () => {
      it('should accept valid Zest withdraw', () => {
        const result = validateWithdraw({ protocol: 'zest', token: 'sBTC', amount: 1.0 });
        expect(result.valid).toBe(true);
      });

      it('should accept valid ALEX withdraw', () => {
        const result = validateWithdraw({ protocol: 'alex', token: 'sBTC', amount: 0.5 });
        expect(result.valid).toBe(true);
      });

      it('should accept Hermetica withdraw', () => {
        const result = validateWithdraw({ protocol: 'hermetica', token: 'sBTC', amount: 2.0 });
        expect(result.valid).toBe(true);
      });

      it('should reject unknown protocol', () => {
        const result = validateWithdraw({ protocol: 'unknown', token: 'sBTC', amount: 1.0 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unsupported protocol');
      });

      it('should reject unsupported token', () => {
        const result = validateWithdraw({ protocol: 'zest', token: 'BTC', amount: 1.0 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unsupported token');
      });

      it('should reject zero amount', () => {
        const result = validateWithdraw({ protocol: 'zest', token: 'sBTC', amount: 0 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('greater than 0');
      });

      it('should reject negative amount', () => {
        const result = validateWithdraw({ protocol: 'zest', token: 'sBTC', amount: -1 });
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
        { protocol: 'zest', token: 'sBTC', amount: 1.5, apy: 8.2 },
        { protocol: 'alex', token: 'STX', amount: 100, apy: 12.5 },
      ];

      it('should find Zest position', () => {
        const pos = findPosition(positions, 'zest', 'sBTC');
        expect(pos).toBeDefined();
        expect(pos?.amount).toBe(1.5);
      });

      it('should find ALEX position', () => {
        const pos = findPosition(positions, 'alex', 'STX');
        expect(pos).toBeDefined();
        expect(pos?.amount).toBe(100);
      });

      it('should return null for non-existent position', () => {
        const pos = findPosition(positions, 'zest', 'STX');
        expect(pos).toBeNull();
      });

      it('should be case insensitive', () => {
        const pos = findPosition(positions, 'ZEST', 'sbtc');
        expect(pos).toBeDefined();
      });
    });

    describe('Withdraw Permission', () => {
      const positions: ProtocolPosition[] = [
        { protocol: 'zest', token: 'sBTC', amount: 1.0, apy: 8.2 },
      ];

      it('should allow withdraw within balance', () => {
        const result = canWithdraw(positions, 'zest', 'sBTC', 0.5);
        expect(result.allowed).toBe(true);
      });

      it('should allow withdraw of entire balance', () => {
        const result = canWithdraw(positions, 'zest', 'sBTC', 1.0);
        expect(result.allowed).toBe(true);
      });

      it('should reject withdraw exceeding balance', () => {
        const result = canWithdraw(positions, 'zest', 'sBTC', 2.0);
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('Insufficient balance');
      });

      it('should reject withdraw from non-existent protocol', () => {
        const result = canWithdraw(positions, 'alex', 'sBTC', 0.5);
        expect(result.allowed).toBe(false);
      });
    });
  });

  describe('Withdraw Flow State', () => {
    type WithdrawStep = 'init' | 'confirm' | 'broadcast' | 'complete';
    interface WithdrawFlowState {
      step: WithdrawStep;
      protocol: string;
      token: string;
      amount: number;
    }

    function nextWithdrawStep(state: WithdrawFlowState, event: string): WithdrawFlowState {
      const flow: Record<WithdrawStep, WithdrawStep> = {
        init: 'confirm',
        confirm: 'broadcast',
        broadcast: 'complete',
        complete: 'complete',
      };

      return {
        ...state,
        step: flow[state.step],
      };
    }

    describe('State Transitions', () => {
      it('should transition from init to confirm', () => {
        const state: WithdrawFlowState = {
          step: 'init',
          protocol: 'zest',
          token: 'sBTC',
          amount: 1.0,
        };

        const nextState = nextWithdrawStep(state, 'confirm');
        expect(nextState.step).toBe('confirm');
      });

      it('should transition from confirm to broadcast', () => {
        const state: WithdrawFlowState = {
          step: 'confirm',
          protocol: 'zest',
          token: 'sBTC',
          amount: 1.0,
        };

        const nextState = nextWithdrawStep(state, 'broadcast');
        expect(nextState.step).toBe('broadcast');
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
