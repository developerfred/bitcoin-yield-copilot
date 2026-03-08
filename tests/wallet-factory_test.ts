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

// ===== WALLET-FACTORY TESTS =====

Clarinet.test({
  name: "wallet-factory: configure should fail if not called by owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    const deployer = accounts.get("deployer")!;

    const block = chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        wallet1.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(401);
  },
});

Clarinet.test({
  name: "wallet-factory: configure should fail if already configured",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    let block = chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    block = chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(401);
  },
});

Clarinet.test({
  name: "wallet-factory: configure should succeed with valid pubkey",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    const block = chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);

    const savedPubkey = chain.callReadOnlyFn(
      "wallet-factory",
      "get-bot-pubkey",
      [],
      deployer.address
    );
    assertEquals(savedPubkey.result, types.buffFromHex(botPubKey));
  },
});

Clarinet.test({
  name: "wallet-factory: register-wallet should fail if not configured",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    const deployer = accounts.get("deployer")!;

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

    block.receipts[0].result.expectErr().expectUint(412);
  },
});

Clarinet.test({
  name: "wallet-factory: register-wallet should succeed with valid parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

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

    const wallet = chain.callReadOnlyFn(
      "wallet-factory",
      "get-wallet",
      [types.buffFromHex(tgHash)],
      deployer.address
    );
    assertEquals(wallet.result.expectSome()["active"], true);
  },
});

Clarinet.test({
  name: "wallet-factory: register-wallet should fail if already exists",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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

    const block = chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "register-wallet",
        [
          types.buffFromHex(tgHash),
          types.principal(wallet1.address),
          types.uint(1),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(409);
  },
});

Clarinet.test({
  name: "wallet-factory: deactivate-wallet should succeed",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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

    const block = chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "deactivate-wallet",
        [
          types.buffFromHex(tgHash),
          types.uint(1),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    const wallet = chain.callReadOnlyFn(
      "wallet-factory",
      "get-wallet",
      [types.buffFromHex(tgHash)],
      deployer.address
    );
    assertEquals(wallet.result.expectSome()["active"], false);
  },
});

Clarinet.test({
  name: "wallet-factory: reactivate-wallet should succeed",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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
      Tx.contractCall(
        "wallet-factory",
        "deactivate-wallet",
        [
          types.buffFromHex(tgHash),
          types.uint(1),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    const block = chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "reactivate-wallet",
        [
          types.buffFromHex(tgHash),
          types.uint(2),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    const wallet = chain.callReadOnlyFn(
      "wallet-factory",
      "get-wallet",
      [types.buffFromHex(tgHash)],
      deployer.address
    );
    assertEquals(wallet.result.expectSome()["active"], true);
  },
});

Clarinet.test({
  name: "wallet-factory: is-registered-wallet should work correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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

    const isRegistered = chain.callReadOnlyFn(
      "wallet-factory",
      "is-registered-wallet",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(isRegistered.result, true);
  },
});

Clarinet.test({
  name: "wallet-factory: is-active-wallet should reflect active status",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
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

    const isActive = chain.callReadOnlyFn(
      "wallet-factory",
      "is-active-wallet",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(isActive.result, true);
  },
});

Clarinet.test({
  name: "wallet-factory: get-total-wallets should increment correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;
    const wallet2 = accounts.get("wallet_2")!;

    const tgHash1 = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    const tgHash2 = "112233445566778899aabbccddeeff00112233445566778899aabbccddee";

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    let total = chain.callReadOnlyFn(
      "wallet-factory",
      "get-total-wallets",
      [],
      deployer.address
    );
    assertEquals(total.result, types.uint(0));

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "register-wallet",
        [
          types.buffFromHex(tgHash1),
          types.principal(wallet1.address),
          types.uint(0),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    total = chain.callReadOnlyFn(
      "wallet-factory",
      "get-total-wallets",
      [],
      deployer.address
    );
    assertEquals(total.result, types.uint(1));

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "register-wallet",
        [
          types.buffFromHex(tgHash2),
          types.principal(wallet2.address),
          types.uint(1),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    total = chain.callReadOnlyFn(
      "wallet-factory",
      "get-total-wallets",
      [],
      deployer.address
    );
    assertEquals(total.result, types.uint(2));
  },
});

Clarinet.test({
  name: "wallet-factory: get-factory-nonce should increment correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    const tgHash1 = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
    ]);

    let nonce = chain.callReadOnlyFn(
      "wallet-factory",
      "get-factory-nonce",
      [],
      deployer.address
    );
    assertEquals(nonce.result, types.uint(0));

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "register-wallet",
        [
          types.buffFromHex(tgHash1),
          types.principal(wallet1.address),
          types.uint(0),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    nonce = chain.callReadOnlyFn(
      "wallet-factory",
      "get-factory-nonce",
      [],
      deployer.address
    );
    assertEquals(nonce.result, types.uint(1));
  },
});

Clarinet.test({
  name: "wallet-factory: get-wallet-owner should return correct tg-hash",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    const tgHash1 = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

    chain.mineBlock([
      Tx.contractCall(
        "wallet-factory",
        "configure",
        [types.buffFromHex(botPubKey)],
        deployer.address
      ),
      Tx.contractCall(
        "wallet-factory",
        "register-wallet",
        [
          types.buffFromHex(tgHash1),
          types.principal(wallet1.address),
          types.uint(0),
          types.buffFromHex("00".repeat(65)),
        ],
        deployer.address
      ),
    ]);

    const owner = chain.callReadOnlyFn(
      "wallet-factory",
      "get-wallet-owner",
      [types.principal(wallet1.address)],
      deployer.address
    );
    assertEquals(owner.result.expectSome(), types.buffFromHex(tgHash1));
  },
});
