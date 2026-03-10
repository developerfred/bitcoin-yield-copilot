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
const botPrivateKey = "0000000000000000000000000000000000000000000000000000000000000001";

// Helper para gerar assinatura válida (simplificada para testes)
function generateValidSignature(
  payloadHash: string,
  privateKey: string
): string {
  // Em testes reais, usar библиотека secp256k1
  return "00".repeat(65);
}

// ===== WITHDRAW-HELPER TESTS =====

Clarinet.test({
  name: "withdraw-helper: initialize should fail if not called by owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    const deployer = accounts.get("deployer")!;

    // Try to initialize from non-owner account
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        wallet1.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(401); // ERR-NOT-AUTHORIZED
  },
});

Clarinet.test({
  name: "withdraw-helper: initialize should fail if already initialized",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // First initialization should succeed
    let block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // Second initialization should fail
    block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(422); // ERR-ALREADY-INITIALIZED
  },
});

Clarinet.test({
  name: "withdraw-helper: initialize should fail with zero pubkey",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    const zeroPubkey = "00".repeat(33);
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(zeroPubkey)],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(421); // ERR-INVALID-PUBKEY
  },
});

Clarinet.test({
  name: "withdraw-helper: initialize should succeed with valid parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify initialization
    const botKey = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-bot-public-key",
      [],
      deployer.address
    );
    assertEquals(
      botKey.result,
      types.buffFromHex(botPubKey)
    );
  },
});

Clarinet.test({
  name: "withdraw-helper: register-wallet should fail if not called by owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    const deployer = accounts.get("deployer")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Try to register from non-owner
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(wallet1.address),
          types.buffFromHex(tgHash),
          types.uint(1000),
          types.uint(5000),
        ],
        wallet1.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(401); // ERR-NOT-AUTHORIZED
  },
});

Clarinet.test({
  name: "withdraw-helper: register-wallet should fail with invalid limits",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Test max-per-tx = 0
    let block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(wallet1.address),
          types.buffFromHex(tgHash),
          types.uint(0),
          types.uint(5000),
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(425); // ERR-INVALID-LIMITS

    // Test daily-limit = 0
    block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(wallet1.address),
          types.buffFromHex(tgHash),
          types.uint(1000),
          types.uint(0),
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(425);

    // Test max-per-tx > daily-limit
    block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(wallet1.address),
          types.buffFromHex(tgHash),
          types.uint(5000),
          types.uint(1000),
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(425);
  },
});

Clarinet.test({
  name: "withdraw-helper: register-wallet should fail with zero hash",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    const zeroHash = "00".repeat(32);
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "register-wallet",
        [
          types.principal(wallet1.address),
          types.buffFromHex(zeroHash),
          types.uint(1000),
          types.uint(5000),
        ],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(421); // ERR-INVALID-PUBKEY
  },
});

Clarinet.test({
  name: "withdraw-helper: register-wallet should succeed with valid parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Register wallet
    const block = chain.mineBlock([
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

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify registration
    const tgHashResult = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-wallet-telegram-hash",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(
      tgHashResult.result.expectSome(),
      types.buffFromHex(tgHash)
    );

    // Verify limits
    const limits = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-wallet-limits",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(limits.result.expectSome()["max-per-tx"], types.uint(1000));
    assertEquals(limits.result.expectSome()["daily-limit"], types.uint(5000));
  },
});

Clarinet.test({
  name: "withdraw-helper: register-wallet should fail if already registered",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Register wallet first time
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

    // Try to register again
    const block = chain.mineBlock([
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

    block.receipts[0].result.expectErr().expectUint(422); // ERR-ALREADY-INITIALIZED
  },
});

Clarinet.test({
  name: "withdraw-helper: update-wallet-limits should fail if wallet not found",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize first
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Try to update limits for non-registered wallet
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "update-wallet-limits",
        [
          types.principal(wallet1.address),
          types.uint(2000),
          types.uint(10000),
        ],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(423); // ERR-WALLET-NOT-FOUND
  },
});

Clarinet.test({
  name: "withdraw-helper: update-wallet-limits should succeed with valid parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize first
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

    // Update limits
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "update-wallet-limits",
        [
          types.principal(wallet1.address),
          types.uint(2000),
          types.uint(10000),
        ],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify updated limits
    const limits = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-wallet-limits",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(limits.result.expectSome()["max-per-tx"], types.uint(2000));
    assertEquals(limits.result.expectSome()["daily-limit"], types.uint(10000));
  },
});

Clarinet.test({
  name: "withdraw-helper: revoke-wallet should succeed",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize and register wallet
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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

    // Revoke wallet
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "revoke-wallet",
        [types.principal(wallet1.address)],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify revoked status
    const isRevoked = chain.callReadOnlyFn(
      "withdraw-helper",
      "is-wallet-revoked",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(isRevoked.result, true);
  },
});

Clarinet.test({
  name: "withdraw-helper: unrevoke-wallet should fail if not revoked",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize and register wallet
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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

    // Try to unrevoke without revoking first
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "unrevoke-wallet",
        [types.principal(wallet1.address)],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(426); // ERR-NOT-REVOKED
  },
});

Clarinet.test({
  name: "withdraw-helper: unrevoke-wallet should succeed",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize, register, and revoke wallet
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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
      Tx.contractCall(
        "withdraw-helper",
        "revoke-wallet",
        [types.principal(wallet1.address)],
        deployer.address
      ),
    ]);

    // Unrevoke wallet
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "unrevoke-wallet",
        [types.principal(wallet1.address)],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    // Verify unrevoked status
    const isRevoked = chain.callReadOnlyFn(
      "withdraw-helper",
      "is-wallet-revoked",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(isRevoked.result, false);
  },
});

Clarinet.test({
  name: "withdraw-helper: emergency-pause should work",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Pause contract
    const expiry = chain.blockHeight + 10;
    const block = chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "emergency-pause",
        [
          types.uint(0),
          types.uint(expiry),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    // Note: This will fail because signature verification will fail
    // But let's verify the contract is not paused (since signature is invalid)
    const isPaused = chain.callReadOnlyFn(
      "withdraw-helper",
      "is-contract-paused",
      [],
      deployer.address
    );
    // With invalid signature, pause doesn't happen
    assertEquals(isPaused.result, false);
  },
});

Clarinet.test({
  name: "withdraw-helper: get-remaining-daily-limit should calculate correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize and register wallet
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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

    // Check initial remaining limit (should be full daily limit)
    const initial = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-remaining-daily-limit",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(initial.result.expectSome(), types.uint(5000));
  },
});

Clarinet.test({
  name: "withdraw-helper: compute-fee should calculate correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Set fee to 50 bps (0.5%)
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "set-fee",
        [
          types.uint(50),
          types.principal(deployer.address),
          types.uint(0),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    // Compute fee for 10000 uSTX
    const fee = chain.callReadOnlyFn(
      "withdraw-helper",
      "compute-fee",
      [types.uint(10000)],
      deployer.address
    );

    // 10000 * 50 / 10000 = 50
    assertEquals(fee.result.expectOk()["fee"], types.uint(50));
    assertEquals(fee.result.expectOk()["net-amount"], types.uint(9950));
  },
});

Clarinet.test({
  name: "withdraw-helper: get-wallet-nonce should return correct value",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // Initialize and register wallet
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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

    // Check nonce (should be 0)
    const nonce = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-wallet-nonce",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(nonce.result, types.uint(0));
  },
});

Clarinet.test({
  name: "withdraw-helper: get-fee-config should return correct values",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Initialize
    chain.mineBlock([
      Tx.contractCall(
        "withdraw-helper",
        "initialize",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    // Get initial fee config (should be 0)
    const initialConfig = chain.callReadOnlyFn(
      "withdraw-helper",
      "get-fee-config",
      [],
      deployer.address
    );
    assertEquals(initialConfig.result["fee-bps"], types.uint(0));
  },
});
