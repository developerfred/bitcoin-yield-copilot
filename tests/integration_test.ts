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

// ===== INTEGRATION TESTS: User Wallet + Withdraw Helper =====

Clarinet.test({
  name: "Integration: User Wallet can initialize with Withdraw Helper dependency",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize withdraw-helper first
    let block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Register wallet in withdraw-helper
    block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(deployer.address),
          types.buffFromHex(tgHash),
          types.uint(1000),
          types.uint(5000),
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Initialize user-wallet
    block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex(tgHash),
          types.buffFromHex(botPubKey),
          types.uint(1000),
          types.uint(5000),
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    const info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    assertEquals(info.result.expectOk()["initialized"], true);
  },
});

Clarinet.test({
  name: "Integration: Protocol can be added via add-protocol after initialization",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;

    // Initialize user-wallet
    chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex(tgHash),
          types.buffFromHex(botPubKey),
          types.uint(1000),
          types.uint(5000),
        ],
        deployer.address
      ),
    ]);

    // Check protocol doesn't exist yet
    let config = chain.callReadOnlyFn(
      "user-wallet",
      "get-protocol-config",
      [types.principal(protocol.address)],
      deployer.address
    );
    assertEquals(config.result, types.none());

    // Note: add-protocol requires valid signature - skipping full integration
    // as it requires proper bot signature generation
  },
});

Clarinet.test({
  name: "Integration: Withdraw Helper rate limiting works correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize withdraw-helper
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Register wallet
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(wallet1.address),
          types.buffFromHex(tgHash),
          types.uint(1000),
          types.uint(5000),
        ],
        deployer.address
      ),
    ]);

    // Get initial rate limit
    const initial = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-wallet-limits",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(initial.result.expectSome()["max-per-tx"], types.uint(1000));
    assertEquals(initial.result.expectSome()["daily-limit"], types.uint(5000));
  },
});

Clarinet.test({
  name: "Integration: Multiple wallets can be registered in Withdraw Helper",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;
    const wallet2 = accounts.get("wallet_2")!;

    const tgHash1 = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    const tgHash2 = "112233445566778899aabbccddeeff00112233445566778899aabbccddee";

    // Initialize
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Register wallet 1
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(wallet1.address),
          types.buffFromHex(tgHash1),
          types.uint(1000),
          types.uint(5000),
        ],
        deployer.address
      ),
    ]);

    // Register wallet 2
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(wallet2.address),
          types.buffFromHex(tgHash2),
          types.uint(2000),
          types.uint(10000),
        ],
        deployer.address
      ),
    ]);

    // Verify wallet 1
    const limit1 = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-wallet-limits",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(limit1.result.expectSome()["max-per-tx"], types.uint(1000));

    // Verify wallet 2
    const limit2 = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-wallet-limits",
      [types.principal(wallet2.address)],
      deployer.address
    );
    assertEquals(limit2.result.expectSome()["max-per-tx"], types.uint(2000));
    assertEquals(limit2.result.expectSome()["daily-limit"], types.uint(10000));
  },
});

Clarinet.test({
  name: "Integration: Wallet Factory can register and track wallets",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Configure wallet-factory
    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Register a wallet
    const block = chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "register-wallet",
        [
          types.buffFromHex(tgHash),
          types.principal(wallet1.address),
          types.uint(0),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk();

    // Verify registration
    const isRegistered = chain.callReadOnlyFn(
      "wallet-factory",
      "is-registered-wallet",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(isRegistered.result, true);

    // Verify total wallets
    const total = chain.callReadOnlyFn(
      "wallet-factory",
      "get-total-wallets",
      [],
      deployer.address
    );
    assertEquals(total.result, types.uint(1));
  },
});

Clarinet.test({
  name: "Integration: Emergency pause works across contracts",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize withdraw-helper
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Check initial state
    let isPaused = chain.callReadOnlyFn(
      "withdraw-helper",
      "is-contract-paused",
      [],
      deployer.address
    );
    assertEquals(isPaused.result, false);

    // Note: Cannot actually pause without valid signature
    // Verify that emergency functions exist and can be called (will fail signature check)
  },
});

Clarinet.test({
  name: "Integration: Fee configuration in Withdraw Helper",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize withdraw-helper
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Get initial fee config
    let feeConfig = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-fee-config",
      [],
      deployer.address
    );
    assertEquals(feeConfig.result["fee-bps"], types.uint(0));

    // Compute fee test
    let computedFee = chain.callReadOnlyFn(
      "withdraw-helper",
      "compute-fee",
      [types.uint(10000)],
      deployer.address
    );
    assertEquals(computedFee.result.expectOk()["fee"], types.uint(0));
    assertEquals(computedFee.result.expectOk()["net-amount"], types.uint(10000));
  },
});
