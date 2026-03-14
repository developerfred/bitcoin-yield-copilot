import { Clarinet, Tx, Chain, Account, types, assertEquals } from './deps.ts';

const CONTRACT_NAME = 'erc8004-identity';

Clarinet.test({
  name: '[Registration] Should register identity successfully',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('bitcoin-yield.com'),
          types.list([types.ascii('yield-optimizer'), types.ascii('portfolio-manager')])
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const identity = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-identity',
      [],
      wallet1.address
    );
    
    const id = identity.result.expectOk().expectSome();
    assertEquals(id['domain'], 'bitcoin-yield.com');
    assertEquals(id['nonce'], types.uint(0));
  },
});

Clarinet.test({
  name: '[Registration] Should fail if already registered',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain1.com'),
          types.list([types.ascii('cap1')])
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain2.com'),
          types.list([types.ascii('cap2')])
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(409);
  },
});

Clarinet.test({
  name: '[Registration] Should allow multiple identities from different wallets',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain1.com'),
          types.list([types.ascii('yield-optimizer')])
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain2.com'),
          types.list([types.ascii('data-analyst')])
        ],
        wallet2.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const id1 = chain.callReadOnlyFn(CONTRACT_NAME, 'get-identity', [], wallet1.address);
    const id2 = chain.callReadOnlyFn(CONTRACT_NAME, 'get-identity', [], wallet2.address);
    
    id1.result.expectOk().expectSome();
    id2.result.expectOk().expectSome();
  },
});

Clarinet.test({
  name: '[Update] Should update identity successfully',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('old-domain.com'),
          types.list([types.ascii('cap1')])
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'update-identity',
        [
          types.ascii('new-domain.com'),
          types.list([types.ascii('new-cap1'), types.ascii('new-cap2')])
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const identity = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-identity',
      [],
      wallet1.address
    );
    
    const id = identity.result.expectOk().expectSome();
    assertEquals(id['domain'], 'new-domain.com');
  },
});

Clarinet.test({
  name: '[Update] Should fail if not owner',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'update-identity',
        [
          types.ascii('hacked.com'),
          types.list([types.ascii('hack')])
        ],
        wallet2.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(401);
  },
});

Clarinet.test({
  name: '[Update] Should fail if identity not registered',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'update-identity',
        [
          types.ascii('domain.com'),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(404);
  },
});

Clarinet.test({
  name: '[Status] Should set active status to false',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-active',
        [types.bool(false)],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const identity = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-identity',
      [],
      wallet1.address
    );
    
    const id = identity.result.expectOk().expectSome();
    assertEquals(id['active'], false);
  },
});

Clarinet.test({
  name: '[Status] Should set active status to true after being false',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-active',
        [types.bool(false)],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-active',
        [types.bool(true)],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const identity = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-identity',
      [],
      wallet1.address
    );
    
    const id = identity.result.expectOk().expectSome();
    assertEquals(id['active'], true);
  },
});

Clarinet.test({
  name: '[Status] Should fail set-active if not registered',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-active',
        [types.bool(false)],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(404);
  },
});

Clarinet.test({
  name: '[Sign] Should sign action successfully',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    const payloadHash = '0x' + '11'.repeat(32);
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'sign-action',
        [
          types.ascii('deposit'),
          types.buffFromHex(payloadHash)
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const identity = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-identity',
      [],
      wallet1.address
    );
    
    const id = identity.result.expectOk().expectSome();
    assertEquals(id['nonce'], types.uint(1));
  },
});

Clarinet.test({
  name: '[Sign] Should fail if not registered',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'sign-action',
        [
          types.ascii('deposit'),
          types.buffFromHex('0x' + '11'.repeat(32))
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(404);
  },
});

Clarinet.test({
  name: '[Sign] Should increment nonce on multiple signs',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'sign-action',
        [types.ascii('deposit'), types.buffFromHex('0x' + '11'.repeat(32))],
        wallet1.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        'sign-action',
        [types.ascii('withdraw'), types.buffFromHex('0x' + '22'.repeat(32))],
        wallet1.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        'sign-action',
        [types.ascii('swap'), types.buffFromHex('0x' + '33'.repeat(32))],
        wallet1.address
      ),
    ]);
    
    const identity = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-identity',
      [],
      wallet1.address
    );
    
    const id = identity.result.expectOk().expectSome();
    assertEquals(id['nonce'], types.uint(3));
  },
});

Clarinet.test({
  name: '[Capabilities] Should return capabilities for registered identity',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([
            types.ascii('yield-optimizer'),
            types.ascii('portfolio-manager'),
            types.ascii('risk-assessor')
          ])
        ],
        wallet1.address
      )
    ]);
    
    const caps = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-capabilities',
      [],
      wallet1.address
    );
    
    const capabilitiesList = caps.result.expectOk().expectSome();
    assertEquals(capabilitiesList.length, 3);
  },
});

Clarinet.test({
  name: '[Capabilities] Should return none for unregistered',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const caps = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-capabilities',
      [],
      wallet1.address
    );
    
    const result = caps.result.expectOk();
    assertEquals(result.type, 'none');
  },
});

Clarinet.test({
  name: '[Read-Only] get-identity should return none for unknown',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const unknown = 'ST' + '0'.repeat(38);
    
    const identity = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-identity',
      [],
      unknown
    );
    
    const result = identity.result.expectOk();
    assertEquals(result.type, 'none');
  },
});

Clarinet.test({
  name: '[Read-Only] is-active should return correct status',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    const isActive1 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'is-active',
      [],
      wallet1.address
    );
    assertEquals(isActive1.result.expectOk(), true);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-active',
        [types.bool(false)],
        wallet1.address
      )
    ]);
    
    const isActive2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'is-active',
      [],
      wallet1.address
    );
    assertEquals(isActive2.result.expectOk(), false);
  },
});

Clarinet.test({
  name: '[Read-Only] is-registered should work correctly',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    const check1 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'is-registered',
      [],
      wallet1.address
    );
    assertEquals(check1.result.expectOk(), true);
    
    const check2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'is-registered',
      [],
      wallet2.address
    );
    assertEquals(check2.result.expectOk(), false);
  },
});

Clarinet.test({
  name: '[Read-Only] get-total-identities should count correctly',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    const wallet3 = accounts.get('wallet_3')!;
    
    chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'register-identity',
        [types.ascii('d1.com'), types.list([types.ascii('c1')])],
        wallet1.address),
      Tx.contractCall(CONTRACT_NAME, 'register-identity',
        [types.ascii('d2.com'), types.list([types.ascii('c2')])],
        wallet2.address),
      Tx.contractCall(CONTRACT_NAME, 'register-identity',
        [types.ascii('d3.com'), types.list([types.ascii('c3')])],
        wallet3.address),
    ]);
    
    const total = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-total-identities',
      []
    );
    
    assertEquals(total.result.expectOk(), types.uint(3));
  },
});

Clarinet.test({
  name: '[Edge] Should handle empty capabilities list',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii('domain.com'),
          types.list([])
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: '[Edge] Should handle long domain name (64 chars)',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const longDomain = 'a'.repeat(64);
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-identity',
        [
          types.ascii(longDomain),
          types.list([types.ascii('cap')])
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const identity = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-identity',
      [],
      wallet1.address
    );
    
    const id = identity.result.expectOk().expectSome();
    assertEquals(id['domain'], longDomain);
  },
});
