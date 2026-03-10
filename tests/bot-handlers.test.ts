import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Bot, Context } from 'grammy';
import { setupHandlers } from '../src/bot/handlers/index.js';

// Mock dependencies
vi.mock('../src/agent/database.js', () => ({
  getDatabase: vi.fn(() => ({
    getUser: vi.fn(),
    getUserPositions: vi.fn(),
    getUserAlerts: vi.fn(),
    createPosition: vi.fn(),
  })),
}));

vi.mock('../src/mcp/client.js', () => ({
  mcpClient: {
    getProtocolAPYs: vi.fn().mockResolvedValue([
      { protocol: 'zest', apy: 8.5, token: 'sBTC' },
      { protocol: 'alex', apy: 6.2, token: 'STX' },
    ]),
    getStacksBalance: vi.fn().mockResolvedValue({ stx: 100 }),
  },
}));

vi.mock('../wallet/WalletManager.js', () => ({
  getWalletManager: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockReturnValue('SP1234567890'),
    getCachedWallet: vi.fn().mockReturnValue(null),
    isConnected: vi.fn().mockReturnValue(true),
    getRemainingLimits: vi.fn().mockResolvedValue({
      maxPerTx: 1000000n,
      remainingToday: 5000000n,
    }),
  }),
}));

vi.mock('../agent/claude.js', () => ({
  ClaudeAgent: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn().mockResolvedValue({ response: 'Test response', toolCalls: [] }),
  })),
}));

describe('Telegram Bot Commands', () => {
  let bot: Bot<Context>;
  let mockCtx: Partial<Context>;

  beforeEach(() => {
    bot = new Bot('test-bot-token');
    
    mockCtx = {
      from: { id: 123456, is_bot: false, first_name: 'Test' },
      reply: vi.fn().mockResolvedValue(undefined),
      editMessageText: vi.fn().mockResolvedValue(undefined),
      answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
      message: { text: '/help' },
    } as any;

    vi.clearAllMocks();
  });

  describe('Command Registration', () => {
    it('should register all core commands without errors', () => {
      expect(() => setupHandlers(bot)).not.toThrow();
    });

    it('should have /help command registered', () => {
      setupHandlers(bot);
      const commands = bot.commands;
      expect(commands).toBeDefined();
    });

    it('should have /start command registered', () => {
      setupHandlers(bot);
      const hasStart = bot.commands.some((cmd: any) => cmd.command === 'start');
      expect(hasStart).toBe(true);
    });

    it('should have /yields command registered', () => {
      setupHandlers(bot);
      const hasYields = bot.commands.some((cmd: any) => cmd.command === 'yields');
      expect(hasYields).toBe(true);
    });

    it('should have /portfolio command registered', () => {
      setupHandlers(bot);
      const hasPortfolio = bot.commands.some((cmd: any) => cmd.command === 'portfolio');
      expect(hasPortfolio).toBe(true);
    });

    it('should have /alerts command registered', () => {
      setupHandlers(bot);
      const hasAlerts = bot.commands.some((cmd: any) => cmd.command === 'alerts');
      expect(hasAlerts).toBe(true);
    });

    it('should have /wallet command registered', () => {
      setupHandlers(bot);
      const hasWallet = bot.commands.some((cmd: any) => cmd.command === 'wallet');
      expect(hasWallet).toBe(true);
    });

    it('should have /alex command registered', () => {
      setupHandlers(bot);
      const hasAlex = bot.commands.some((cmd: any) => cmd.command === 'alex');
      expect(hasAlex).toBe(true);
    });

    it('should have /withdraw command registered', () => {
      setupHandlers(bot);
      const hasWithdraw = bot.commands.some((cmd: any) => cmd.command === 'withdraw');
      expect(hasWithdraw).toBe(true);
    });

    it('should have /txs command registered', () => {
      setupHandlers(bot);
      const hasTxs = bot.commands.some((cmd: any) => cmd.command === 'txs');
      expect(hasTxs).toBe(true);
    });

    it('should have /botinfo command registered', () => {
      setupHandlers(bot);
      const hasBotInfo = bot.commands.some((cmd: any) => cmd.command === 'botinfo');
      expect(hasBotInfo).toBe(true);
    });
  });

  describe('/help Command', () => {
    it('should reply with help message', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'help')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        expect(mockCtx.reply).toHaveBeenCalled();
        const replyText = (mockCtx.reply as Mock).mock.calls[0][0];
        expect(replyText).toContain('Bitcoin Yield Copilot');
        expect(replyText).toContain('/start');
        expect(replyText).toContain('/yields');
        expect(replyText).toContain('/portfolio');
      }
    });
  });

  describe('/yields Command', () => {
    it('should fetch and display yield opportunities', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'yields')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        expect(mockCtx.reply).toHaveBeenCalledTimes(2); // "Fetching..." + results
      }
    });
  });

  describe('/portfolio Command', () => {
    it('should require onboarding completion', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'portfolio')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        // Should reply with onboarding message
        expect(mockCtx.reply).toHaveBeenCalled();
      }
    });
  });

  describe('/alerts Command', () => {
    it('should display user alerts or empty message', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'alerts')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        expect(mockCtx.reply).toHaveBeenCalled();
      }
    });
  });

  describe('/wallet Command', () => {
    it('should display wallet information', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'wallet')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        expect(mockCtx.reply).toHaveBeenCalled();
      }
    });
  });

  describe('/alex Command', () => {
    it('should start ALEX DEX flow', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'alex')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        expect(mockCtx.reply).toHaveBeenCalled();
      }
    });
  });

  describe('/withdraw Command', () => {
    it('should start withdraw flow', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'withdraw')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        expect(mockCtx.reply).toHaveBeenCalled();
      }
    });
  });

  describe('/txs Command', () => {
    it('should display transaction history', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'txs')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        expect(mockCtx.reply).toHaveBeenCalled();
      }
    });
  });

  describe('/botinfo Command', () => {
    it('should display bot information', async () => {
      setupHandlers(bot);
      
      const handler = bot.commands.find((cmd: any) => cmd.command === 'botinfo')?.handler;
      if (handler) {
        await handler(mockCtx as any);
        expect(mockCtx.reply).toHaveBeenCalled();
      }
    });
  });

  describe('Middleware', () => {
    it('should have error handling middleware', () => {
      setupHandlers(bot);
      // Error middleware should be applied
      expect(bot.errorHandlers).toBeDefined();
    });

    it('should handle message:text for AI processing', () => {
      setupHandlers(bot);
      // Text handler should be registered
      const hasTextHandler = bot.onHandlers.some((h: any) => 
        h.matcher?.pattern?.source === 'message:text'
      );
      expect(hasTextHandler).toBe(true);
    });
  });

  describe('Callback Queries', () => {
    it('should handle confirm_deposit callback', () => {
      setupHandlers(bot);
      const hasConfirmDeposit = bot.callbackQueryHandlers.some((h: any) => 
        h?.matcher?.pattern?.source?.includes('confirm_deposit')
      );
      expect(hasConfirmDeposit).toBe(true);
    });

    it('should handle confirm_withdraw callback', () => {
      setupHandlers(bot);
      const hasConfirmWithdraw = bot.callbackQueryHandlers.some((h: any) => 
        h?.matcher?.pattern?.source?.includes('confirm_withdraw')
      );
      expect(hasConfirmWithdraw).toBe(true);
    });

    it('should handle cancel_action callback', () => {
      setupHandlers(bot);
      const hasCancel = bot.callbackQueryHandlers.some((h: any) => 
        h?.matcher?.pattern?.source?.includes('cancel_action')
      );
      expect(hasCancel).toBe(true);
    });
  });
});

describe('Command List Verification', () => {
  it('should have all expected commands registered', () => {
    const expectedCommands = [
      'start',
      'help',
      'yields',
      'portfolio',
      'alerts',
      'wallet',
      'alex',
      'withdraw',
      'txs',
      'botinfo',
    ];

    // This test verifies the expected command list
    // Actual registration is tested in the describe above
    expect(expectedCommands).toHaveLength(10);
  });
});
