import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types,
  assertEquals,
} from "./deps.ts";

Clarinet.test({
  name: "Initialization: should fail with invalid limits",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    // Test max-per-tx = 0
    let block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"),
          types.buffFromHex("03" + "00".repeat(32)),
          types.uint(0),
          types.uint(5000)
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(410); // ERR-INVALID-LIMITS
    
    // Test daily-limit = 0
    block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"),
          types.buffFromHex("03" + "00".repeat(32)),
          types.uint(1000),
          types.uint(0)
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(410);
    
    // Test max-per-tx > daily-limit
    block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "initialize",
        [
          types.buffFromHex("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"),
          types.buffFromHex("03" + "00".repeat(32)),
          types.uint(5000),
          types.uint(1000)
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(410);
  },
});

Clarinet.test({
  name: "Initialization: should succeed with valid parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    
    const tgHash = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    const botPubKey = "03" + "00".repeat(32);
    
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
      )
    ]);
    
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Verify initialization
    let info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    
    assertEquals(info.result.expectOk()['initialized'], true);
    assertEquals(info.result.expectOk()['max-per-transaction'], types.uint(1000));
    assertEquals(info.result.expectOk()['daily-limit'], types.uint(5000));
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail when contract not initialized",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(wallet1.address),
          types.ascii("transfer"),
          types.uint(100),
          types.uint(1000),
          types.buffFromHex("00".repeat(65))
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(408); // ERR-NOT-INITIALIZED
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail when contract paused",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    // Initialize contract
    await initializeContract(chain, deployer, protocol);
    
    // Pause contract
    let pauseBlock = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "emergency-pause",
        [types.buffFromHex(tgHash)],
        deployer.address
      )
    ]);
    pauseBlock.receipts[0].result.expectOk().expectBool(true);
    
    // Try to execute operation
    let block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(100),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex("00".repeat(65))
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(405); // ERR-PAUSED
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail with zero amount",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(0),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex("00".repeat(65))
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(411); // ERR-ZERO-AMOUNT
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail with invalid nonce",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(999), // Invalid nonce
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(100),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex("00".repeat(65))
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(404); // ERR-EXPIRED
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail with expired block",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(100),
          types.uint(chain.blockHeight - 1), // Expired
          types.buffFromHex("00".repeat(65))
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(404); // ERR-EXPIRED
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail with invalid signature",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(100),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex("00".repeat(65)) // Invalid signature
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(402); // ERR-INVALID-SIGNATURE
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail with unknown protocol",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    const unknownProtocol = accounts.get("wallet_3")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Generate valid signature (you'll need to implement actual signature generation)
    const validSig = generateValidSignature(0, 100, chain.blockHeight + 10, botPrivateKey);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(unknownProtocol.address), // Unknown protocol
          types.ascii("transfer"),
          types.uint(100),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex(validSig)
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(406); // ERR-UNKNOWN-PROTOCOL
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail exceeding max-per-tx",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Generate valid signature for amount > max-per-tx
    const validSig = generateValidSignature(0, 2000, chain.blockHeight + 10, botPrivateKey);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(2000), // > max-per-tx (1000)
          types.uint(chain.blockHeight + 10),
          types.buffFromHex(validSig)
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(403); // ERR-LIMIT-EXCEEDED
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should fail exceeding daily limit",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // First operation - 800
    let sig1 = generateValidSignature(0, 800, chain.blockHeight + 10, botPrivateKey);
    let block1 = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(800),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex(sig1)
        ],
        deployer.address
      )
    ]);
    block1.receipts[0].result.expectOk();
    
    // Second operation - 300 (would exceed daily limit of 1000)
    let sig2 = generateValidSignature(1, 300, chain.blockHeight + 10, botPrivateKey);
    let block2 = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(1),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(300),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex(sig2)
        ],
        deployer.address
      )
    ]);
    
    block2.receipts[0].result.expectErr().expectUint(407); // ERR-DAILY-LIMIT
  },
});

Clarinet.test({
  name: "execute-authorized-operation: should succeed with valid parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Generate valid signature
    const amount = 500;
    const expiry = chain.blockHeight + 10;
    const sig = generateValidSignature(0, amount, expiry, botPrivateKey);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(amount),
          types.uint(expiry),
          types.buffFromHex(sig)
        ],
        deployer.address
      )
    ]);
    
    const result = block.receipts[0].result.expectOk();
    assertEquals(result['nonce'], types.uint(0));
    assertEquals(result['protocol'], types.principal(protocol.address));
    assertEquals(result['action'], types.ascii("transfer"));
    assertEquals(result['amount'], types.uint(amount));
    
    // Verify operation history
    let operation = chain.callReadOnlyFn(
      "user-wallet",
      "get-operation",
      [types.uint(0)],
      deployer.address
    );
    
    assertEquals(operation.result.expectSome()['nonce'], types.uint(0));
    assertEquals(operation.result.expectSome()['amount'], types.uint(amount));
    
    // Verify operation count
    let count = chain.callReadOnlyFn(
      "user-wallet",
      "get-operation-count",
      [],
      deployer.address
    );
    assertEquals(count.result, types.uint(1));
  },
});

Clarinet.test({
  name: "emergency-pause: should only work with valid telegram proof",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Try with invalid proof
    let block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "emergency-pause",
        [types.buffFromHex("00".repeat(32))], // Invalid proof
        deployer.address
      )
    ]);
    block.receipts[0].result.expectErr().expectUint(401);
    
    // Try with valid proof
    block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "emergency-pause",
        [types.buffFromHex(tgHash)],
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Verify paused state
    let info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    assertEquals(info.result.expectOk()['is-paused'], true);
  },
});

Clarinet.test({
  name: "unpause: should work with valid signature",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // First pause
    chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "emergency-pause",
        [types.buffFromHex(tgHash)],
        deployer.address
      )
    ]);
    
    // Generate valid unpause signature
    const expiry = chain.blockHeight + 10;
    const sig = generateUnpauseSignature(0, expiry, botPrivateKey);
    
    // Try to unpause
    let block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "unpause",
        [
          types.uint(0),
          types.uint(expiry),
          types.buffFromHex(sig)
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Verify unpaused
    let info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    assertEquals(info.result.expectOk()['is-paused'], false);
    assertEquals(info.result.expectOk()['current-nonce'], types.uint(1));
  },
});

Clarinet.test({
  name: "update-limits: should only work with valid proofs and signatures",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Test with invalid limits
    let sig = generateLimitsSignature(0, 0, 5000, chain.blockHeight + 10, botPrivateKey);
    let block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "update-limits",
        [
          types.uint(0),
          types.uint(5000),
          types.uint(0),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex(sig),
          types.buffFromHex(tgHash)
        ],
        deployer.address
      )
    ]);
    block.receipts[0].result.expectErr().expectUint(410);
    
    // Test with valid parameters
    sig = generateLimitsSignature(0, 2000, 10000, chain.blockHeight + 10, botPrivateKey);
    block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "update-limits",
        [
          types.uint(2000),
          types.uint(10000),
          types.uint(0),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex(sig),
          types.buffFromHex(tgHash)
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Verify updated limits
    let info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    assertEquals(info.result.expectOk()['max-per-transaction'], types.uint(2000));
    assertEquals(info.result.expectOk()['daily-limit'], types.uint(10000));
  },
});

Clarinet.test({
  name: "add-protocol: should add new protocol with valid signatures",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    const newProtocol = accounts.get("wallet_3")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Generate signature for adding protocol
    const sig = generateAddProtocolSignature(0, 3000, chain.blockHeight + 10, botPrivateKey);
    
    let block = chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "add-protocol",
        [
          types.principal(newProtocol.address),
          types.ascii("new-protocol"),
          types.uint(3000),
          types.uint(0),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex(sig),
          types.buffFromHex(tgHash)
        ],
        deployer.address
      )
    ]);
    
    block.receipts[0].result.expectOk().expectBool(true);
    
    // Verify new protocol config
    let config = chain.callReadOnlyFn(
      "user-wallet",
      "get-protocol-config",
      [types.principal(newProtocol.address)],
      deployer.address
    );
    
    assertEquals(config.result.expectSome()['name'], types.ascii("new-protocol"));
    assertEquals(config.result.expectSome()['max-allocation'], types.uint(3000));
    assertEquals(config.result.expectSome()['current-allocation'], types.uint(0));
    assertEquals(config.result.expectSome()['enabled'], true);
  },
});

Clarinet.test({
  name: "verify-identity: should correctly validate telegram hash",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Test valid proof
    let result = chain.callReadOnlyFn(
      "user-wallet",
      "verify-identity",
      [types.buffFromHex(tgHash)],
      deployer.address
    );
    assertEquals(result.result, true);
    
    // Test invalid proof
    result = chain.callReadOnlyFn(
      "user-wallet",
      "verify-identity",
      [types.buffFromHex("00".repeat(32))],
      deployer.address
    );
    assertEquals(result.result, false);
  },
});

Clarinet.test({
  name: "daily limit reset: should reset after BLOCKS-PER-DAY",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Spend some amount
    let sig = generateValidSignature(0, 800, chain.blockHeight + 10, botPrivateKey);
    chain.mineBlock([
      Tx.contractCall(
        "user-wallet",
        "execute-authorized-operation",
        [
          types.uint(0),
          types.principal(protocol.address),
          types.ascii("transfer"),
          types.uint(800),
          types.uint(chain.blockHeight + 10),
          types.buffFromHex(sig)
        ],
        deployer.address
      )
    ]);
    
    // Advance blocks to trigger reset
    chain.mineEmptyBlock(145); // BLOCKS-PER-DAY + 1
    
    // Check that spent-today reset to 0
    let info = chain.callReadOnlyFn(
      "user-wallet",
      "get-wallet-info",
      [],
      deployer.address
    );
    assertEquals(info.result.expectOk()['spent-today'], types.uint(0));
  },
});

Clarinet.test({
  name: "operation history: should wrap around after MAX_HISTORY",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const protocol = accounts.get("wallet_1")!;
    
    await initializeContract(chain, deployer, protocol);
    
    // Perform more than MAX_HISTORY operations
    for (let i = 0; i < 105; i++) {
      let sig = generateValidSignature(i, 100, chain.blockHeight + 10, botPrivateKey);
      chain.mineBlock([
        Tx.contractCall(
          "user-wallet",
          "execute-authorized-operation",
          [
            types.uint(i),
            types.principal(protocol.address),
            types.ascii("transfer"),
            types.uint(100),
            types.uint(chain.blockHeight + 10),
            types.buffFromHex(sig)
          ],
          deployer.address
        )
      ]);
    }
    
    // Check that count is 105
    let count = chain.callReadOnlyFn(
      "user-wallet",
      "get-operation-count",
      [],
      deployer.address
    );
    assertEquals(count.result, types.uint(105));
    
    // Check that index 0 is now overwritten with operation 100
    let operation = chain.callReadOnlyFn(
      "user-wallet",
      "get-operation",
      [types.uint(100)],
      deployer.address
    );
    assertEquals(operation.result.expectSome()['nonce'], types.uint(100));
  },
});

// Helper functions for signature generation
function generateValidSignature(nonce: number, amount: number, expiry: number, privateKey: string): string {
  // In real tests, you'd implement actual secp256k1 signing
  // This is a placeholder - you'll need to implement actual signature generation
  return "00".repeat(65);
}

function generateUnpauseSignature(nonce: number, expiry: number, privateKey: string): string {
  return "00".repeat(65);
}

function generateLimitsSignature(nonce: number, newMax: number, newDaily: number, expiry: number, privateKey: string): string {
  return "00".repeat(65);
}

function generateAddProtocolSignature(nonce: number, maxAlloc: number, expiry: number, privateKey: string): string {
  return "00".repeat(65);
}

// Constants for testing
const tgHash = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const botPrivateKey = "placeholder-private-key";

// Helper function to initialize contract
async function initializeContract(chain: Chain, deployer: Account, protocol: Account) {
  const block = chain.mineBlock([
    Tx.contractCall(
      "user-wallet",
      "initialize",
      [
        types.buffFromHex(tgHash),
        types.buffFromHex("03" + "00".repeat(32)),
          types.uint(1000),
          types.uint(5000)
        ],
      deployer.address
    )
  ]);
  
  block.receipts[0].result.expectOk().expectBool(true);
}