# Technical Roadmap - Bitcoin Yield Copilot

## Goal: Complete the 3 Bounties from BUIDL Battle #2

1. **sBTC Innovation** - Innovative use of sBTC
2. **USDCx** - Best use of USDCx on Stacks
3. **x402 Molbots** - Protocol for molbots to interact and pay via x402

---

## Phase 1: Base Infrastructure (Weeks 1-2)

### 1.1 Molbot Registry (Smart Contract)

**Goal**: Create the central registry where molbots discover each other

```clarity
;; molbot-registry.clar

(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-ALREADY-REGISTERED (err u409))
(define-constant ERR-NOT-FOUND (err u404))

;; Molbot capabilities - service categories
(define-enum capability
  (yield-optimizer)
  (content-generator)
  (data-analyst)
  (swap-executor)
  (arbitrage-bot)
  (custom)
)

;; Molbot registry entry
(define-map molbots
  principal
  {
    name: (string-ascii 64),
    description: (string-ascii 256),
    capabilities: (list 10 capability),
    price-per-call: uint,           ;; in micro-STX
    payment-token: (string-ascii 8), ;; "STX", "sBTC", "USDCx"
    rating: uint,                   ;; 0-100
    total-calls: uint,
    active: bool,
    owner: principal,
    registered-at: uint
  }
)

;; Registry functions
(define-public (register-molbot
    (name (string-ascii 64))
    (description (string-ascii 256))
    (capabilities (list 10 capability))
    (price-per-call uint)
    (payment-token (string-ascii 8))
  )
  (begin
    (asserts! (is-none (map-get? molbots tx-sender)) ERR-ALREADY-REGISTERED)
    (map-set molbots tx-sender {
      name: name,
      description: description,
      capabilities: capabilities,
      price-per-call: price-per-call,
      payment-token: payment-token,
      rating: u0,
      total-calls: u0,
      active: true,
      owner: tx-sender,
      registered-at: stacks-block-height
    })
    (ok true)
  )
)

(define-public (update-molbot
    (name (string-ascii 64))
    (description (string-ascii 256))
    (capabilities (list 10 capability))
    (price-per-call uint)
    (payment-token (string-ascii 8))
  )
  (let ((entry (unwrap! (map-get? molbots tx-sender) ERR-NOT-FOUND)))
    (asserts! (is-eq (get owner entry) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set molbots tx-sender (merge entry {
      name: name,
      description: description,
      capabilities: capabilities,
      price-per-call: price-per-call,
      payment-token: payment-token
    }))
    (ok true))
)

(define-public (set-molbot-active (active bool))
  (let ((entry (unwrap! (map-get? molbots tx-sender) ERR-NOT-FOUND)))
    (asserts! (is-eq (get owner entry) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set molbots tx-sender (merge entry { active: active }))
    (ok true))
)

;; Search functions
(define-read-only (get-molbot (address principal))
  (map-get? molbots address)
)

(define-read-only (get-molbots-by-capability (cap capability))
  (filter is-capability-match (map-to-list molbots))
)

(define-private (is-capability-match (entry { key: principal, value: (tuple) }))
  ;; Implement filter logic
)
```

**Files to create**: `contracts/molbot-registry.clar`

**Dependencies**: None (first contract)

---

### 1.2 Molbot Payment Contract

**Goal**: Contract that manages payments between molbots

```clarity
;; molbot-payment.clar

(use-trait molbot-registry .molbot-registry.molbot-registry)

(define-constant ERR-INSUFFICIENT-PAYMENT (err u401))
(define-constant ERR-SERVICE-FAILED (err u402))
(define-constant ERR-EXPIRED (err u404))

;; Payment request
(define-map pending-payments
  (buff 32)
  {
    sender: principal,
    recipient: principal,
    amount: uint,
    token: (string-ascii 8),
    service-data: (buff 256),
    created-at: uint,
    expires-at: uint,
    completed: bool
  }
)

;; Execute payment + call molbot service
(define-public (pay-and-execute
    (molbot principal)
    (amount uint)
    (token (string-ascii 8))
    (service-data (buff 256))
    (expiry-blocks uint)
  )
  (let (
    (registry (.molbot-registry))
    (molbot-info (contract-call? registry get-molbot molbot))
    (payment-hash (sha256 (concat service-data (concat (unwrap-panic (to-consensus-buff? tx-sender)) (unwrap-panic (to-consensus-buff? amount))))))
    (expires-at (+ stacks-block-height expiry-blocks))
  )
    ;; Verify molbot is active
    (asserts! (get active molbot-info) ERR-SERVICE-FAILED)
    
    ;; Process payment based on token
    (if (is-eq token "STX")
      (try! (stx-transfer? amount tx-sender molbot))
      (if (is-eq token "sBTC")
        (try! (contract-call? .sbtc-token transfer amount tx-sender molbot none))
        (if (is-eq token "USDCx")
          (try! (contract-call? .usdcx-token transfer amount tx-sender molbot none))
          (err u400)
        )
      )
    )
    
    ;; Record pending payment
    (map-set pending-payments payment-hash {
      sender: tx-sender,
      recipient: molbot,
      amount: amount,
      token: token,
      service-data: service-data,
      created-at: stacks-block-height,
      expires-at: expires-at,
      completed: false
    })
    
    (ok { payment-hash: payment-hash, expires-at: expires-at })
  )
)

;; Confirm service completion (called by molbot after providing service)
(define-public (confirm-completion (payment-hash (buff 32)))
  (let ((payment (unwrap! (map-get? pending-payments payment-hash) ERR-NOT-FOUND)))
    (asserts! (is-eq (get recipient payment) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set pending-payments payment-hash (merge payment { completed: true }))
    (ok true))
)
```

**Files to create**: `contracts/molbot-payment.clar`

**Dependencies**: `molbot-registry.clar`

---

## Phase 2: Molbot Marketplace (Weeks 2-3)

### 2.1 Molbot Service Types

**Goal**: Define the types of services molbots can offer

```typescript
// src/molbot/types.ts

export type MolbotCapability = 
  | 'yield-optimizer'
  | 'content-generator'
  | 'data-analyst'
  | 'swap-executor'
  | 'arbitrage-bot'
  | 'custom';

export interface MolbotService {
  id: string;
  name: string;
  description: string;
  capabilities: MolbotCapability[];
  pricePerCall: bigint;
  paymentToken: 'STX' | 'sBTC' | 'USDCx';
  rating: number;
  totalCalls: number;
  active: boolean;
}

export interface MolbotTask {
  id: string;
  requester: string;
  molbot: string;
  serviceType: MolbotCapability;
  inputData: Record<string, any>;
  paymentAmount: bigint;
  paymentToken: 'STX' | 'sBTC' | 'USDCx';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  createdAt: number;
  completedAt?: number;
}

export interface MolbotDiscovery {
  byCapability: (capability: MolbotCapability) => Promise<MolbotService[]>;
  byRating: (minRating: number) => Promise<MolbotService[]>;
  search: (query: string) => Promise<MolbotService[]>;
}
```

### 2.2 Molbot Client (TypeScript)

**Goal**: Library for molbots to communicate

```typescript
// src/molbot/client.ts

import { x402Client } from '../x402/client';

export class MolbotClient {
  private readonly registryAddress: string;
  private readonly paymentAddress: string;
  private readonly agentPrivateKey: string;

  constructor(options: {
    registryAddress: string;
    paymentAddress: string;
    agentPrivateKey: string;
  }) {
    this.registryAddress = options.registryAddress;
    this.paymentAddress = options.paymentAddress;
    this.agentPrivateKey = options.agentPrivateKey;
  }

  // === REGISTRY ===

  async registerService(
    name: string,
    description: string,
    capabilities: string[],
    pricePerCall: bigint,
    paymentToken: 'STX' | 'sBTC' | 'USDCx'
  ): Promise<void> {
    // Call molbot-registry contract
  }

  async updateService(
    name: string,
    description: string,
    capabilities: string[],
    pricePerCall: bigint,
    paymentToken: 'STX' | 'sBTC' | 'USDCx'
  ): Promise<void> {
    // Update existing registration
  }

  async setActive(active: boolean): Promise<void> {
    // Toggle active status
  }

  // === DISCOVERY ===

  async findByCapability(capability: string): Promise<MolbotService[]> {
    // Query registry for molbots with specific capability
  }

  async findByRating(minRating: number): Promise<MolbotService[]> {
    // Query registry sorted by rating
  }

  async search(query: string): Promise<MolbotService[]> {
    // Full-text search in name + description
  }

  // === TASK EXECUTION ===

  async executeTask(
    targetMolbot: string,
    taskType: string,
    inputData: Record<string, any>
  ): Promise<any> {
    // 1. Get molbot info from registry
    // 2. Create payment request via x402
    // 3. Execute payment
    // 4. Send task to molbot
    // 5. Wait for result
    // 6. Confirm completion
  }

  // === x402 INTEGRATION ===

  async payWithX402(
    recipient: string,
    amount: bigint,
    token: 'STX' | 'sBTC' | 'USDCx',
    description: string
  ): Promise<string> {
    const paymentRequest = await x402Client.createPaymentRequest(
      amount.toString(),
      description,
      token,
      recipient
    );
    
    const payment = await x402Client.makePayment(paymentRequest);
    return payment.transactionHash;
  }
}
```

**Files to create**: 
- `src/molbot/types.ts`
- `src/molbot/client.ts`
- `src/molbot/index.ts`

---

### 2.3 Specialized Molbots

#### 2.3.1 Yield Optimizer Molbot

```typescript
// src/molbot/yield-optimizer.ts

export interface YieldOptimizationRequest {
  amount: bigint;
  tokens: string[];
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
}

export interface YieldOptimizationResult {
  recommendedProtocol: string;
  estimatedApy: number;
  estimatedYield: bigint;
  risks: string[];
  swapRoute?: string[];
}

// Service that the molbot offers
export class YieldOptimizerMolbot {
  async optimize(request: YieldOptimizationRequest): Promise<YieldOptimizationResult> {
    // 1. Fetch current APYs from all protocols
    const apys = await this.fetchAPYs(request.tokens);
    
    // 2. Calculate best allocation
    const allocation = this.calculateOptimalAllocation(
      request.amount,
      apys,
      request.riskProfile
    );
    
    // 3. If swap needed, calculate route
    let swapRoute: string[] | undefined;
    if (request.tokens[0] !== 'sBTC') {
      swapRoute = await this.calculateSwapRoute(
        request.tokens[0],
        'sBTC',
        request.amount
      );
    }
    
    return {
      recommendedProtocol: allocation.protocol,
      estimatedApy: allocation.apy,
      estimatedYield: allocation.estimatedYield,
      risks: allocation.risks,
      swapRoute,
    };
  }
  
  private async fetchAPYs(tokens: string[]): Promise<Record<string, number>> {
    // Use MCP or x402 paid endpoints
  }
}
```

#### 2.3.2 Content Generator Molbot

```typescript
// src/molbot/content-generator.ts

export interface ContentRequest {
  type: 'tweet' | 'article' | 'summary';
  topic: string;
  tone: 'professional' | 'casual' | 'technical';
  maxLength: number;
}

export interface ContentResult {
  content: string;
  wordCount: number;
  tokens: number;
  cost: bigint;
}

export class ContentGeneratorMolbot {
  private readonly openaiKey: string;
  
  async generate(request: ContentRequest): Promise<ContentResult> {
    // 1. Check request validity
    // 2. Call AI to generate content
    // 3. Calculate cost based on tokens used
    // 4. Return result
    
    const content = await this.callAI(request);
    const tokens = this.countTokens(content);
    const cost = this.calculateCost(tokens);
    
    return {
      content,
      wordCount: content.split(' ').length,
      tokens,
      cost,
    };
  }
  
  // Pricing: 0.001 STX per 1K tokens
  private calculateCost(tokens: number): bigint {
    return BigInt(Math.ceil(tokens / 1000)) * 1000n;
  }
}
```

**Files to create**:
- `src/molbot/yield-optimizer.ts`
- `src/molbot/content-generator.ts`
- `src/molbot/data-analyst.ts`

---

## Phase 3: USDCx Integration (Weeks 3-4)

### 3.1 USDCx Adapter

**Goal**: Integrate USDCx into yield strategies

```typescript
// src/protocols/usdcx.ts

import { x402Client } from '../x402/client';

export interface USDCxPool {
  protocol: string;
  apy: number;
  tvl: number;
  token0: string;
  token1: string;
}

export const USDCX_PROTOCOL = {
  // ALEX USDCx/STX pool
  ALEX_USDCX_STX: 'SP...alex-pool-usdcx-stx',
  // Bitflow USDCx pool
  BITFLOW_USDCX: 'SP...bitflow-usdcx-pool',
  // Hermetica USDCx vault
  HERMETICA_USDCX: 'SP...hermetica-usdcx-vault',
};

export async function getUSDCxPools(): Promise<USDCxPool[]> {
  // Fetch from MCP or paid x402 endpoint
  return [
    {
      protocol: 'alex',
      apy: 5.2,
      tvl: 15000000,
      token0: 'USDCx',
      token1: 'STX',
    },
    {
      protocol: 'bitflow',
      apy: 4.8,
      tvl: 8000000,
      token0: 'USDCx',
      token1: 'sBTC',
    },
  ];
}

export async function depositUSDCx(
  amount: bigint,
  protocol: string
): Promise<{ txId: string; poolToken: string }> {
  // Execute deposit to USDCx pool
}

export async function withdrawUSDCx(
  amount: bigint,
  protocol: string
): Promise<{ txId: string; received: bigint }> {
  // Execute withdrawal from USDCx pool
}

export async function swapToUSDCx(
  fromToken: string,
  amount: bigint
): Promise<{ txId: string; received: bigint }> {
  // Swap any token to USDCx
}
```

### 3.2 USDCx in Bot

Add handlers for USDCx:

```typescript
// src/bot/handlers/usdcx.ts

export function registerUSDCxHandlers(bot: Bot<Context>) {
  bot.command('usdcx', async (ctx) => {
    // Show USDCx opportunities
    const pools = await getUSDCxPools();
    // Render keyboard with options
  });
  
  bot.command('swap-usdcx', async (ctx) => {
    // Swap to USDCx
  });
  
  bot.command('deposit-usdcx', async (ctx) => {
    // Deposit to USDCx pool
  });
}
```

**Files to create**:
- `src/protocols/usdcx.ts`
- `src/bot/handlers/usdcx.ts`

---

## Phase 4: x402 Payments Enhancements (Weeks 4-5)

### 4.1 Enhanced x402 Client

```typescript
// src/x402/enhanced-client.ts

export interface PaymentStream {
  id: string;
  sender: string;
  recipient: string;
  amountPerSecond: bigint;
  token: 'STX' | 'sBTC' | 'USDCx';
  startedAt: number;
  duration: number; // seconds
}

export interface EscrowPayment {
  id: string;
  sender: string;
  recipient: string;
  amount: bigint;
  token: 'STX' | 'sBTC' | 'USDCx';
  conditions: PaymentCondition[];
  status: 'pending' | 'locked' | 'released' | 'refunded';
}

export interface PaymentCondition {
  type: 'time' | 'callback' | 'onchain-event';
  payload: any;
}

export class EnhancedX402Client extends X402Client {
  // === STREAM PAYMENTS ===
  
  async createPaymentStream(
    recipient: string,
    amountPerSecond: bigint,
    token: 'STX' | 'sBTC' | 'USDCx',
    duration: number
  ): Promise<PaymentStream> {
    // Create streaming payment setup
  }
  
  // === ESCROW PAYMENTS ===
  
  async createEscrow(
    recipient: string,
    amount: bigint,
    token: 'STX' | 'sBTC' | 'USDCx',
    conditions: PaymentCondition[]
  ): Promise<EscrowPayment> {
    // Lock funds in escrow
  }
  
  async releaseEscrow(escrowId: string): Promise<void> {
    // Release funds when conditions met
  }
  
  async refundEscrow(escrowId: string): Promise<void> {
    // Refund if conditions not met
  }
  
  // === MOLBOT PAYMENTS ===
  
  async payMolbot(
    molbotAddress: string,
    serviceType: string,
    amount: bigint,
    token: 'STX' | 'sBTC' | 'USDCx'
  ): Promise<{ txId: string; paymentProof: string }> {
    const paymentRequest = await this.createPaymentRequest(
      amount.toString(),
      `Molbot service: ${serviceType}`,
      token,
      molbotAddress
    );
    
    const payment = await this.makePayment(paymentRequest);
    
    return {
      txId: payment.transactionHash,
      paymentProof: payment.paymentId,
    };
  }
}
```

### 4.2 x402 Middleware for Molbot Tasks

```typescript
// src/x402/middleware.ts

import { EnhancedX402Client } from './enhanced-client';

export interface X402MolbotEndpoint<TInput, TOutput> {
  (
    input: TInput,
    paymentProof?: string
  ): Promise<TOutput>;
}

export function createMolbotEndpoint<TInput, TOutput>(
  options: {
    price: bigint;
    token: 'STX' | 'sBTC' | 'USDCx';
    description: string;
    handler: (input: TInput) => Promise<TOutput>;
  }
): X402MolbotEndpoint<TInput, TOutput> {
  const x402 = new EnhancedX402Client();
  
  return async (input: TInput, paymentProof?: string) => {
    // If no payment proof, return 402
    if (!paymentProof) {
      const request = await x402.createPaymentRequest(
        options.price.toString(),
        options.description,
        options.token
      );
      
      throw new X402PaymentRequired(request);
    }
    
    // Verify payment
    const verified = await x402.verifyPaymentByProof(paymentProof);
    if (!verified) {
      throw new Error('Payment verification failed');
    }
    
    // Execute handler
    return options.handler(input);
  };
}

export class X402PaymentRequired extends Error {
  constructor(public readonly paymentRequest: any) {
    super('Payment required');
    this.name = 'X402PaymentRequired';
  }
}
```

**Files to create**:
- `src/x402/enhanced-client.ts`
- `src/x402/middleware.ts`

---

## Phase 5: Smart Contracts - Complete Adapters (Weeks 5-6)

### 5.1 Adapter Trait V3

```clarity
;; adapter-trait-v3.clar

(define-trait adapter-trait-v3
  (
    ;; Execute operation - returns (response { amount: uint, allocated: uint } uint)
    (execute
      (uint (string-ascii 16))
      (response { amount: uint, allocated: uint } uint)
    )

    ;; Get current balance in adapter
    (get-balance
      ()
      (response uint uint)
    )

    ;; Get pending rewards/yield
    (get-pending-rewards
      ()
      (response uint uint)
    )

    ;; Emergency withdraw all
    (emergency-withdraw
      ()
      (response uint uint)
    )
  )
)
```

### 5.2 USDCx Adapter

```clarity
;; usdcx-adapter.clar

(impl-trait .adapter-trait-v3.adapter-trait-v3)

;; Contracts
(define-constant ALEX-POOL 'SP...alex-usdcx-stx-pool)
(define-constant BITFLOW-POOL 'SP...bitflow-usdcx-pool)

;; State
(define-data-var total-allocated uint u0)
(define-data-var pending-rewards uint u0)

;; Execute deposit or withdraw
(define-public (execute (amount uint) (action (string-ascii 16)))
  (if (is-eq action "deposit")
    (begin
      ;; Transfer USDCx from wallet to adapter
      (try! (as-contract (contract-call? .usdcx-token transfer amount tx-sender .usdcx-adapter none)))
      ;; Add to pool (simplified)
      (var-set total-allocated (+ (var-get total-allocated) amount))
      (ok { amount: amount, allocated: (var-get total-allocated) })
    )
    (if (is-eq action "withdraw")
      (begin
        ;; Remove from pool
        (var-set total-allocated (- (var-get total-allocated) amount))
        ;; Transfer USDCx back to wallet
        (try! (as-contract (contract-call? .usdcx-token transfer amount .usdcx-adapter tx-sender none)))
        (ok { amount: amount, allocated: (var-get total-allocated) })
      )
      (err u400)
    )
  )
)

(define-read-only (get-balance)
  (ok (var-get total-allocated))
)

(define-read-only (get-pending-rewards)
  (ok (var-get pending-rewards))
)

(define-public (emergency-withdraw)
  (let ((balance (var-get total-allocated)))
    (var-set total-allocated u0)
    (as-contract (contract-call? .usdcx-token transfer balance .usdcx-adapter tx-sender none))
    (ok balance)
  )
)
```

**Files to create**:
- `contracts/adapter-trait-v3.clar`
- `contracts/usdcx-adapter.clar`
- `contracts/swap-adapter.clar`

---

## Phase 6: Final Integration (Weeks 6-8)

### 6.1 Molbot Marketplace UI

```typescript
// src/bot/handlers/marketplace.ts

export function registerMarketplaceHandlers(bot: Bot<Context>) {
  const molbotClient = new MolbotClient({
    registryAddress: process.env.MOLBOT_REGISTRY!,
    paymentAddress: process.env.MOLBOT_PAYMENT!,
    agentPrivateKey: process.env.AGENT_STACKS_PRIVATE_KEY!,
  });

  // /marketplace - Browse available molbots
  bot.command('marketplace', async (ctx) => {
    const molbots = await molbotClient.findByRating(50);
    
    let message = '🤖 *Molbot Marketplace*\n\n';
    for (const molbot of molbots.slice(0, 10)) {
      message += `*${molbot.name}*\n`;
      message += `${molbot.description}\n`;
      message += `💰 ${molbot.pricePerCall} ${molbot.paymentToken} per call\n`;
      message += `⭐ ${molbot.rating}/100 (${molbot.totalCalls} calls)\n\n`;
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // /hire <molbot> <task> - Hire a molbot
  bot.command('hire', async (ctx) => {
    const args = ctx.message?.text?.split(' ');
    const molbotAddress = args?.[1];
    const taskType = args?.[2];
    
    if (!molbotAddress || !taskType) {
      return ctx.reply('Usage: /hire <molbot-address> <task-type>');
    }
    
    const result = await molbotClient.executeTask(
      molbotAddress,
      taskType,
      {}
    );
    
    await ctx.reply(`✅ Task completed!\n\n${JSON.stringify(result)}`);
  });

  // /my-molbot - Manage your molbot service
  bot.command('my-molbot', async (ctx) => {
    // Show current molbot status
  });

  // /register-molbot - Register as a molbot
  bot.command('register-molbot', async (ctx) => {
    // Start registration flow
  });
}
```

### 6.2 Full x402 Integration

```typescript
// src/bot/handlers/payments.ts

export function registerPaymentHandlers(bot: Bot<Context>) {
  // /pay <address> <amount> <token> - Pay via x402
  bot.command('pay', async (ctx) => {
    const args = ctx.message?.text?.split(' ');
    const recipient = args?.[1];
    const amount = args?.[2];
    const token = args?.[3] as 'STX' | 'sBTC' | 'USDCx';
    
    if (!recipient || !amount || !token) {
      return ctx.reply('Usage: /pay <address> <amount> <token>');
    }
    
    const x402 = new EnhancedX402Client();
    const tx = await x402.payMolbot(
      recipient,
      'direct-payment',
      BigInt(parseFloat(amount) * 1000000),
      token
    );
    
    await ctx.reply(`✅ Payment sent!\n\nTX: ${tx.txId}`);
  });

  // /stream <address> <amount-per-sec> <token> - Start streaming payment
  bot.command('stream', async (ctx) => {
    // Start streaming payment
  });

  // /escrow <address> <amount> <token> - Create escrow
  bot.command('escrow', async (ctx) => {
    // Create escrow payment
  });
}
```

---

## Roadmap Summary

| Phase | Weeks | Components | Status |
|-------|-------|------------|--------|
| 1 | 1-2 | Molbot Registry + Payment Contract | 🔲 To create |
| 2 | 2-3 | Molbot Client + Discovery + Specialized Molbots | 🔲 To create |
| 3 | 3-4 | USDCx Adapter + Bot Integration | 🔲 To create |
| 4 | 4-5 | Enhanced x402 Client + Middleware | 🔲 To create |
| 5 | 5-6 | Adapter V3 + USDCx Adapter | 🔲 To create |
| 6 | 6-8 | Marketplace UI + Full Integration | 🔲 To create |

---

## Implementation Priority

### Week 1: Molbot Registry
- [ ] `contracts/molbot-registry.clar`
- [ ] Test on testnet

### Week 2: Molbot Payment + Basic Client
- [ ] `contracts/molbot-payment.clar`
- [ ] `src/molbot/types.ts`
- [ ] `src/molbot/client.ts`

### Week 3: Specialized Molbots
- [ ] Yield Optimizer
- [ ] Content Generator
- [ ] Integration tests

### Week 4: USDCx
- [ ] `src/protocols/usdcx.ts`
- [ ] `src/bot/handlers/usdcx.ts`
- [ ] USDCx Adapter contract

### Week 5: Enhanced x402
- [ ] `src/x402/enhanced-client.ts`
- [ ] `src/x402/middleware.ts`

### Week 6-8: Marketplace + Integration
- [ ] Marketplace handlers
- [ ] Payment handlers
- [ ] Complete integration
- [ ] E2E tests

---

## Files to Create

### Clarity Contracts
```
contracts/
├── molbot-registry.clar      # NEW
├── molbot-payment.clar        # NEW
├── adapter-trait-v3.clar     # NEW
└── usdcx-adapter.clar        # NEW
```

### TypeScript
```
src/
├── molbot/
│   ├── types.ts              # NEW
│   ├── client.ts             # NEW
│   ├── index.ts              # NEW
│   ├── yield-optimizer.ts    # NEW
│   ├── content-generator.ts  # NEW
│   └── data-analyst.ts       # NEW
├── protocols/
│   └── usdcx.ts             # NEW
├── x402/
│   ├── enhanced-client.ts    # NEW
│   └── middleware.ts         # NEW
└── bot/handlers/
    ├── usdcx.ts              # NEW
    ├── marketplace.ts        # NEW
    └── payments.ts           # NEW
```

---

## Final Checklist

- [ ] Molbot Registry deployed + tested
- [ ] Molbot Payment deployed + tested
- [ ] Molbot Client implemented
- [ ] Yield Optimizer molbot working
- [ ] Content Generator molbot working
- [ ] USDCx integration complete
- [ ] x402 enhanced payments working
- [ ] Marketplace in Telegram bot
- [ ] E2E tests passing
- [ ] Demo for bounty submission
