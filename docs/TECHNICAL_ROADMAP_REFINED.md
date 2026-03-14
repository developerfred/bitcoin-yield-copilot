# 🎯 Roadmap Técnico Refinado - Bitcoin Yield Copilot

## Princípios Fundamentais

O Bitcoin Yield Copilot deve permanecer:
- ✅ **Simples para o usuário comum** - "Put my sBTC to work"
- ✅ **Seguro por design** - smart contract wallet com limites
- ✅ **Orientado a yield** - foco em renderizar Bitcoin
- ✅ **Autônomo** - toma decisões baseadas em dados pagos via x402

Os molbots são uma **funcionalidade adicional** que:
- Permite que o próprio Copilot seja um "molbot" que oferece serviços
- Possibilita revenue stream via x402
- Adiciona valor ao usuário (ex: contratar yield strategist especializado)

---

## 🔄 Arquitetura Refinada

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER (Telegram)                              │
│         "Put my sBTC to work" → Bot executa deposit            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│              BITCOIN YIELD COPILOT (Main Agent)                  │
│  • Gerencia yield do usuário                                    │
│  • Pode contratar molbots especializados (ex: yield optimizer)  │
│  • Ganha revenue oferecendo serviços via x402                  │
│  • Tem ERC-8004 identity                                        │
└──────┬──────────────────────────┬──────────────────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼─────────────────────────────┐
│  x402 Data  │          │    Molbot Marketplace (EXTENSÃO)      │
│  Endpoints  │          │  • Copilot = molbot de yield          │
│  (paid API) │          │  • Yield Strategist molbot            │
│  sBTC/STX    │          │  • Content Generator molbot          │
└─────────────┘          │  • Users podem contratar serviços     │
                         └────────────────────────────────────────┘
```

---

## 📦 FASE 1: CORE - Manter e Melhorar (Semanas 1-2)

### 1.1 Funcionalidades Core (Manter)

| Funcionalidade | Status | Ação |
|----------------|--------|------|
| Telegram bot | ✅ Existe | Manter |
| Yield discovery | ✅ Existe | Melhorar com dados reais via x402 |
| Deposit/Withdraw | ✅ Existe | Testar completamente |
| Smart contracts | ⚠️ Parcial | Completar adapters |
| ERC-8004 | ❌ Falta | Implementar |
| x402 payments | ⚠️ Básico | Enhancer |

### 1.2 Melhorias Imediatas

```typescript
// src/agent/erc8004.ts - ERC-8004 Identity para o Copilot

import { getAddressFromPrivateKey } from '@stacks/transactions';

export interface AgentIdentity {
  address: string;
  domain: string;        // "bitcoin-yield.com"
  timestamp: number;
  capabilities: string[];
}

export async function registerERC8004Identity(
  privateKey: string,
  domain: string,
  capabilities: string[]
): Promise<AgentIdentity> {
  // Registrar identidade on-chain
}

export async function signAction(
  privateKey: string,
  action: string,
  params: any
): Promise<{ signature: string; identity: AgentIdentity }> {
  // Assinar ação com identidade do agente
}
```

### 1.3 Enhanced x402 para Dados

```typescript
// src/x402/data-feeds.ts - Dados pagos para decisões de yield

export interface YieldData {
  protocol: string;
  apy: number;
  tvl: number;
  updatedAt: number;
}

export class YieldDataFeed {
  // Fonte gratuita (fallback)
  async getFreeData(): Promise<YieldData[]>
  
  // Fonte paga (x402) - dados mais precisos
  async getPremiumData(): Promise<YieldData[]>
  
  // Decidir dinamicamente baseado no valor em jogo
  async getOptimalData(stakeAmount: bigint): Promise<YieldData[]>
}
```

---

## 📦 FASE 2: MOLBOTS COMO EXTENSÃO (Semanas 2-3)

### 2.1 O Copilot é um Molbot

O Bitcoin Yield Copilot **é** um molbot que oferece serviços de yield:

```typescript
// src/molbot/copilot-service.ts

export const COPILOT_CAPABILITIES = {
  YIELD_OPTIMIZATION: 'yield-optimizer',
  PORTFOLIO_MANAGEMENT: 'portfolio-manager',
  RISK_ASSESSMENT: 'risk-assessor',
  STRATEGY_RECOMMENDATION: 'strategy-advisor',
};

// O Copilot se registra como molbot
export async function registerCopilotAsMolbot() {
  const molbotClient = new MolbotClient({...});
  
  await molbotClient.registerService({
    name: 'Bitcoin Yield Copilot',
    description: 'Autonomous yield management for Bitcoin on Stacks',
    capabilities: [
      COPILOT_CAPABILITIES.YIELD_OPTIMIZATION,
      COPILOT_CAPABILITIES.RISK_ASSESSMENT,
    ],
    pricePerCall: 1000n, // 0.001 STX per call
    paymentToken: 'STX',
  });
}

// Outros molbots podem chamar o Copilot
export async function handleMolbotRequest(request: MolbotTask) {
  switch (request.serviceType) {
    case 'yield-optimization':
      return await optimizeYield(request.inputData);
    case 'risk-assessment':
      return await assessRisk(request.inputData);
  }
}
```

### 2.2 Molbot Registry (Contrato)

```clarity
;; molbot-registry.clar
;; Registro simples - focado em permitir que o Copilot seja descobert

(define-map registered-molbots
  principal
  {
    name: (string-ascii 64),
    description: (string-ascii 256),
    capability: (string-ascii 32),  ;; "yield-optimizer", "data-analyst", etc.
    price-per-call: uint,
    payment-token: (string-ascii 8),
    active: bool,
    owner: principal
  }
)

;; Molbot registration - simples e direto
(define-public (register-molbot
    (name (string-ascii 64))
    (description (string-ascii 256))
    (capability (string-ascii 32))
    (price-per-call uint)
    (payment-token (string-ascii 8))
  )
  (begin
    (map-set registered-molbots tx-sender {
      name: name,
      description: description,
      capability: capability,
      price-per-call: price-per-call,
      payment-token: payment-token,
      active: true,
      owner: tx-sender
    })
    (ok true)
  )
)
```

---

## 📦 FASE 3: USDCx INTEGRATION (Semanas 3-4)

### 3.1 Adicionar USDCx como Opção de Yield

O usuário pode escolher renderizar em **sBTC OU USDCx**:

```typescript
// src/agent/yield-manager.ts

export type YieldToken = 'sBTC' | 'USDCx' | 'STX';

export interface YieldPosition {
  token: YieldToken;
  protocol: string;
  amount: bigint;
  apy: number;
}

export class YieldManager {
  // Encontrar melhores oportunidades para QUALQUER token
  async findBestOpportunities(
    amount: bigint,
    tokens: YieldToken[]  // ['sBTC', 'USDCx']
  ): Promise<YieldPosition[]>
  
  // Exemplo de resposta do bot:
  // "Encontrei 3 opções:
  //  1. Zest (sBTC) - 8.2% APY
  //  2. ALEX USDCx/STX - 5.5% APY  
  //  3. Hermetica (sBTC) - 6.1% APY
  //  Qual prefere?"
}
```

### 3.2 USDCx Adapter (Smart Contract)

```clarity
;; usdcx-adapter.clar
;; Permite que a user-wallet interaja com pools USDCx

(impl-trait .adapter-trait.adapter-trait)

(define-constant ALEX-USDCX-POOL 'SP...alex-usdcx-pool)

(define-public (execute (amount uint) (action (string-ascii 16)))
  (if (is-eq action "deposit")
    (begin
      ;; Deposit USDCx to ALEX pool
      (as-contract (contract-call! ALEX-USDCX-POOL add-liquidity amount))
      (ok { amount: amount, allocated: amount })
    )
    (if (is-eq action "withdraw")
      (begin
        ;; Withdraw from pool
        (as-contract (contract-call! ALEX-USDCX-POOL remove-liquidity amount))
        (ok { amount: amount, allocated: u0 })
      )
      (err u400)
    )
  )
)
```

---

## 📦 FASE 4: REVENUE STREAM (Semanas 4-5)

### 4.1 Copilot Ganha Revenue

O Copilot pode cobrar pelo serviço:

```typescript
// src/agent/revenue.ts

export interface ServiceFee {
  type: 'percentage' | 'fixed';
  amount: number; // percentage (0.01 = 1%) or fixed in micro-STX
}

export const FEES = {
  YIELD_OPTIMIZATION: { type: 'percentage', amount: 0.005 }, // 0.5% do yield
  STRATEGY_ADVICE: { type: 'fixed', amount: 1000n }, // 0.001 STX
  EMERGENCY_WITHDRAWAL: { type: 'fixed', amount: 5000n }, // 0.005 STX
};

// O Copilot cobra via x402 por decisões de yield
export async function chargeForService(
  userId: string,
  serviceType: string,
  yieldAmount: bigint
): Promise<void> {
  const fee = calculateFee(serviceType, yieldAmount);
  await x402Client.makePayment({
    amount: fee,
    description: `Yield ${serviceType} service`,
    token: 'STX',
    recipient: COPILOT_ADDRESS,
  });
}
```

### 4.2 x402 Enhanced

```typescript
// src/x402/micropayments.ts

export class MicropaymentManager {
  // Cobrar pequenas quantias por serviços
  async chargeForYieldDecision(
    userAddress: string,
    apyData: number,
    recommendedProtocol: string
  ): Promise<void> {
    // Cobrar 0.0001 STX por decisão de yield
    // Isso é quase de graça mas gera revenue no volume
  }
  
  // Subscription mensal para serviço premium
  async createSubscription(
    userAddress: string,
    monthlyRate: bigint
  ): Promise<void> {
    // Setup streaming payment
  }
}
```

---

## 📦 FASE 5: MOLBOT MARKETPLACE (Semanas 5-6)

### 5.1 Integração Opcional

O marketplace de molbots é **opcional** e **complementar**:

```typescript
// src/bot/handlers/marketplace.ts

export function registerMarketplaceHandlers(bot: Bot<Context>) {
  // /marketplace - Ver molbots disponíveis (OPCIONAL)
  // O usuário NÃO PRECISA usar - o Copilot já faz tudo
  
  bot.command('marketplace', async (ctx) => {
    await ctx.reply(
      '🤖 *Optional Services*\n\n' +
      'You can hire specialized bots for advanced strategies:\n\n' +
      '• *Yield Strategist* - Advanced allocation strategies\n' +
      '• *Content Generator* - Create content about your portfolio\n' +
      '• *Data Analyst* - Deep dive into DeFi data\n\n' +
      'The Copilot handles basic yield management for free!\n' +
      'These are optional premium services.',
      { parse_mode: 'Markdown' }
    );
  });
}
```

### 5.2 Como Usuários Contratam Serviços

```typescript
// Se o usuário QUER um serviço especializado:

// /hire yield-strategist
// → Copilot facilita o pagamento via x402
// → Molbot especializado executa a tarefa
// → Retorna resultado ao Copilot
// → Copilot apresenta ao usuário

// O usuário sempre passa pelo Copilot
// O Copilot permanece como interface principal
```

---

## 📋 ROADMAP FINAL REFINADO

| Fase | Semanas | Foco | Essência Preservada? |
|------|---------|------|---------------------|
| 1 | 1-2 | Core + ERC-8004 + x402 | ✅ Sim |
| 2 | 2-3 | Copilot como Molbot | ✅ Sim (extensão natural) |
| 3 | 3-4 | USDCx Integration | ✅ Sim (mais opções de yield) |
| 4 | 4-5 | Revenue Stream | ✅ Sim (sustentabilidade) |
| 5 | 5-6 | Marketplace Opcional | ✅ Sim (complementar) |

---

## 🎯 Resumo: O Que Mantemos

| Componente | Ação |
|------------|------|
| Telegram Bot | ✅ Manter - interface principal |
| Natural Language | ✅ Manter - "Put my sBTC to work" |
| Smart Contract Wallet | ✅ Manter - segurança do usuário |
| Yield Management | ✅ Manter - foco principal |
| ERC-8004 Identity | ✅ Adicionar - credibilidade |
| x402 Payments | ✅ Expandir - para dados E serviços |

## 🎯 O Que Adicionamos

| Componente | Ação | Por Que |
|------------|------|---------|
| Copilot como Molbot | Adicionar | Revenue stream, discovered por outros |
| USDCx | Adicionar | Mais opções de yield para usuário |
| Revenue Manager | Adicionar | Sustentabilidade do serviço |
| Marketplace (opicional) | Adicionar | Services avançados sob demanda |

---

## ✅ Checklist Preservação da Essência

- [ ] Usuário pode usar sem saber que molbots existem
- [ ] Fluxo básico continua: "Put my sBTC to work" →done
- [ ] Smart contract wallet continua sendo usado
- [ ] ERC-8004 identity adicionada
- [ ] x402 usado para dados E serviços
- [ ] Revenue não afeta experiência do usuário básico
- [ ] Marketplace é complementar, não substituto
