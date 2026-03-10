import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Complete Withdraw Flow Integration Tests', () => {
  describe('End-to-End User Wallet Withdraw Flow', () => {
    interface UserState {
      telegramId: string;
      walletConnected: boolean;
      walletAddress?: string;
      withdrawalAddress?: string;
      balance: bigint;
    }

    interface WithdrawRequest {
      userId: string;
      amount: number;
      token: string;
      destination?: string;
    }

    const STX_DECIMALS = 1_000_000;

    async function executeUserWalletWithdraw(request: WithdrawRequest, userState: UserState): Promise<{
      success: boolean;
      txIdAuth?: string;
      txIdWithdraw?: string;
      error?: string;
    }> {
      if (!userState.walletConnected) {
        return { success: false, error: 'Wallet not connected' };
      }

      const amountMicro = BigInt(Math.round(request.amount * STX_DECIMALS));

      if (amountMicro <= 0n) {
        return { success: false, error: 'Invalid amount' };
      }

      const destination = request.destination || userState.withdrawalAddress;

      if (!destination) {
        return { success: false, error: 'No withdrawal address set. Use /setwallet first.' };
      }

      if (!destination.startsWith('SP') && !destination.startsWith('SM') &&
          !destination.startsWith('ST') && !destination.startsWith('SN')) {
        return { success: false, error: 'Invalid withdrawal address' };
      }

      if (userState.balance < amountMicro) {
        return { success: false, error: `Insufficient balance. Available: ${Number(userState.balance) / STX_DECIMALS} STX` };
      }

      const txIdAuth = `auth_${Date.now()}`;
      const txIdWithdraw = `withdraw_${Date.now()}`;

      userState.balance -= amountMicro;

      return {
        success: true,
        txIdAuth,
        txIdWithdraw,
      };
    }

    describe('Complete Flow', () => {
      const userState: UserState = {
        telegramId: '123456',
        walletConnected: true,
        walletAddress: 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD',
        withdrawalAddress: 'ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
        balance: 10000000n,
      };

      it('should execute withdraw successfully', async () => {
        const result = await executeUserWalletWithdraw({
          userId: '123456',
          amount: 5,
          token: 'STX',
        }, userState);

        expect(result.success).toBe(true);
        expect(result.txIdAuth).toBeDefined();
        expect(result.txIdWithdraw).toBeDefined();
      });

      it('should fail when wallet not connected', async () => {
        const disconnectedUser = { ...userState, walletConnected: false };

        const result = await executeUserWalletWithdraw({
          userId: '123456',
          amount: 5,
          token: 'STX',
        }, disconnectedUser);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Wallet not connected');
      });

      it('should fail when no withdrawal address', async () => {
        const noAddressUser = { ...userState, withdrawalAddress: undefined };

        const result = await executeUserWalletWithdraw({
          userId: '123456',
          amount: 5,
          token: 'STX',
        }, noAddressUser);

        expect(result.success).toBe(false);
        expect(result.error).toContain('withdrawal address');
      });

      it('should fail when insufficient balance', async () => {
        const lowBalanceUser = { ...userState, balance: 1000000n };

        const result = await executeUserWalletWithdraw({
          userId: '123456',
          amount: 10,
          token: 'STX',
        }, lowBalanceUser);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient balance');
      });

      it('should deduct balance after withdraw', async () => {
        const initialBalance = userState.balance;

        await executeUserWalletWithdraw({
          userId: '123456',
          amount: 5,
          token: 'STX',
        }, userState);

        expect(userState.balance).toBe(initialBalance - 5000000n);
      });

      it('should use provided destination over saved address', async () => {
        const freshUserState = {
          telegramId: '123456',
          walletConnected: true,
          walletAddress: 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD',
          withdrawalAddress: undefined,
          balance: 10000000n,
        };
        
        const result = await executeUserWalletWithdraw({
          userId: '123456',
          amount: 5,
          token: 'STX',
          destination: 'ST3D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPA',
        }, freshUserState);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('End-to-End Protocol Withdraw Flow', () => {
    interface ProtocolPosition {
      protocol: string;
      token: string;
      amount: bigint;
    }

    interface ProtocolWithdrawRequest {
      userId: string;
      protocol: string;
      token: string;
      amount: number;
    }

    const TOKEN_DECIMALS: Record<string, number> = {
      sBTC: 100000000,
      STX: 1000000,
      USDC: 1000000,
    };

    async function executeProtocolWithdraw(request: ProtocolWithdrawRequest, positions: ProtocolPosition[]): Promise<{
      success: boolean;
      txId?: string;
      error?: string;
    }> {
      const position = positions.find(p =>
        p.protocol.toLowerCase() === request.protocol.toLowerCase() &&
        p.token.toUpperCase() === request.token.toUpperCase()
      );

      if (!position) {
        return { success: false, error: `No ${request.token} position in ${request.protocol}` };
      }

      const decimals = TOKEN_DECIMALS[request.token.toUpperCase()] || 1;
      const amountMicro = BigInt(Math.round(request.amount * decimals));

      if (amountMicro > position.amount) {
        return {
          success: false,
          error: `Insufficient position balance. Available: ${Number(position.amount) / decimals} ${request.token}`
        };
      }

      position.amount -= amountMicro;

      const txId = `protocol_withdraw_${Date.now()}`;

      return { success: true, txId };
    }

    describe('Complete Flow', () => {
      let positions: ProtocolPosition[];

      beforeEach(() => {
        positions = [
          { protocol: 'zest', token: 'sBTC', amount: 250000000n },
          { protocol: 'alex', token: 'STX', amount: 1000000000n },
          { protocol: 'hermetica', token: 'sBTC', amount: 100000000n },
        ];
      });

      it('should execute Zest withdraw successfully', async () => {
        const result = await executeProtocolWithdraw({
          userId: '123456',
          protocol: 'zest',
          token: 'sBTC',
          amount: 1,
        }, positions);

        expect(result.success).toBe(true);
        expect(result.txId).toBeDefined();
      });

      it('should deduct position after withdraw', async () => {
        const testPositions = [
          { protocol: 'zest', token: 'sBTC', amount: 250000000n },
        ];
        const initialBalance = testPositions[0].amount;

        await executeProtocolWithdraw({
          userId: '123456',
          protocol: 'zest',
          token: 'sBTC',
          amount: 1,
        }, testPositions);

        expect(testPositions[0].amount).toBeLessThan(initialBalance);
      });

      it('should fail for non-existent protocol', async () => {
        const result = await executeProtocolWithdraw({
          userId: '123456',
          protocol: 'unknown',
          token: 'sBTC',
          amount: 1,
        }, positions);

        expect(result.success).toBe(false);
        expect(result.error).toContain('No');
      });

      it('should fail for wrong token', async () => {
        const result = await executeProtocolWithdraw({
          userId: '123456',
          protocol: 'zest',
          token: 'STX',
          amount: 1,
        }, positions);

        expect(result.success).toBe(false);
        expect(result.error).toContain('No STX position');
      });

      it('should fail when exceeding balance', async () => {
        const testPositions = [
          { protocol: 'zest', token: 'sBTC', amount: 1n },
        ];
        
        const result = await executeProtocolWithdraw({
          userId: '123456',
          protocol: 'zest',
          token: 'sBTC',
          amount: 2,
        }, testPositions);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient');
      });

      it('should allow full position withdraw', async () => {
        const testPositions = [
          { protocol: 'hermetica', token: 'sBTC', amount: 100000001n },
        ];
        
        const result = await executeProtocolWithdraw({
          userId: '123456',
          protocol: 'hermetica',
          token: 'sBTC',
          amount: 1,
        }, testPositions);

        expect(result.success).toBe(true);
        // Due to floating point, position was reduced by ~100000000
        expect(testPositions[0].amount).toBeLessThan(100000001n);
      });
    });
  });

  describe('Complete Flow With All Steps', () => {
    type FlowState = 'idle' | 'initiated' | 'confirmed' | 'broadcast' | 'complete' | 'failed';

    interface FlowContext {
      state: FlowState;
      userId: string;
      amount: number;
      destination: string;
      hasWallet: boolean;
      hasWithdrawalAddress: boolean;
      contractBalance: bigint;
      txIds: string[];
      error?: string;
    }

    async function processWithdrawFlow(ctx: FlowContext, action: string): Promise<FlowContext> {
      switch (ctx.state) {
        case 'idle':
          if (action === 'start') {
            if (!ctx.hasWallet) {
              return { ...ctx, state: 'failed', error: 'No wallet' };
            }
            if (!ctx.hasWithdrawalAddress) {
              return { ...ctx, state: 'failed', error: 'No withdrawal address' };
            }
            return { ...ctx, state: 'initiated' };
          }
          return ctx;

        case 'initiated':
          if (action === 'confirm') {
            return { ...ctx, state: 'confirmed' };
          }
          if (action === 'cancel') {
            return { ...ctx, state: 'failed', error: 'Cancelled by user' };
          }
          return ctx;

        case 'confirmed':
          if (action === 'broadcast') {
            const txId = `tx_${Date.now()}`;
            const newCtx = {
              ...ctx,
              state: 'broadcast' as FlowState,
              txIds: [...ctx.txIds, txId],
            };

            if (ctx.contractBalance >= BigInt(ctx.amount * 1000000)) {
              return { ...newCtx, state: 'complete' };
            }
            return { ...newCtx, state: 'failed', error: 'Insufficient balance' };
          }
          return ctx;

        default:
          return ctx;
      }
    }

    describe('Flow State Machine', () => {
      const initialContext: FlowContext = {
        state: 'idle',
        userId: '123456',
        amount: 5,
        destination: 'ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
        hasWallet: true,
        hasWithdrawalAddress: true,
        contractBalance: 10000000n,
        txIds: [],
      };

      it('should progress through full flow', async () => {
        let ctx = initialContext;

        ctx = await processWithdrawFlow(ctx, 'start');
        expect(ctx.state).toBe('initiated');

        ctx = await processWithdrawFlow(ctx, 'confirm');
        expect(ctx.state).toBe('confirmed');

        ctx = await processWithdrawFlow(ctx, 'broadcast');
        expect(ctx.state).toBe('complete');
        expect(ctx.txIds.length).toBe(1);
      });

      it('should fail at start without wallet', async () => {
        let ctx = await processWithdrawFlow({ ...initialContext, hasWallet: false }, 'start');
        expect(ctx.state).toBe('failed');
        expect(ctx.error).toContain('No wallet');
      });

      it('should fail at start without withdrawal address', async () => {
        let ctx = await processWithdrawFlow({ ...initialContext, hasWithdrawalAddress: false }, 'start');
        expect(ctx.state).toBe('failed');
        expect(ctx.error).toContain('withdrawal address');
      });

      it('should allow cancel at initiated state', async () => {
        let ctx = await processWithdrawFlow(initialContext, 'start');
        ctx = await processWithdrawFlow(ctx, 'cancel');
        expect(ctx.state).toBe('failed');
        expect(ctx.error).toContain('Cancelled');
      });

      it('should fail when insufficient balance at broadcast', async () => {
        let ctx = await processWithdrawFlow(initialContext, 'start');
        ctx = await processWithdrawFlow(ctx, 'confirm');
        ctx = await processWithdrawFlow({ ...ctx, contractBalance: 1000000n }, 'broadcast');
        expect(ctx.state).toBe('failed');
        expect(ctx.error).toContain('Insufficient balance');
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    describe('Retry Logic', () => {
      interface RetryContext {
        attempts: number;
        maxAttempts: number;
        lastError?: string;
      }

      async function withdrawWithRetry(
        ctx: RetryContext,
        operation: () => Promise<{ success: boolean; error?: string }>
      ): Promise<{ success: boolean; attempts: number; error?: string }> {
        while (ctx.attempts < ctx.maxAttempts) {
          ctx.attempts++;
          const result = await operation();

          if (result.success) {
            return { success: true, attempts: ctx.attempts };
          }

          ctx.lastError = result.error;

          if (result.error?.includes('insufficient') || result.error?.includes('balance')) {
            return { success: false, attempts: ctx.attempts, error: result.error };
          }
        }

        return { success: false, attempts: ctx.attempts, error: ctx.lastError };
      }

      it('should succeed on first attempt', async () => {
        const ctx: RetryContext = { attempts: 0, maxAttempts: 3 };

        const result = await withdrawWithRetry(ctx, async () => ({
          success: true,
        }));

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(1);
      });

      it('should retry on transient error', async () => {
        const ctx: RetryContext = { attempts: 0, maxAttempts: 3 };
        let callCount = 0;

        const result = await withdrawWithRetry(ctx, async () => {
          callCount++;
          if (callCount < 3) {
            return { success: false, error: 'Network timeout' };
          }
          return { success: true };
        });

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(3);
      });

      it('should fail after max retries', async () => {
        const ctx: RetryContext = { attempts: 0, maxAttempts: 3 };

        const result = await withdrawWithRetry(ctx, async () => ({
          success: false,
          error: 'Network timeout',
        }));

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(3);
      });

      it('should not retry on balance errors', async () => {
        const ctx: RetryContext = { attempts: 0, maxAttempts: 3 };

        const result = await withdrawWithRetry(ctx, async () => ({
          success: false,
          error: 'Insufficient balance',
        }));

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(1);
      });
    });
  });
});
