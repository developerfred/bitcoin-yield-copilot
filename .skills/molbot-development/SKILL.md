# molbot-development

> Desenvolvimento de Molbots - Registro, Discovery e Pagamentos

## Overview

Molbots são agentes autônomos que podem ser contratados para serviços específicos usando x402. O Bitcoin Yield Copilot será um molbot que oferece serviços de yield management.

## Arquitetura

```
┌─────────────┐     x402      ┌─────────────┐
│  Molbot A   │ ◄──────────── │  Molbot B   │
│ (Caller)    │   Payment    │ (Provider)  │
└──────┬──────┘              └─────────────┘
       │
       │ Register
       ▼
┌─────────────┐
│  Registry   │
│  Contract   │
└─────────────┘
```

## Tipos de Molbot

| Capability | Descrição | Exemplo |
|------------|-----------|---------|
| `yield-optimizer` | Otimização de yield | "Where should I put my sBTC?" |
| `portfolio-manager` | Gestão de portfólio | Rebalancear posições |
| `risk-assessor` | Análise de risco | "Is this protocol safe?" |
| `data-analyst` | Análise de dados | "What's the TVL trend?" |
| `content-generator` | Geração de conteúdo | Relatórios |
| `swap-executor` | Execução de swaps | Trocar tokens |

---

## Desenvolvimento TDD

### Passo 1: Defina o Contrato de Serviço

```typescript
// src/molbot/types.ts

export interface MolbotService {
  address: string;
  name: string;
  description: string;
  capability: string;
  pricePerCall: bigint;
  paymentToken: 'STX' | 'sBTC' | 'USDCx';
}

export interface MolbotTask {
  id: string;
  requester: string;
  molbot: string;
  serviceType: string;
  inputData: Record<string, any>;
  paymentAmount: bigint;
  status: 'pending' | 'completed' | 'failed';
}
```

### Passo 2: Escreva o Teste

```typescript
// tests/molbot-client_test.ts

import { describe, it, assert, beforeEach } from 'vitest';
import { MolbotClient } from '../src/molbot/client';

describe('MolbotClient', () => {
  let client: MolbotClient;

  beforeEach(() => {
    client = new MolbotClient({
      registryAddress: 'ST1molbot-registry',
      paymentAddress: 'ST1molbot-payment',
      agentPrivateKey: 'test-key',
    });
  });

  describe('registerService', () => {
    it('should register yield optimizer service', async () => {
      const result = await client.registerService(
        'Bitcoin Yield Copilot',
        'Autonomous yield management for Bitcoin on Stacks',
        ['yield-optimizer', 'risk-assessor'],
        1000n, // 0.001 STX per call
        'STX'
      );

      assert.isTrue(result);
    });

    it('should fail if already registered', async () => {
      // Register first time
      await client.registerService(
        'Bot', 'Desc', ['yield-optimizer'], 1000n, 'STX'
      );

      // Try to register again
      const result = await client.registerService(
        'Bot 2', 'Desc 2', ['yield-optimizer'], 2000n, 'STX'
      );

      assert.isFalse(result);
    });
  });

  describe('executeTask', () => {
    it('should execute yield optimization task', async () => {
      const result = await client.executeTask(
        'SPtarget123',
        'yield-optimization',
        {
          amount: '100000000', // 1 sBTC
          tokens: ['sBTC'],
          riskProfile: 'moderate',
        }
      );

      assert.exists(result.protocol);
      assert.exists(result.apy);
    });
  });

  describe('findByCapability', () => {
    it('should find yield optimizer bots', async () => {
      const bots = await client.findByCapability('yield-optimizer');

      assert.isArray(bots);
      bots.forEach(bot => {
        assert.equals(bot.capability, 'yield-optimizer');
      });
    });
  });
});
```

### Passo 3: Implemente

```typescript
// src/molbot/client.ts

export class MolbotClient {
  private registryAddress: string;
  private paymentAddress: string;
  private agentPrivateKey: string;

  constructor(options: {...}) {
    this.registryAddress = options.registryAddress;
    this.paymentAddress = options.paymentAddress;
    this.agentPrivateKey = options.agentPrivateKey;
  }

  async registerService(
    name: string,
    description: string,
    capabilities: string[],
    pricePerCall: bigint,
    paymentToken: 'STX' | 'sBTC' | 'USDCx'
  ): Promise<boolean> {
    // Call registry contract
    // Return success/failure
  }

  async executeTask(
    targetMolbot: string,
    taskType: string,
    inputData: Record<string, any>
  ): Promise<any> {
    // 1. Get molbot info from registry
    // 2. Create payment via x402
    // 3. Execute task
    // 4. Return result
  }

  async findByCapability(capability: string): Promise<MolbotService[]> {
    // Query registry
  }
}
```

---

## Smart Contract (Registry)

```clarity
;; contracts/molbot-registry.clar

(define-map molbots
  principal
  {
    name: (string-ascii 64),
    description: (string-ascii 256),
    capability: (string-ascii 32),
    price-per-call: uint,
    payment-token: (string-ascii 8),
    active: bool,
    owner: principal,
    registered-at: uint
  }
)

(define-public (register-molbot
    (name (string-ascii 64))
    (description (string-ascii 256))
    (capability (string-ascii 32))
    (price-per-call uint)
    (payment-token (string-ascii 8))
  )
  (begin
    (asserts! (is-none (map-get? molbots tx-sender)) ERR-ALREADY-REGISTERED)
    (map-set molbots tx-sender {
      name: name,
      description: description,
      capability: capability,
      price-per-call: price-per-call,
      payment-token: payment-token,
      active: true,
      owner: tx-sender,
      registered-at: stacks-block-height
    })
    (ok true)
  )
)
```

---

## Fluxo de Pagamento

```
1. Caller encontra molbot via registry
2. Caller verifica preço e capability
3. Caller cria payment request via x402
4. Caller executa pagamento
5. Caller envia task com payment proof
6. Molbot processa task
7. Molbot retorna resultado
8. Caller confirma completion
```

---

## Exemplo: Bitcoin Yield Copilot como Molbot

```typescript
// O Copilot se registra como molbot
await molbotClient.registerService(
  'Bitcoin Yield Copilot',
  'Autonomous yield management for Bitcoin on Stacks. ' +
  'Deposit, withdraw, and optimize your sBTC yield across Zest, ALEX, Hermetica.',
  ['yield-optimizer', 'portfolio-manager', 'risk-assessor'],
  1000n, // 0.001 STX per call
  'STX'
);

// Outros agentes podem chamar o Copilot
const result = await molbotClient.executeTask(
  COPILOT_ADDRESS,
  'yield-optimization',
  {
    amount: '100000000', // 1 sBTC
    tokens: ['sBTC'],
    riskProfile: 'moderate',
  }
);
```

---

## Boas Práticas

| Prática | Descrição |
|---------|-----------|
| Capabilidade única | Cada molbot deve ser especialista |
| Preço justo | Comece baixo, ajuste baseado em demanda |
| Feedback rápido | Responda em segundos |
| Logging | Registre todas as tasks para debug |
| Error handling | Retorne erros claros |

---

## Testes de Integração

```typescript
// tests/molbot-integration_test.ts

describe('Molbot Integration', () => {
  it('full flow: find, pay, execute', async () => {
    // 1. Provider registers
    await providerClient.registerService(
      'Yield Expert',
      'Expert yield advice',
      ['yield-optimizer'],
      2000n,
      'STX'
    );

    // 2. Requester finds provider
    const bots = await requesterClient.findByCapability('yield-optimizer');
    const provider = bots[0];

    // 3. Requester executes task
    const result = await requesterClient.executeTask(
      provider.address,
      'yield-optimization',
      { amount: '50000000', tokens: ['sBTC'] }
    );

    // 4. Verify result
    assert.exists(result.protocol);
  });
});
```
