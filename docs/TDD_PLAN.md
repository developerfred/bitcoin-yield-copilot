# TDD Plan - Bitcoin Yield Copilot

## TDD Principles

1. **Write test first** - The test should initially fail
2. **Watch the test fail** - Confirm that the test captures the requirement
3. **Implement the minimum** - Just enough to pass
4. **Refactor** - Improve code while keeping tests passing
5. **Repeat** - Next requirement

---

## Phase 1: ERC-8004 Identity (Week 1)

### 1.1 Tests First

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
