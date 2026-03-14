import { Clarinet, Tx, Chain, Account, types, assertEquals } from './deps.ts';

const CONTRACT_NAME = 'molbot-registry';

Clarinet.test({
  name: '[Registration] Should register a new molbot successfully',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Yield Optimizer Pro'),
          types.ascii('Advanced yield optimization strategies'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const molbot = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot',
      [],
      wallet1.address
    );
    
    const data = molbot.result.expectOk().expectSome();
    assertEquals(data['name'], 'Yield Optimizer Pro');
    assertEquals(data['capability'], 'yield-optimizer');
    assertEquals(data['price-per-call'], types.uint(1000));
    assertEquals(data['active'], true);
  },
});

Clarinet.test({
  name: '[Registration] Should fail if already registered',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot 1'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot 2'),
          types.ascii('Description 2'),
          types.ascii('data-analyst'),
          types.uint(2000),
          types.ascii('USDCx')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(409);
  },
});

Clarinet.test({
  name: '[Registration] Should allow multiple molbots from different wallets',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Yield Bot'),
          types.ascii('Yield description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Data Bot'),
          types.ascii('Data description'),
          types.ascii('data-analyst'),
          types.uint(1500),
          types.ascii('sBTC')
        ],
        wallet2.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const bot1 = chain.callReadOnlyFn(CONTRACT_NAME, 'get-molbot', [], wallet1.address);
    const bot2 = chain.callReadOnlyFn(CONTRACT_NAME, 'get-molbot', [], wallet2.address);
    
    bot1.result.expectOk().expectSome();
    bot2.result.expectOk().expectSome();
  },
});

Clarinet.test({
  name: '[Update] Should update molbot successfully',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Old Name'),
          types.ascii('Old description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'update-molbot',
        [
          types.ascii('New Name'),
          types.ascii('New description'),
          types.ascii('risk-assessor'),
          types.uint(2000),
          types.ascii('USDCx')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const molbot = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot',
      [],
      wallet1.address
    );
    
    const data = molbot.result.expectOk().expectSome();
    assertEquals(data['name'], 'New Name');
    assertEquals(data['capability'], 'risk-assessor');
    assertEquals(data['price-per-call'], types.uint(2000));
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
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'update-molbot',
        [
          types.ascii('Hacked'),
          types.ascii('Hacked desc'),
          types.ascii('hack'),
          types.uint(9999),
          types.ascii('STX')
        ],
        wallet2.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(401);
  },
});

Clarinet.test({
  name: '[Update] Should fail if not registered',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'update-molbot',
        [
          types.ascii('Name'),
          types.ascii('Description'),
          types.ascii('capability'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(404);
  },
});

Clarinet.test({
  name: '[Active Status] Should set active to false',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
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
    
    const molbot = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot',
      [],
      wallet1.address
    );
    
    const data = molbot.result.expectOk().expectSome();
    assertEquals(data['active'], false);
  },
});

Clarinet.test({
  name: '[Active Status] Should set active to true after being false',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
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
    
    const molbot = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot',
      [],
      wallet1.address
    );
    
    const data = molbot.result.expectOk().expectSome();
    assertEquals(data['active'], true);
  },
});

Clarinet.test({
  name: '[Active Status] Should fail set-active if not registered',
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
  name: '[Deactivate] Should deactivate molbot',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'deactivate',
        [],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const molbot = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot',
      [],
      wallet1.address
    );
    
    const data = molbot.result.expectOk().expectSome();
    assertEquals(data['active'], false);
  },
});

Clarinet.test({
  name: '[Reactivate] Should reactivate molbot',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'deactivate',
        [],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'reactivate',
        [],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const molbot = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot',
      [],
      wallet1.address
    );
    
    const data = molbot.result.expectOk().expectSome();
    assertEquals(data['active'], true);
  },
});

Clarinet.test({
  name: '[Read-Only] get-molbot should return none for unknown',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const unknown = 'ST' + '0'.repeat(38);
    
    const molbot = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot',
      [],
      unknown
    );
    
    const result = molbot.result.expectOk();
    assertEquals(result.type, 'none');
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
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
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
  name: '[Read-Only] is-active should return correct status',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
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
  name: '[Read-Only] get-total-molbots should count correctly',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    const wallet3 = accounts.get('wallet_3')!;
    
    chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'register-molbot',
        [types.ascii('Bot1'), types.ascii('Desc1'), types.ascii('cap1'), types.uint(1000), types.ascii('STX')],
        wallet1.address),
      Tx.contractCall(CONTRACT_NAME, 'register-molbot',
        [types.ascii('Bot2'), types.ascii('Desc2'), types.ascii('cap2'), types.uint(2000), types.ascii('STX')],
        wallet2.address),
      Tx.contractCall(CONTRACT_NAME, 'register-molbot',
        [types.ascii('Bot3'), types.ascii('Desc3'), types.ascii('cap3'), types.uint(3000), types.ascii('STX')],
        wallet3.address),
    ]);
    
    const total = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-total-molbots',
      []
    );
    
    assertEquals(total.result.expectOk(), types.uint(3));
  },
});

Clarinet.test({
  name: '[Read-Only] get-molbot-price should return correct price',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1500),
          types.ascii('USDCx')
        ],
        wallet1.address
      )
    ]);
    
    const price = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot-price',
      [],
      wallet1.address
    );
    
    assertEquals(price.result.expectOk(), types.uint(1500));
  },
});

Clarinet.test({
  name: '[Edge] Should handle long name (64 chars)',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const longName = 'a'.repeat(64);
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii(longName),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const molbot = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot',
      [],
      wallet1.address
    );
    
    const data = molbot.result.expectOk().expectSome();
    assertEquals(data['name'], longName);
  },
});

Clarinet.test({
  name: '[Edge] Should handle long description (256 chars)',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const longDesc = 'a'.repeat(256);
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('Bot'),
          types.ascii(longDesc),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: '[Edge] Should handle all supported payment tokens',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('STX Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        wallet1.address)
    ]);
    
    const wallet2 = accounts.get('wallet_2')!;
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('sBTC Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('sBTC')
        ],
        wallet2.address)
    ]);
    
    const wallet3 = accounts.get('wallet_3')!;
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'register-molbot',
        [
          types.ascii('USDCx Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('USDCx')
        ],
        wallet3.address)
    ]);
    
    block.receipts[0].result.expectOk();
  },
});
