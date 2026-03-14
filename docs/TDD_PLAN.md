# 📋 Plano TDD - Bitcoin Yield Copilot

## Princípios TDD

1. **Escrever teste primeiro** - O teste deve falhar inicialmente
2. **Ver o teste falhar** - Confirmar que o teste captura o requisito
3. **Implementar o mínimo** - Apenas o suficiente para passar
4. **Refatorar** - Melhorar código mantendo testes passando
5. **Repetir** - Próximo requisito

---

## 🎯 FASE 1: ERC-8004 Identity (Semana 1)

### 1.1 Testes Primeiro

```typescript
// tests/erc8004-identity_test.ts

import { Clarinet, Tx, Chain, Account, types } from "./deps.ts";

Clarinet.test({
  name: "ERC8004: should register agent identity successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    // Attempt to register identity
    const block = chain.mineBlock([
      Tx.contractCall(
        "erc8004-identity",
        "register-identity",
        [
          types.buffFromHex("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"),
          types.ascii("bitcoin-yield.com"),
          types.list([types.ascii("yield-optimizer"), types.ascii("portfolio-manager")])
        ],
        deployer.address
      )
    ]);
    
    // Verify registration succeeded
    block.receipts[0].result.expectOk();
    
    // Verify identity exists
    const identity = chain.callReadOnlyFn(
      "erc8004-identity",
      "get-identity",
      [deployer.address]
    );
    
    identity.result.expectSome();
  }
});

Clarinet.test({
  name: "ERC8004: should sign action with identity",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    // Sign an action
    const block = chain.mineBlock([
      Tx.contractCall(
        "erc8004-identity",
        "sign-action",
        [
          types.ascii("deposit"),
          types.buffFromHex("00112233445566778899aabbccddeeff")
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    // Verify signature is valid
    const verify = chain.callReadOnlyFn(
      "erc8004-identity",
      "verify-signature",
      [
        deployer.address,
        types.ascii("deposit"),
        types.buffFromHex("00112233445566778899aabbccddeeff")
      ]
    );
    
    verify.result.expectOk().expectBool(true);
  }
});
```

### 1.2 Contrato a Implementar

```clarity
;; contracts/erc8004-identity.clar

(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-ALREADY-REGISTERED (err u409))

(define-map identities
  principal
  {
    domain: (string-ascii 64),
    nonce: uint,
    registered-at: uint
  }
)

(define-map identity-capabilities
  principal
  (list 10 (string-ascii 32))
)

(define-map action-signatures
  { identity: principal, action-hash: (buff 32) }
  { signature: (buff 65), timestamp: uint }
)

;; Register identity
(define-public (register-identity
    (domain (string-ascii 64))
    (capabilities (list 10 (string-ascii 32)))
  )
  (begin
    (asserts! (is-none (map-get? identities tx-sender)) ERR-ALREADY-REGISTERED)
    (map-set identities tx-sender {
      domain: domain,
      nonce: u0,
      registered-at: stacks-block-height
    })
    (map-set identity-capabilities tx-sender capabilities)
    (ok true)
  )
)

;; Sign action
(define-public (sign-action
    (action (string-ascii 64))
    (payload (buff 32))
  )
  (let (
    (identity (unwrap! (map-get? identities tx-sender) ERR-NOT-AUTHORIZED))
    (action-hash (sha256 (concat payload (unwrap-panic (to-consensus-buff? (get nonce identity))))))
    (sig (unwrap-panic (secp256k1-sign? payload tx-sender)))
  )
    (map-set action-signatures { identity: tx-sender, action-hash: action-hash }
      { signature: sig, timestamp: stacks-block-height })
    (map-set identities tx-sender (merge identity { nonce: (+ (get nonce identity) u1) }))
    (ok { action-hash: action-hash, signature: sig })
  )
)

;; Verify signature
(define-read-only (verify-signature
    (identity principal)
    (action (string-ascii 64))
    (payload (buff 32))
  )
  (let (
    (id (unwrap! (map-get? identities identity) ERR-NOT-AUTHORIZED))
    (action-hash (sha256 (concat payload (unwrap-panic (to-consensus-buff? (get nonce id))))))
    (sig-entry (map-get? action-signatures { identity: identity, action-hash: action-hash }))
  )
    (ok (is-some sig-entry))
  )
)
```

---

## 🎯 FASE 2: Molbot Registry (Semana 1-2)

### 2.1 Testes Primeiro

```typescript
// tests/molbot-registry_test.ts

import { Clarinet, Tx, Chain, Account, types } from "./deps.ts";

Clarinet.test({
  name: "MolbotRegistry: should register a new molbot",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "molbot-registry",
        "register-molbot",
        [
          types.ascii("Yield Optimizer Pro"),
          types.ascii("Advanced yield optimization strategies"),
          types.ascii("yield-optimizer"),
          types.uint(1000),  // 0.001 STX per call
          types.ascii("STX")
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    // Verify registration
    const molbot = chain.callReadOnlyFn(
      "molbot-registry",
      "get-molbot",
      [wallet1.address]
    );
    
    const data = molbot.result.expectSome();
    data['name'].expectAscii("Yield Optimizer Pro");
    data['capability'].expectAscii("yield-optimizer");
    data['price-per-call'].expectUint(1000);
  }
});

Clarinet.test({
  name: "MolbotRegistry: should fail if already registered",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    
    // First registration
    chain.mineBlock([
      Tx.contractCall(
        "molbot-registry",
        "register-molbot",
        [
          types.ascii("Bot 1"),
          types.ascii("Description"),
          types.ascii("yield-optimizer"),
          types.uint(1000),
          types.ascii("STX")
        ],
        wallet1.address
      )
    ]);
    
    // Second registration should fail
    const block = chain.mineBlock([
      Tx.contractCall(
        "molbot-registry",
        "register-molbot",
        [
          types.ascii("Bot 2"),
          types.ascii("Description 2"),
          types.ascii("data-analyst"),
          types.uint(2000),
          types.ascii("USDCx")
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(409);
  }
});

Clarinet.test({
  name: "MolbotRegistry: should find molbots by capability",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    const wallet2 = accounts.get("wallet_2")!;
    
    // Register multiple molbots
    chain.mineBlock([
      Tx.contractCall("molbot-registry", "register-molbot",
        ["Bot 1", "Desc", "yield-optimizer", types.uint(1000), types.ascii("STX")],
        wallet1.address),
      Tx.contractCall("molbot-registry", "register-molbot",
        ["Bot 2", "Desc", "yield-optimizer", types.uint(1500), types.ascii("STX")],
        wallet2.address),
    ]);
    
    // Search by capability
    const results = chain.callReadOnlyFn(
      "molbot-registry",
      "get-molbots-by-capability",
      [types.ascii("yield-optimizer")]
    );
    
    // Should return 2 molbots
    results.result.expectSome().length.expect(2);
  }
});
```

### 2.2 Contrato

```clarity
;; contracts/molbot-registry.clar

(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-ALREADY-REGISTERED (err u409))
(define-constant ERR-NOT-FOUND (err u404))

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

(define-public (update-molbot
    (name (string-ascii 64))
    (description (string-ascii 256))
    (capability (string-ascii 32))
    (price-per-call uint)
    (payment-token (string-ascii 8))
  )
  (let ((entry (unwrap! (map-get? molbots tx-sender) ERR-NOT-FOUND)))
    (asserts! (is-eq (get owner entry) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set molbots tx-sender (merge entry {
      name: name,
      description: description,
      capability: capability,
      price-per-call: price-per-call,
      payment-token: payment-token
    }))
    (ok true))
)

(define-public (set-active (active bool))
  (let ((entry (unwrap! (map-get? molbots tx-sender) ERR-NOT-FOUND)))
    (asserts! (is-eq (get owner entry) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set molbots tx-sender (merge entry { active: active }))
    (ok true))
)

(define-read-only (get-molbot (address principal))
  (map-get? molbots address)
)

(define-read-only (get-molbots-by-capability (capability (string-ascii 32)))
  (filter
    (lambda (entry) (is-eq (get capability (unwrap-panic (to-consensus-buff? (get value entry)))) capability))
    (map-to-list molbots)
  )
)
```

---

## 🎯 FASE 3: Molbot Payment (Semana 2)

### 3.1 Testes

```typescript
// tests/molbot-payment_test.ts

Clarinet.test({
  name: "MolbotPayment: should process payment for service",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot = accounts.get("wallet_1")!;
    const user = accounts.get("wallet_2")!;
    
    // Register molbot first
    chain.mineBlock([
      Tx.contractCall("molbot-registry", "register-molbot",
        ["Yield Bot", "Desc", "yield-optimizer", types.uint(1000), types.ascii("STX")],
        molbot.address)
    ]);
    
    // User pays molbot
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
    
    block.receipts[0].result.expectOk();
  }
});
```

### 3.2 Contrato

```clarity
;; contracts/molbot-payment.clar

(use-trait molbot-registry .molbot-registry.molbot-registry)

(define-constant ERR-INSUFFICIENT-PAYMENT (err u401))
(define-constant ERR-MOLBOT-INACTIVE (err u402))

(define-map payments
  { sender: principal, nonce: uint }
  {
    recipient: principal,
    amount: uint,
    token: (string-ascii 8),
    completed: bool
  }
)

(define-data-var payment-nonce uint u0)

(define-public (pay-molbot
    (molbot principal)
    (amount uint)
    (token (string-ascii 8))
    (service-data (buff 256))
  )
  (let (
    (registry (.molbot-registry))
    (molbot-info (contract-call? registry get-molbot molbot))
    (current-nonce (var-get payment-nonce))
  )
    ;; Verify molbot exists and is active
    (asserts! (get active (unwrap! molbot-info ERR-NOT-FOUND)) ERR-MOLBOT-INACTIVE)
    
    ;; Process payment
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
    
    ;; Record payment
    (map-set payments { sender: tx-sender, nonce: current-nonce } {
      recipient: molbot,
      amount: amount,
      token: token,
      completed: true
    })
    
    (var-set payment-nonce (+ current-nonce u1))
    (ok { payment-id: current-nonce, amount: amount })
  )
)
```

---

## 🎯 FASE 4: USDCx Adapter (Semana 2-3)

### 4.1 Testes

```typescript
// tests/usdcx-adapter_test.ts

Clarinet.test({
  name: "USDCxAdapter: should deposit USDCx to pool",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    
    // Mint USDCx to wallet (via mock)
    chain.mineBlock([
      Tx.contractCall("mock-usdcx", "mint",
        [types.uint(1000000), wallet1.address],
        wallet1.address)
    ]);
    
    // Approve adapter
    chain.mineBlock([
      Tx.contractCall("mock-usdcx", "approve",
        [".usdcx-adapter", types.uint(1000000)],
        wallet1.address)
    ]);
    
    // Deposit to adapter
    const block = chain.mineBlock([
      Tx.contractCall("usdcx-adapter", "execute",
        [types.uint(1000000), types.ascii("deposit")],
        wallet1.address)
    ]);
    
    block.receipts[0].result.expectOk();
    
    // Verify balance
    const balance = chain.callReadOnlyFn(
      "usdcx-adapter",
      "get-balance",
      []
    );
    
    balance.result.expectOk().expectUint(1000000);
  }
});
```

### 4.2 Contrato

```clarity
;; contracts/usdcx-adapter.clar

(impl-trait .adapter-trait.adapter-trait)

(define-constant ALEX-USDCX-POOL 'SP...alex-usdcx-pool)

(define-data-var total-allocated uint u0)
(define-data-var pending-rewards uint u0)

(define-public (execute (amount uint) (action (string-ascii 16)))
  (if (is-eq action "deposit")
    (begin
      (try! (as-contract (contract-call? .usdcx-token transfer amount tx-sender .usdcx-adapter none)))
      (var-set total-allocated (+ (var-get total-allocated) amount))
      (ok { amount: amount, allocated: (var-get total-allocated) })
    )
    (if (is-eq action "withdraw")
      (begin
        (asserts! (<= amount (var-get total-allocated)) ERR-INSUFFICIENT-BALANCE)
        (var-set total-allocated (- (var-get total-allocated) amount))
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
```

---

## 🎯 FASE 5: Enhanced x402 Client (Semana 3-4)

### 5.1 Testes TypeScript

```typescript
// tests/x402-enhanced_test.ts

import { describe, it, assert } from "vitest";
import { EnhancedX402Client } from "../src/x402/enhanced-client";

describe("EnhancedX402Client", () => {
  const client = new EnhancedX402Client({
    facilitatorUrl: "https://x402.testnet.alexlab.co",
    network: "testnet",
    privateKey: "test-private-key",
  });

  describe("createPaymentRequest", () => {
    it("should create payment request with correct format", async () => {
      const request = await client.createPaymentRequest(
        "1000", // 0.001 STX
        "Yield data query",
        "STX",
        "SP123...456"
      );

      assert.equals(request.scheme, "stacks-exact");
      assert.equals(request.price, "1000");
      assert.equals(request.token, "STX");
      assert.equals(request.network, "stacks:testnet");
    });
  });

  describe("payMolbot", () => {
    it("should pay molbot and return proof", async () => {
      const result = await client.payMolbot(
        "SPmolbot123",
        "yield-optimization",
        1000n,
        "STX"
      );

      assert.exists(result.txId);
      assert.exists(result.paymentProof);
    });

    it("should throw if no private key", async () => {
      const noKeyClient = new EnhancedX402Client({
        facilitatorUrl: "https://x402.testnet.alexlab.co",
        network: "testnet",
        privateKey: "",
      });

      await assert.rejects(
        () => noKeyClient.payMolbot("SP123", "test", 1000n, "STX"),
        /AGENT_STACKS_PRIVATE_KEY is required/
      );
    });
  });
});
```

---

## 🎯 FASE 6: Molbot Client TypeScript (Semana 4)

### 6.1 Testes

```typescript
// tests/molbot-client_test.ts

import { describe, it, assert } from "vitest";
import { MolbotClient } from "../src/molbot/client";
import { MockChain } from "./helpers/mock-chain";

describe("MolbotClient", () => {
  const mockChain = new MockChain();
  const client = new MolbotClient({
    registryAddress: "ST1molbot-registry",
    paymentAddress: "ST1molbot-payment",
    agentPrivateKey: "test-key",
  });

  describe("registerService", () => {
    it("should register service on chain", async () => {
      await client.registerService(
        "Yield Copilot",
        "Autonomous yield management",
        ["yield-optimizer", "risk-assessor"],
        1000n,
        "STX"
      );

      const molbot = await mockChain.getMolbot(client.getAddress());
      assert.equals(molbot.name, "Yield Copilot");
      assert.includes(molbot.capabilities, "yield-optimizer");
    });
  });

  describe("executeTask", () => {
    it("should execute task and return result", async () => {
      const result = await client.executeTask(
        "SPtarget123",
        "yield-optimization",
        { amount: "1000", tokens: ["sBTC"] }
      );

      assert.exists(result.protocol);
      assert.exists(result.apy);
    });
  });
});
```

---

## 📋 Checklist TDD por Feature

| Feature | Teste Primeiro? | Status |
|---------|-----------------|--------|
| ERC-8004 Identity | ✅ Sim | 🔲 Pendente |
| Molbot Registry | ✅ Sim | 🔲 Pendente |
| Molbot Payment | ✅ Sim | 🔲 Pendente |
| USDCx Adapter | ✅ Sim | 🔲 Pendente |
| Enhanced x402 | ✅ Sim | 🔲 Pendente |
| Molbot Client TS | ✅ Sim | 🔲 Pendente |
| Yield Manager | ✅ Sim | 🔲 Pendente |
| Revenue Manager | ✅ Sim | 🔲 Pendente |

---

## 🏃 Como Executar

### Rodar todos os testes
```bash
# Clarity tests
clarinet test

# TypeScript tests
npm test
```

### Rodar teste específico
```bash
clarinet test --filter molbot-registry
npm test -- --grep "MolbotClient"
```

### Modo watch
```bash
clarinet test --watch
npm test -- --watch
```

---

## 📁 Estrutura de Arquivos

```
tests/
├── clarity/
│   ├── erc8004-identity_test.ts
│   ├── molbot-registry_test.ts
│   ├── molbot-payment_test.ts
│   └── usdcx-adapter_test.ts
└── typescript/
    ├── x402-enhanced_test.ts
    ├── molbot-client_test.ts
    └── yield-manager_test.ts
```

---

## ✅ Regra de Ouro TDD

> **NUNCA escreva código de implementação sem um teste que falha primeiro.**

1. Escreva o teste
2. Veja falhar
3. Implemente o mínimo
4. Veja passar
5. Refatore
6. Repita
