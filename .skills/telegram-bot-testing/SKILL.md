# telegram-bot-testing

> Comprehensive testing patterns for Grammy.js Telegram bots with Vitest

## Overview

This skill provides testing patterns, best practices, and utilities for testing Telegram bots built with Grammy.js framework. It covers command handlers, callback queries, error scenarios, AI integration, and mocking strategies.

## Core Testing Concepts

### Test Pyramid for Telegram Bots
```
┌─────────────────────────────────────────────────────────┐
│         E2E Tests (5-10%)                               │
│   Full bot flows with minimal mocking                   │
├─────────────────────────────────────────────────────────┤
│       Integration Tests (15-20%)                        │
│   Bot + external services (MCP, APIs, DB)              │
├─────────────────────────────────────────────────────────┤
│      Unit Tests (70-80%)                                │
│   Individual handlers, middleware, utilities            │
└─────────────────────────────────────────────────────────┘
```

## Testing Patterns

### 1. Mocking Grammy Bot

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import { setupHandlers } from '../src/bot/handlers/index.js';

describe('Bot Handlers', () => {
  let bot: Bot<any>;
  
  beforeEach(() => {
    bot = new Bot('test_token') as any;
    // Mock bot.sendMessage
    bot.sendMessage = vi.fn();
    // Mock bot.answerCallbackQuery
    bot.answerCallbackQuery = vi.fn();
    
    setupHandlers(bot);
  });
  
  it('should handle /start command', async () => {
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
      123,
      expect.stringContaining('Welcome')
    );
  });
});
```

### 2. Testing Command Handlers

**Patterns for different command types:**

```typescript
describe('Command Handlers', () => {
  // Basic command
  describe('/start', () => {
    it('shows welcome for new users', async () => {
      // Test new user flow
    });
    
    it('shows dashboard for existing users', async () => {
      // Test returning user flow
    });
  });
  
  // Data fetching command
  describe('/yields', () => {
    it('fetches and displays yields', async () => {
      // Mock external API
      mockMCP.getProtocolAPYs.mockResolvedValue([
        { protocol: 'zest', apy: 8.2 }
      ]);
      
      await triggerCommand('/yields');
      
      expect(mockMCP.getProtocolAPYs).toHaveBeenCalled();
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Current Yield Opportunities')
      );
    });
    
    it('handles API failures gracefully', async () => {
      mockMCP.getProtocolAPYs.mockRejectedValue(new Error('API error'));
      
      await triggerCommand('/yields');
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Could not fetch')
      );
    });
  });
  
  // Stateful command
  describe('/portfolio', () => {
    it('shows portfolio with positions', async () => {
      // Mock database responses
      mockDB.getUserPositions.mockReturnValue([
        { protocol: 'zest', amount: 0.5, apy: 8.2 }
      ]);
      
      await triggerCommand('/portfolio');
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Your Portfolio')
      );
    });
    
    it('shows empty portfolio message', async () => {
      mockDB.getUserPositions.mockReturnValue([]);
      
      await triggerCommand('/portfolio');
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('No active positions')
      );
    });
  });
});
```

### 3. Testing Callback Queries

```typescript
describe('Callback Query Handlers', () => {
  it('handles deposit confirmation', async () => {
    await bot.handleUpdate({
      update_id: 1,
      callback_query: {
        id: 'cb123',
        data: 'confirm_deposit_zest_0.1',
        message: { message_id: 1, chat: { id: 123 } },
        from: { id: 123 }
      }
    });
    
    expect(mockMCP.executeDeposit).toHaveBeenCalledWith(
      'zest', 'sBTC', '0.1', 'SP123...'
    );
    expect(bot.answerCallbackQuery).toHaveBeenCalledWith('cb123');
  });
  
  it('handles cancel action', async () => {
    await bot.handleUpdate({
      update_id: 1,
      callback_query: {
        id: 'cb456',
        data: 'cancel_deposit',
        message: { message_id: 2, chat: { id: 123 } },
        from: { id: 123 }
      }
    });
    
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Cancelled')
    );
  });
});
```

### 4. Testing AI Message Processing

```typescript
describe('AI Message Handler', () => {
  it('processes natural language messages', async () => {
    mockClaudeAgent.sendMessage.mockResolvedValue({
      response: 'I found 3 yield opportunities...',
      toolCalls: []
    });
    
    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123 },
        text: 'Show me the best yields',
        date: Date.now()
      }
    });
    
    expect(mockClaudeAgent.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Show me the best yields',
        userId: '123'
      })
    );
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('I found')
    );
  });
  
  it('executes tool calls from AI responses', async () => {
    mockClaudeAgent.sendMessage.mockResolvedValue({
      response: 'Fetching yields...',
      toolCalls: [{
        toolName: 'getProtocolAPYs',
        arguments: {}
      }]
    });
    
    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123 },
        text: 'What are current yields?',
        date: Date.now()
      }
    });
    
    expect(mockMCP.getProtocolAPYs).toHaveBeenCalled();
  });
});
```

### 5. Error Scenario Testing

```typescript
describe('Error Scenarios', () => {
  it('handles unauthorized access', async () => {
    mockAuth.getSession.mockReturnValue(null);
    
    await triggerCommand('/portfolio');
    
    expect(bot.sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Please start with /start')
    );
  });
  
  it('handles database connection errors', async () => {
    mockDB.getUser.mockRejectedValue(new Error('DB connection failed'));
    
    await triggerCommand('/portfolio');
    
    expect(bot.sendMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Technical difficulty')
    );
  });
  
  it('handles invalid callback data', async () => {
    await bot.handleUpdate({
      update_id: 1,
      callback_query: {
        id: 'cb999',
        data: 'invalid_action_xyz',
        message: { message_id: 1, chat: { id: 123 } },
        from: { id: 123 }
      }
    });
    
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('Invalid action')
    );
  });
});
```

## Mocking Strategies

### Dependency Mocking Structure

```typescript
// Common mocks for bot tests
let mockMCP: any;
let mockAuth: any;
let mockDB: any;
let mockClaudeAgent: any;

beforeEach(() => {
  // MCP Client
  mockMCP = {
    getProtocolAPYs: vi.fn(),
    executeDeposit: vi.fn(),
    executeWithdraw: vi.fn(),
    getStacksBalance: vi.fn()
  };
  
  // Auth Middleware
  mockAuth = {
    getSession: vi.fn(),
    startOnboarding: vi.fn(),
    updateRiskProfile: vi.fn(),
    completeOnboarding: vi.fn()
  };
  
  // Database
  mockDB = {
    getUser: vi.fn(),
    getUserPositions: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn()
  };
  
  // Claude Agent
  mockClaudeAgent = {
    sendMessage: vi.fn(),
    processToolCalls: vi.fn()
  };
  
  // Setup vi.mock for imports
  vi.mock('../src/mcp/client.js', () => ({
    mcpClient: mockMCP
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
});
```

### Test Data Factories

```typescript
// test-helpers/factories.ts
export const createUser = (overrides = {}) => ({
  id: 1,
  telegramId: '123',
  stacksAddress: 'SP123...',
  riskProfile: 'moderate',
  allowedTokens: ['sBTC'],
  isOnboarded: true,
  createdAt: new Date(),
  ...overrides
});

export const createPosition = (overrides = {}) => ({
  id: 1,
  userId: 1,
  protocol: 'zest',
  amount: 0.5,
  token: 'sBTC',
  apy: 8.2,
  createdAt: new Date(),
  ...overrides
});

export const createProtocolAPY = (overrides = {}) => ({
  protocol: 'zest',
  apy: 8.2,
  token: 'sBTC',
  tvl: 1000000,
  risk: 'low',
  ...overrides
});
```

## Test Coverage Goals

### Minimum Test Coverage
- **Command Handlers**: 100% (all commands tested)
- **Callback Handlers**: 100% (all callback actions tested)
- **AI Integration**: Critical paths only
- **Error Scenarios**: All documented error cases

### Test Categories to Implement
1. **Unit Tests**: Individual handler functions
2. **Integration Tests**: Handler + dependencies
3. **E2E Tests**: Full bot flows (limited scope)
4. **Performance Tests**: Response time benchmarks
5. **Security Tests**: Auth, validation, input sanitization

## Common Test Utilities

### Helper Functions
```typescript
// test-helpers/bot.ts
export const triggerCommand = async (bot: Bot<any>, command: string, userId = '123') => {
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: userId, first_name: 'Test' },
      text: command,
      date: Date.now()
    }
  });
};

export const triggerCallback = async (bot: Bot<any>, callbackData: string, userId = '123') => {
  await bot.handleUpdate({
    update_id: 1,
    callback_query: {
      id: `cb_${Date.now()}`,
      data: callbackData,
      message: { message_id: 1, chat: { id: userId } },
      from: { id: userId }
    }
  });
};
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Bot Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      
      - run: npm ci
      - run: npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Best Practices

### DOs
✅ **Mock external APIs** to avoid network dependencies
✅ **Test error scenarios** comprehensively
✅ **Use test data factories** for consistent test data
✅ **Test callback query parsing** edge cases
✅ **Verify bot.sendMessage** calls with appropriate content
✅ **Test authentication flows** for all commands

### DON'Ts
❌ **Don't test Telegram API directly** (use mocks)
❌ **Don't skip error scenario testing**
❌ **Don't rely on real external services**
❌ **Don't test implementation details** (focus on behavior)
❌ **Don't create flaky tests** with timing dependencies

## Example Test Suite Structure

```
tests/
├── bot/
│   ├── handlers/
│   │   ├── start.test.ts           # /start command tests
│   │   ├── yields.test.ts          # /yields command tests
│   │   ├── portfolio.test.ts       # /portfolio command tests
│   │   ├── deposit.test.ts         # /deposit command tests
│   │   └── withdraw.test.ts        # /withdraw command tests
│   ├── callbacks/
│   │   ├── deposit-callback.test.ts # Deposit confirmation tests
│   │   └── withdraw-callback.test.ts # Withdraw confirmation tests
│   ├── ai/
│   │   └── message-handler.test.ts  # AI message processing tests
│   └── middleware/
│       ├── auth.test.ts            # Authentication middleware tests
│       └── error-handler.test.ts   # Error middleware tests
├── helpers/
│   ├── factories.ts                # Test data factories
│   └── bot.ts                     # Bot testing utilities
└── integration/
    └── bot-flow.test.ts           # End-to-end flow tests
```

## Debugging Tips

1. **Console.log in tests**: Use `console.log` to debug complex test scenarios
2. **Vitest UI**: Run `vitest --ui` for interactive test debugging
3. **Test isolation**: Ensure tests don't share state between runs
4. **Mock verification**: Check if mocks were called with correct arguments
5. **Update simulation**: Create realistic Telegram update objects

## References

- [Grammy.js Documentation](https://grammy.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Telegram Bots Guide](https://core.telegram.org/bots/testing)
- [Mock Functions in Vitest](https://vitest.dev/guide/mocking.html)