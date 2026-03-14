import { Clarinet, Tx, Chain, Account, types, assertEquals } from './deps.ts';

const CONTRACT_NAME = 'molbot-payment';

Clarinet.test({
  name: '[Payment] Should process STX payment successfully',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot = accounts.get('wallet_1')!;
    const user = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'molbot-registry',
        'register-molbot',
        [
          types.ascii('Yield Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        molbot.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [
          molbot.address,
          types.uint(1000),
          types.ascii('STX'),
          types.buffFromHex('0x' + '11'.repeat(32))
        ],
        user.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: '[Payment] Should fail if molbot not registered',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot = accounts.get('wallet_1')!;
    const user = accounts.get('wallet_2')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [
          molbot.address,
          types.uint(1000),
          types.ascii('STX'),
          types.buffFromHex('0x' + '11'.repeat(32))
        ],
        user.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(404);
  },
});

Clarinet.test({
  name: '[Payment] Should fail if molbot is inactive',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot = accounts.get('wallet_1')!;
    const user = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'molbot-registry',
        'register-molbot',
        [
          types.ascii('Yield Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        molbot.address
      ),
      Tx.contractCall(
        'molbot-registry',
        'set-active',
        [types.bool(false)],
        molbot.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [
          molbot.address,
          types.uint(1000),
          types.ascii('STX'),
          types.buffFromHex('0x' + '11'.repeat(32))
        ],
        user.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(402);
  },
});

Clarinet.test({
  name: '[Payment] Should record payment correctly',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot = accounts.get('wallet_1')!;
    const user = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'molbot-registry',
        'register-molbot',
        [
          types.ascii('Yield Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        molbot.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [
          molbot.address,
          types.uint(1000),
          types.ascii('STX'),
          types.buffFromHex('0x' + '11'.repeat(32))
        ],
        user.address
      )
    ]);
    
    const payment = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-payment',
      [user.address, types.uint(0)]
    );
    
    payment.result.expectOk().expectSome();
  },
});

Clarinet.test({
  name: '[Payment] Should get payment count for user',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot = accounts.get('wallet_1')!;
    const user = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'molbot-registry',
        'register-molbot',
        [
          types.ascii('Yield Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        molbot.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [molbot.address, types.uint(1000), types.ascii('STX'), types.buffFromHex('0x' + '11'.repeat(32))],
        user.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [molbot.address, types.uint(2000), types.ascii('STX'), types.buffFromHex('0x' + '22'.repeat(32))],
        user.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [molbot.address, types.uint(3000), types.ascii('STX'), types.buffFromHex('0x' + '33'.repeat(32))],
        user.address
      ),
    ]);
    
    const count = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-user-payment-count',
      [user.address]
    );
    
    assertEquals(count.result.expectOk(), types.uint(3));
  },
});

Clarinet.test({
  name: '[Payment] Should get molbot balance',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot = accounts.get('wallet_1')!;
    const user = accounts.get('wallet_2')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'molbot-registry',
        'register-molbot',
        [
          types.ascii('Yield Bot'),
          types.ascii('Description'),
          types.ascii('yield-optimizer'),
          types.uint(1000),
          types.ascii('STX')
        ],
        molbot.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [
          molbot.address,
          types.uint(5000),
          types.ascii('STX'),
          types.buffFromHex('0x' + '11'.repeat(32))
        ],
        user.address
      )
    ]);
    
    const balance = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-molbot-balance',
      [molbot.address]
    );
    
    assertEquals(balance.result.expectOk(), types.uint(5000));
  },
});

Clarinet.test({
  name: '[Read-Only] get-payment should return none for unknown',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const unknown = 'ST' + '0'.repeat(38);
    
    const payment = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-payment',
      [unknown, types.uint(0)]
    );
    
    const result = payment.result.expectOk();
    assertEquals(result.type, 'none');
  },
});

Clarinet.test({
  name: '[Read-Only] get-total-payments should count correctly',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const molbot1 = accounts.get('wallet_1')!;
    const molbot2 = accounts.get('wallet_2')!;
    const user = accounts.get('wallet_3')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'molbot-registry',
        'register-molbot',
        [types.ascii('Bot1'), types.ascii('Desc'), types.ascii('cap'), types.uint(1000), types.ascii('STX')],
        molbot1.address
      ),
      Tx.contractCall(
        'molbot-registry',
        'register-molbot',
        [types.ascii('Bot2'), types.ascii('Desc'), types.ascii('cap'), types.uint(1000), types.ascii('STX')],
        molbot2.address
      ),
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [molbot1.address, types.uint(1000), types.ascii('STX'), types.buffFromHex('0x' + '11'.repeat(32))],
        user.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        'pay-molbot',
        [molbot2.address, types.uint(2000), types.ascii('STX'), types.buffFromHex('0x' + '22'.repeat(32))],
        user.address
      ),
    ]);
    
    const total = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-total-payments',
      []
    );
    
    assertEquals(total.result.expectOk(), types.uint(2));
  },
});
