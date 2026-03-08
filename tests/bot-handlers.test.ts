import { describe, it, expect, vi } from 'vitest';
import { setupHandlers } from '../src/bot/handlers/index.js';
import { Bot } from 'grammy';
import { MCPClient } from '../src/mcp/client.js';

describe('Bot Handlers', () => {
  let bot: Bot<any>;
  let mockMCPClient: any;
  let mockAuth: any;
  let mockDB: any;
  let mockClaudeAgent: any;

  beforeEach(() => {
    bot = new Bot('test_token') as any;
    
    mockMCPClient = {
      getProtocolAPYs: vi.fn(),
      getStacksBalance: vi.fn(),
      executeDeposit: vi.fn(),
      executeWithdraw: vi.fn()
    };
    
    mockAuth = {
      getSession: vi.fn(),
      startOnboarding: vi.fn(),
      updateRiskProfile: vi.fn(),
      updateAllowedTokens: vi.fn(),
      completeOnboarding: vi.fn()
    };
    
    mockDB = {
      getUser: vi.fn(),
      getUserPositions: vi.fn(),
      getUserAlerts: vi.fn(),
      createPosition: vi.fn()
    };
    
    mockClaudeAgent = {
      sendMessage: vi.fn()
    };
    
    vi.mock('../src/mcp/client.js', () => ({
      mcpClient: mockMCPClient
    }));
    
    vi.mock('../src/agent/claude.js', () => ({
      ClaudeAgent: vi.fn().mockImplementation(() => mockClaudeAgent)
    }));
    
    vi.mock('../src/agent/database.js', () => ({
      getDatabase: vi.fn().mockReturnValue(mockDB)
    }));
    
    vi.mock('../src/bot/middleware/auth.js', () => ({
      AuthMiddleware: vi.fn().mockImplementation(() => mockAuth)
    }));
    
    setupHandlers(bot);
  });

  describe('/start command', () => {
    it('should show welcome message for new users', async () => {
      mockAuth.getSession.mockReturnValueOnce(null);
      
      await bot.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123, first_name: 'Test' },
          text: '/start',
          date: Date.now()
        }
      });
      
      expect(mockAuth.startOnboarding).toHaveBeenCalledWith('123');
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Welcome to Bitcoin Yield Copilot!')
      );
    });

    it('should show dashboard for existing users', async () => {
      mockAuth.getSession.mockReturnValueOnce({
        isOnboarded: true,
        stacksAddress: 'SP123...'
      });
      
      await bot.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123, first_name: 'Test' },
          text: '/start',
          date: Date.now()
        }
      });
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Welcome back!')
      );
    });
  });

  describe('/yields command', () => {
    it('should fetch and display yields', async () => {
      mockMCPClient.getProtocolAPYs.mockResolvedValueOnce([
        { protocol: 'zest', apy: 8.2, token: 'sBTC' },
        { protocol: 'alex', apy: 11.4, token: 'sBTC/STX' }
      ]);
      
      await bot.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123 },
          text: '/yields',
          date: Date.now()
        }
      });
      
      expect(mockMCPClient.getProtocolAPYs).toHaveBeenCalled();
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Current Yield Opportunities')
      );
    });

    it('should handle MCP failures gracefully', async () => {
      mockMCPClient.getProtocolAPYs.mockRejectedValueOnce(new Error('MCP error'));
      
      await bot.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123 },
          text: '/yields',
          date: Date.now()
        }
      });
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Could not fetch APYs')
      );
    });
  });

  describe('Portfolio handling', () => {
    it('should show portfolio with positions', async () => {
      mockAuth.getSession.mockReturnValueOnce({
        isOnboarded: true,
        stacksAddress: 'SP123...'
      });
      mockDB.getUser.mockReturnValueOnce({ id: 1 });
      mockDB.getUserPositions.mockReturnValueOnce([
        { protocol: 'zest', amount: 0.5, token: 'sBTC', apy: 8.2 }
      ]);
      
      await bot.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123 },
          text: '/portfolio',
          date: Date.now()
        }
      });
      
      expect(mockDB.getUserPositions).toHaveBeenCalled();
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Your Portfolio')
      );
    });

    it('should show empty portfolio message', async () => {
      mockAuth.getSession.mockReturnValueOnce({
        isOnboarded: true,
        stacksAddress: 'SP123...'
      });
      mockDB.getUser.mockReturnValueOnce({ id: 1 });
      mockDB.getUserPositions.mockReturnValueOnce([]);
      
      await bot.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123 },
          text: '/portfolio',
          date: Date.now()
        }
      });
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('No active positions')
      );
    });
  });

  describe('AI message handler', () => {
    it('should handle user messages with AI', async () => {
      mockAuth.getSession.mockReturnValueOnce({
        isOnboarded: true,
        stacksAddress: 'SP123...',
        riskProfile: 'moderate',
        allowedTokens: ['sBTC']
      });
      mockDB.getUser.mockReturnValueOnce({ id: 1 });
      mockDB.getUserPositions.mockReturnValueOnce([]);
      mockClaudeAgent.sendMessage.mockResolvedValueOnce({
        response: 'I can help you with that!',
        toolCalls: []
      });
      
      await bot.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123 },
          text: 'Show me yields',
          date: Date.now()
        }
      });
      
      expect(mockClaudeAgent.sendMessage).toHaveBeenCalled();
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('I can help you with that!')
      );
    });
  });

  describe('Deposit/Withdraw callbacks', () => {
    it('should handle deposit confirmation', async () => {
      mockAuth.getSession.mockReturnValueOnce({
        isOnboarded: true,
        stacksAddress: 'SP123...'
      });
      mockMCPClient.executeDeposit.mockResolvedValueOnce({
        txId: 'tx123',
        contractCall: {}
      });
      mockDB.getUser.mockReturnValueOnce({ id: 1 });
      
      await bot.handleUpdate({
        update_id: 1,
        callback_query: {
          id: 'cb123',
          data: 'confirm_deposit_zest_0.1',
          message: { message_id: 1, chat: { id: 123 } },
          from: { id: 123 }
        }
      });
      
      expect(mockMCPClient.executeDeposit).toHaveBeenCalledWith(
        'zest', 'sBTC', '0.1', 'SP123...'
      );
      expect(mockDB.createPosition).toHaveBeenCalled();
    });
  });
});