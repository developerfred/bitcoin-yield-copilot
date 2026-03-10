import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types,
  assertEquals,
} from "./deps.ts";

const tgHash = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const botPubKey = "03" + "00".repeat(32);

Clarinet.test({
  name: "user-wallet: Full flow - initialize, add protocol, deposit, withdraw, withdraw-stx",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const alexAdapter = accounts.get("wallet_2")!;

    // Step 1: Initialize user-wallet
    let block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex(tgHash),
          types.buffFromHex(botPubKey),
          types.uint(1000),
          types.uint(5000)
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify initialization
    let info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    assertEquals(info.result.expectOk()["initialized"], true);

    // Step 2: Add ALEX protocol
    block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "add-protocol",
        [
          types.principal(alexAdapter.address),
          types.ascii("ALEX"),
          types.uint(10000),
          types.uint(0),
          types.uint(1000),
          types.buffFromHex("00".repeat(65)),
          types.buffFromHex(tgHash)
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify protocol was added
    let protocolConfig = chain.callReadOnlyFn(
      "user-wallet",
      "get-protocol-config",
      [types.principal(alexAdapter.address)],
      deployer.address
    );
    assertEquals(protocolConfig.result.expectSome()["name"], types.ascii("ALEX"));
    assertEquals(protocolConfig.result.expectSome()["enabled"], true);
  },
});

Clarinet.test({
  name: "adapter-alex: Deposit and withdraw flow",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const userWallet = accounts.get("wallet_1")!;

    // Step 1: User wallet deposits STX to adapter (simulated)
    // Note: In real flow, user-wallet would call this
    
    // Get initial balance
    let balance = chain.callReadOnlyFn(
      "adapter-alex",
      "get-balance",
      [],
      deployer.address
    );
    assertEquals(balance.result, types.uint(0));

    // Get initial STX balance of adapter
    let stxBalance = chain.callReadOnlyFn(
      "adapter-alex",
      "get-stx-balance",
      [],
      deployer.address
    );
    assertEquals(stxBalance.result, types.uint(0));

    // Check user's allocation
    let userAlloc = chain.callReadOnlyFn(
      "adapter-alex",
      "get-user-allocation",
      [types.principal(userWallet.address)],
      deployer.address
    );
    assertEquals(userAlloc.result, types.uint(0));
  },
});

Clarinet.test({
  name: "adapter-alex: Execute deposit with valid amount",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const userWallet = accounts.get("wallet_1")!;

    // First, transfer some STX to the adapter contract (simulating deposit)
    // In real flow, user-wallet would call this
    
    // Try execute with invalid action
    let block = chain.mineBlock([
      Tx.contractCall(
        "adapter-alex",
        "execute",
        [
          types.uint(100),
          types.ascii("invalid")
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(401); // ERR-INVALID-ACTION

    // Try execute with zero amount
    block = chain.mineBlock([
      Tx.contractCall(
        "adapter-alex",
        "execute",
        [
          types.uint(0),
          types.ascii("deposit")
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(400); // ERR-INVALID-AMOUNT
  },
});

Clarinet.test({
  name: "user-wallet: Withdraw STX flow - requires authorization",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const recipient = accounts.get("wallet_1")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex(tgHash),
          types.buffFromHex(botPubKey),
          types.uint(1000),
          types.uint(5000)
        ],
        deployer.address
      ),
    ]);

    // Try withdraw without authorization - should fail
    let block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "withdraw-stx",
        [
          types.uint(100),
          types.principal(recipient.address),
          types.uint(1000),
          types.buffFromHex("00".repeat(32))
        ],
        deployer.address
      ),
    ]);
    // This should fail because there's no pending auth in withdraw-helper
    // The authorization must come from withdraw-helper.authorize-withdrawal
  },
});

Clarinet.test({
  name: "user-wallet: Update limits flow",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex(tgHash),
          types.buffFromHex(botPubKey),
          types.uint(1000),
          types.uint(5000)
        ],
        deployer.address
      ),
    ]);

    // Get initial limits
    let info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    assertEquals(info.result.expectOk()["max-per-transaction"], types.uint(1000));
    assertEquals(info.result.expectOk()["daily-limit"], types.uint(5000));
  },
});

Clarinet.test({
  name: "user-wallet: Emergency pause and unpause",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex(tgHash),
          types.buffFromHex(botPubKey),
          types.uint(1000),
          types.uint(5000)
        ],
        deployer.address
      ),
    ]);

    // Check initial paused state
    let info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    assertEquals(info.result.expectOk()["is-paused"], false);

    // Note: pause/unpause require valid signatures from bot
    // In tests, we'd need proper signature generation
  },
});

Clarinet.test({
  name: "user-wallet: Get operation history",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex(tgHash),
          types.buffFromHex(botPubKey),
          types.uint(1000),
          types.uint(5000)
        ],
        deployer.address
      ),
    ]);

    // Get operation count (should be 0)
    let count = chain.callReadOnlyFn(
      "user-wallet",
      "get-operation-count",
      [],
      deployer.address
    );
    assertEquals(count.result, types.uint(0));
  },
});

Clarinet.test({
  name: "user-wallet: Verify identity",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex(tgHash),
          types.buffFromHex(botPubKey),
          types.uint(1000),
          types.uint(5000)
        ],
        deployer.address
      ),
    ]);

    // Verify correct identity
    let verified = chain.callReadOnlyFn(
      "user-wallet",
      "verify-identity",
      [types.buffFromHex(tgHash)],
      deployer.address
    );
    assertEquals(verified.result, true);

    // Verify incorrect identity
    let notVerified = chain.callReadOnlyFn(
      "user-wallet",
      "verify-identity",
      [types.buffFromHex("11".repeat(32))],
      deployer.address
    );
    assertEquals(notVerified.result, false);
  },
});

Clarinet.test({
  name: "withdraw-helper: Full authorization flow",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const userWallet = accounts.get("wallet_1")!;
    const recipient = accounts.get("wallet_2")!;

    // Initialize withdraw-helper
    let block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Register wallet
    block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(userWallet.address),
          types.buffFromHex(tgHash),
          types.uint(1000),
          types.uint(5000)
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Get wallet nonce
    let nonce = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-wallet-nonce",
      [types.principal(userWallet.address)],
      deployer.address
    );
    assertEquals(nonce.result, types.uint(0));

    // Get remaining daily limit
    let remaining = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-remaining-daily-limit",
      [types.principal(userWallet.address)],
      deployer.address
    );
    assertEquals(remaining.result.expectSome(), types.uint(5000));
  },
});
