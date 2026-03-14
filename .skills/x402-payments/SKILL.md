# x402-payments

> Testes e Desenvolvimento para Sistema de Pagamentos x402 no Stacks

## Overview

x402 é o protocolo de micropagamentos que permite:
- Agentes pagarem por dados (APY, preços)
- Usuários pagarem por serviços
- Molbots pagarem outros molbots

## Tipos de Pagamento Suportados

| Token | Símbolo | Decimals |
|-------|---------|----------|
| Stacks | STX | 6 |
| sBTC | sBTC | 8 |
| USDC | USDCx | 6 |

---

## Padrão de Teste TDD

### Passo 1: Teste Primeiro

```typescript
// tests/x402-client_test.ts

import { describe, it, assert, beforeEach, vi } from 'vitest';
import { X402Client } from '../src/x402/client';

describe('X402Client', () => {
  let client: X402Client;

  beforeEach(() => {
    client = new X402Client({
      facilitatorUrl: 'https://x402.testnet.alexlab.co',
      network: 'testnet',
      privateKey: 'test-private-key',
    });
  });

  describe('createPaymentRequest', () => {
    it('should create request with correct format', async () => {
      const request = await client.createPaymentRequest(
        '1000', // 0.001 STX
        'Yield data query',
        'STX',
        'SP123...456'
      );

      assert.equals(request.scheme, 'stacks-exact');
      assert.equals(request.price, '1000');
      assert.equals(request.network, 'stacks:testnet');
      assert.equals(request.payTo, 'SP123...456');
    });

    it('should support sBTC payments', async () => {
      const request = await client.createPaymentRequest(
        '100000000', // 1 sBTC
        'Premium service',
        'sBTC'
      );

      assert.equals(request.token, 'sBTC');
    });

    it('should support USDCx payments', async () => {
      const request = await client.createPaymentRequest(
        '1000000', // 1 USDCx
        'Stablecoin service',
        'USDCx'
      );

      assert.equals(request.token, 'USDCx');
    });
  });

  describe('makePayment', () => {
    it('should throw if no private key', async () => {
      const noKeyClient = new X402Client({
        facilitatorUrl: 'https://x402.testnet.alexlab.co',
        network: 'testnet',
        privateKey: '',
      });

      await assert.rejects(
        () => noKeyClient.makePayment({
          scheme: 'stacks-exact',
          price: '1000',
          network: 'stacks:testnet',
          payTo: 'SP123',
          description: 'Test',
          token: 'STX',
        }),
        /AGENT_STACKS_PRIVATE_KEY is required/
      );
    });
  });

  describe('consumePaidEndpoint', () => {
    it('should auto-pay on 402 response', async () => {
      // Mock fetch to return 402 first, then success
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            status: 402,
            json: () => Promise.resolve({
              scheme: 'stacks-exact',
              price: '1000',
              payTo: 'SP123',
            }),
          });
        }
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ data: 'result' }),
        });
      });

      const result = await client.consumePaidEndpoint('https://api.example.com/data');

      assert.equals(result.data, 'result');
    });
  });
});
```

---

## Enhanced x402 Features

### Stream Payments

```typescript
// src/x402/enhanced-client.ts

describe('EnhancedX402Client', () => {
  describe('createPaymentStream', () => {
    it('should create streaming payment setup', async () => {
      const client = new EnhancedX402Client({...});

      const stream = await client.createPaymentStream(
        'SPrecipient',      // recipient
        100n,               // 100 micro-STX per second
        'STX',              // token
        3600                // 1 hour duration
      );

      assert.exists(stream.id);
      assert.equals(stream.amountPerSecond, 100n);
      assert.equals(stream.duration, 3600);
    });
  });

  describe('createEscrow', () => {
    it('should lock funds until conditions met', async () => {
      const client = new EnhancedX402Client({...});

      const escrow = await client.createEscrow(
        'SPrecipient',
        10000n,
        'STX',
        [
          { type: 'callback', payload: 'task-completed' }
        ]
      );

      assert.exists(escrow.id);
      assert.equals(escrow.status, 'locked');
    });
  });
});
```

---

## Testes de Integração com Contrato

```typescript
// tests/x402-smart-contract_test.ts

import { Clarinet, Tx, Chain, Account, types } from "./deps.ts";

Clarinet.test({
  name: "x402: molbot payment flow",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot = accounts.get("wallet_1")!;
    const user = accounts.get("wallet_2")!;

    // 1. Register molbot in registry
    chain.mineBlock([
      Tx.contractCall("molbot-registry", "register-molbot",
        ["Yield Bot", "Desc", "yield-optimizer", types.uint(1000), types.ascii("STX")],
        molbot.address)
    ]);

    // 2. User pays molbot via x402 payment contract
    const block = chain.mineBlock([
      Tx.contractCall("molbot-payment", "pay-molbot",
        [
          molbot.address,
          types.uint(1000),
          types.ascii("STX"),
          types.buffFromHex("00112233445566778899")
        ],
        user.address
      )
    ]);

    // 3. Verify payment succeeded
    block.receipts[0].result.expectOk();

    // 4. Verify molbot received funds
    const balance = chain.callReadOnlyFn(
      "molbot-payment",
      "get-molbot-balance",
      [molbot.address]
    );
    balance.result.expectOk().expectUint(1000);
  }
});
```

---

## Mocking para Testes

```typescript
// tests/helpers/x402-mock.ts

import { vi } from 'vitest';

export function createMockX402Client() {
  return {
    createPaymentRequest: vi.fn().mockResolvedValue({
      scheme: 'stacks-exact',
      price: '1000',
      network: 'stacks:testnet',
      payTo: 'SP123',
      description: 'Test',
      token: 'STX',
    }),
    makePayment: vi.fn().mockResolvedValue({
      paymentId: 'pay_123',
      transactionHash: '0xabc',
      settled: true,
      amount: '1000',
      timestamp: Date.now(),
    }),
    verifyPayment: vi.fn().mockResolvedValue({ verified: true }),
    consumePaidEndpoint: vi.fn().mockResolvedValue({ data: 'test' }),
  };
}

// Usage in tests
vi.mock('../src/x402/client', () => ({
  X402Client: vi.fn().mockImplementation(() => createMockX402Client()),
}));
```

---

## Boas Práticas de Teste

| Prática | Descrição |
|---------|-----------|
| Teste cada token | STX, sBTC, USDCx |
| Teste erros | Payment failed, insufficient funds |
| Teste retry | Auto-retry on 402 |
| Mock rede externa | Não chame testnet real nos unit tests |
| Integração real apenas quando necessário | Marque com it.skipIf |

---

## Comandos

```bash
# Run x402 tests
npm test -- --grep "x402"

# Run with network calls (requires env)
X402_TESTNET=true npm test

# Watch mode
npm test -- --watch --grep "Payment"
```

---

## Casos de Teste

### 1. Pagamento Básico

```typescript
it('should pay 0.001 STX successfully', async () => {
  const result = await client.makePayment({
    scheme: 'stacks-exact',
    price: '1000',
    network: 'stacks:testnet',
    payTo: 'SPrecipient',
    description: 'Test payment',
    token: 'STX',
  });

  assert.exists(result.transactionHash);
});
```

### 2. Falha com Saldo Insuficiente

```typescript
it('should fail when insufficient balance', async () => {
  // Mock to return insufficient funds error
  vi.mocked(makeContractCall).mockRejectedValue(
    new Error('Insufficient funds')
  );

  await assert.rejects(
    () => client.makePayment(paymentRequest),
    /Insufficient funds/
  );
});
```

### 3. Auto-Retry em 402

```typescript
it('should retry with payment proof after 402', async () => {
  let attempts = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    attempts++;
    if (attempts === 1) {
      return { status: 402, json: () => ({ price: '1000' }) };
    }
    return { status: 200, json: () => ({ result: 'success' }) };
  });

  const result = await client.consumePaidEndpoint(url, {
    retryOn402: true,
  });

  assert.equals(attempts, 2);
});
```

### 4. Molbot Payment Flow

```typescript
it('should pay molbot and receive service', async () => {
  // 1. Get molbot info
  const molbotInfo = await registry.getMolbot(molbotAddress);

  // 2. Create and make payment
  const payment = await client.makePayment({
    scheme: 'stacks-exact',
    price: molbotInfo.pricePerCall.toString(),
    network: 'stacks:testnet',
    payTo: molbotAddress,
    description: `Service: ${taskType}`,
    token: molbotInfo.paymentToken,
  });

  // 3. Execute task with payment proof
  const result = await molbotClient.executeTask(
    molbotAddress,
    taskType,
    inputData,
    payment.transactionHash
  );

  assert.exists(result);
});
```
