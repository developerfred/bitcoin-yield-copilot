# tdd-typescript

> Test-Driven Development para código TypeScript usando Vitest

## Overview

Esta skill define o fluxo TDD para código TypeScript do projeto.

## Configuração

O projeto usa Vitest para testes:

```bash
# Install dependencies
npm install

# Run tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

## Estrutura de Testes

```
src/
├── module/
│   ├── index.ts
│   └── __tests__/
│       └── module.test.ts
```

Ou:

```
tests/
└── module.test.ts
```

---

## Padrões de Teste

### Teste de Função Pura

```typescript
import { describe, it, assert } from 'vitest';
import { calculateNetApy } from '../src/agent/strategy';

describe('YieldStrategy', () => {
  describe('calculateNetApy', () => {
    it('should calculate net APY after fees', () => {
      const result = calculateNetApy(8.5, 0.1, 0.01);
      
      assert.equals(result, 8.39);
    });

    it('should return 0 for negative APY', () => {
      const result = calculateNetApy(0.05, 0.1, 0.01);
      
      assert.equals(result, 0);
    });
  });
});
```

### Teste de Classe

```typescript
import { describe, it, assert, beforeEach } from 'vitest';
import { MolbotClient } from '../src/molbot/client';

describe('MolbotClient', () => {
  let client: MolbotClient;

  beforeEach(() => {
    client = new MolbotClient({
      registryAddress: 'ST123',
      paymentAddress: 'ST456',
      agentPrivateKey: 'test-key',
    });
  });

  describe('registerService', () => {
    it('should register successfully', async () => {
      const result = await client.registerService(
        'Test Bot',
        'Description',
        ['yield-optimizer'],
        1000n,
        'STX'
      );

      assert.isTrue(result);
    });
  });
});
```

### Teste de Mock

```typescript
import { describe, it, assert, vi } from 'vitest';
import { YieldDataFeed } from '../src/x402/data-feeds';

describe('YieldDataFeed', () => {
  it('should fallback to free data when payment fails', async () => {
    // Mock x402 client to throw
    vi.mock('../src/x402/client', () => ({
      x402Client: {
        getPaidAPYData: vi.fn().mockRejectedValue(new Error('Payment failed')),
      },
    }));

    const feed = new YieldDataFeed();
    const result = await feed.getOptimalData(1000n);

    // Should return free data
    assert.isArray(result);
    assert.isTrue(result.length > 0);
  });
});
```

### Teste de Integração API

```typescript
import { describe, it, assert } from 'vitest';
import { X402Client } from '../src/x402/client';

describe('X402Client (Integration)', () => {
  const client = new X402Client({
    network: 'testnet',
    facilitatorUrl: 'https://x402.testnet.alexlab.co',
  });

  it('should create valid payment request', async () => {
    const request = await client.createPaymentRequest(
      '1000',
      'Test payment',
      'STX',
      'SP123...456'
    );

    assert.equals(request.scheme, 'stacks-exact');
    assert.equals(request.price, '1000');
    assert.equals(request.token, 'STX');
  });

  // Skip in CI if no testnet credentials
  it.skipIf(!process.env.AGENT_STACKS_PRIVATE_KEY)(
    'should make actual payment',
    async () => {
      const request = await client.createPaymentRequest(
        '100',
        'Test',
        'STX',
        'SP2TEST...'
      );

      const result = await client.makePayment(request);
      
      assert.exists(result.transactionHash);
    }
  );
});
```

---

## Testes de Handlers de Bot

```typescript
import { describe, it, assert, vi, beforeEach } from 'vitest';
import { handleYieldsCommand } from '../src/bot/handlers/index';

describe('Bot Handlers', () => {
  const mockCtx = {
    reply: vi.fn(),
    from: { id: 12345 },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/yields command', () => {
    it('should return yield opportunities', async () => {
      // Mock MCP client
      vi.mock('../src/mcp/client', () => ({
        mcpClient: {
          getProtocolAPYs: vi.fn().mockResolvedValue([
            { protocol: 'zest', apy: 8.2, token: 'sBTC' },
            { protocol: 'alex', apy: 11.4, token: 'sBTC' },
          ]),
        },
      }));

      await handleYieldsCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Zest')
      );
    });
  });
});
```

---

## Boas Práticas

| Prática | Descrição |
|---------|-----------|
| Nome descritivo | "should return yield data when premium enabled" |
| Arrange-Act-Assert | Setup → Execute → Verify |
| Um expect por teste | Mais fácil de debugar |
| Use describe para agrupar | Por módulo/função |
| Use beforeEach para reset | Estado limpo entre testes |
| Mock dependências externas | Não chamar APIs reais nos testes |
| Teste edge cases | null, undefined, zero, negativo |

---

## Executando Testes

```bash
# All tests
npm test

# Specific file
npm test -- src/agent/strategy.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Run tests matching pattern
npm test -- --grep "MolbotClient"

# CI mode (no watch)
CI=true npm test
```

---

## Mocks Úteis

```typescript
// tests/helpers/mocks.ts

export const mockWallet = {
  address: 'ST1234567890',
  contractAddress: 'ST1234567890.user-wallet',
};

export const mockUser = {
  id: 12345,
  telegramHash: 'abc123',
  riskProfile: 'moderate',
  allowedTokens: ['sBTC', 'STX'],
};

export function createMockContext(overrides = {}) {
  return {
    reply: vi.fn(),
    from: { id: 12345, username: 'testuser' },
    message: { text: '/start' },
    ...overrides,
  };
}
```
