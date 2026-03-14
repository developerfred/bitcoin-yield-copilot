# tdd-clarity

> Test-Driven Development para Contratos Clarity usando Clarinet

## Overview

Esta skill define o fluxo TDD para desenvolver contratos Clarity com testes primeiro.

## Fluxo TDD

### Passo 1: Escreva o Teste Primeiro

```typescript
// tests/my-contract_test.ts
import { Clarinet, Tx, Chain, Account, types } from "./deps.ts";

Clarinet.test({
  name: "contract: should do X when Y",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet = accounts.get("wallet_1")!;
    
    // Execute contract call
    const block = chain.mineBlock([
      Tx.contractCall(
        "my-contract",
        "function-name",
        [types.uint(100)],
        wallet.address
      )
    ]);
    
    // Assert expected result
    block.receipts[0].result.expectOk();
  }
});
```

### Passo 2: Rode o Teste (Deve Falhar)

```bash
clarinet test tests/my-contract_test.ts
```

**Esperado**: Erro de compilação ou teste falho porque o contrato não existe ainda.

### Passo 3: Implemente o Mínimo

```clarity
;; contracts/my-contract.clar

(define-public (function-name (amount uint))
  (ok amount)
)
```

### Passo 4: Rode o Teste (Deve Passar)

```bash
clarinet test tests/my-contract_test.ts
```

### Passo 5: Refatore se Necessário

### Passo 6: Repita para Próximo Requisito

---

## Padrões de Teste

### Teste de Função Pública (com transação)

```typescript
Clarinet.test({
  name: "function: should succeed with valid input",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "contract-name",
        "public-function",
        [types.uint(100), types.ascii("param")],
        user.address
      )
    ]);
    
    // Happy path
    block.receipts[0].result.expectOk();
    
    // Check state changes
    const state = chain.callReadOnlyFn(
      "contract-name",
      "get-state",
      []
    );
    state.result.expectOk();
  }
});
```

### Teste de Função de Falha

```typescript
Clarinet.test({
  name: "function: should fail with invalid input",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "contract-name",
        "public-function",
        [types.uint(0)],  // Invalid: zero amount
        user.address
      )
    ]);
    
    // Should return error
    block.receipts[0].result.expectErr().expectUint(401); // ERR-ZERO-amount
  }
});
```

### Teste de Função Read-Only

```typescript
Clarinet.test({
  name: "read-only: should return correct value",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // Set up state first
    chain.mineBlock([
      Tx.contractCall("contract", "setup", [], accounts.get("wallet_1")!.address)
    ]);
    
    // Query read-only function
    const result = chain.callReadOnlyFn(
      "contract-name",
      "read-only-function",
      [types.uint(42)]
    );
    
    result.result.expectOk().expectUint(42);
  }
});
```

### Teste de Integração Multi-Contrato

```typescript
Clarinet.test({
  name: "integration: contract A should call contract B",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    // Contract A calls Contract B
    const block = chain.mineBlock([
      Tx.contractCall(
        "contract-a",
        "call-b",
        [types.uint(100)],
        user.address
      )
    ]);
    
    // Verify B was called
    block.receipts[0].result.expectOk();
    
    // Verify B's state changed
    const bState = chain.callReadOnlyFn("contract-b", "get-value", []);
    bState.result.expectOk().expectUint(100);
  }
});
```

---

## Comandos

```bash
# Run all tests
clarinet test

# Run specific test file
clarinet test tests/my-contract_test.ts

# Run tests matching pattern
clarinet test --filter "contract-name"

# Run with coverage
clarinet test --coverage

# Run with costs
clarinet test --costs

# Watch mode
clarinet test --watch

# Debug output
DEBUG=1 clarinet test
```

---

## Boas Práticas

| Prática | Descrição |
|---------|-----------|
| Um teste por função | Cada teste deve coverir uma função específica |
| Nome descritivo | "should deposit USDCx when user has balance" |
| Arrange-Act-Assert | Setup → Execute → Verify |
| Teste Happy Path | Funcionamento normal primeiro |
| Teste Edge Cases | Zero, máximo, negativo |
| Teste Erros | Todos os códigos de erro |
| Teste Limites | String length, uint max |

---

## Estrutura de Teste

```
tests/
├── deps.ts              # Imports padrão
├── helpers.ts          # Funções auxiliares
├── contract-name_test.ts
│   ├── describe "contract-name"
│   │   ├── it "should do X"
│   │   ├── it "should fail when Y"
│   │   └── it "should handle edge case Z"
│   └── describe "function-name"
│       ├── it "should succeed"
│       └── it "should error"
└── integration_test.ts
```

---

## Exemplos no Projeto

Veja testes existentes como referência:

- `tests/user-wallet_test.ts` - Testes de wallet
- `tests/wallet-factory_test.ts` - Testes de factory
- `tests/alex-adapter_test.ts` - Testes de adapter
