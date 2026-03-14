import { Clarinet, Tx, Chain, Account, types, assertEquals } from './deps.ts';

const CONTRACT_NAME = 'usdcx-adapter';

Clarinet.test({
  name: '[Deposit] Should deposit USDCx successfully',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'mock-sip-010',
        'mint',
        [types.uint(1000000), wallet1.address],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [
          types.uint(1000000),
          types.ascii('deposit')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const balance = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-balance',
      []
    );
    
    assertEquals(balance.result.expectOk(), types.uint(1000000));
  },
});

Clarinet.test({
  name: '[Withdraw] Should withdraw USDCx successfully',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'mock-sip-010',
        'mint',
        [types.uint(1000000), wallet1.address],
        wallet1.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [types.uint(1000000), types.ascii('deposit')],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [
          types.uint(500000),
          types.ascii('withdraw')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const balance = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-balance',
      []
    );
    
    assertEquals(balance.result.expectOk(), types.uint(500000));
  },
});

Clarinet.test({
  name: '[Withdraw] Should fail if insufficient balance',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [
          types.uint(1000000),
          types.ascii('withdraw')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(401);
  },
});

Clarinet.test({
  name: '[Execute] Should fail with invalid action',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [
          types.uint(1000),
          types.ascii('invalid')
        ],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectErr().expectUint(400);
  },
});

Clarinet.test({
  name: '[Emergency] Should withdraw all funds',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'mock-sip-010',
        'mint',
        [types.uint(1000000), wallet1.address],
        wallet1.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [types.uint(1000000), types.ascii('deposit')],
        wallet1.address
      )
    ]);
    
    const block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'emergency-withdraw',
        [],
        wallet1.address
      )
    ]);
    
    block.receipts[0].result.expectOk();
    
    const balance = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-balance',
      []
    );
    
    assertEquals(balance.result.expectOk(), types.uint(0));
  },
});

Clarinet.test({
  name: '[Read-Only] get-balance should return 0 initially',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const balance = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-balance',
      []
    );
    
    assertEquals(balance.result.expectOk(), types.uint(0));
  },
});

Clarinet.test({
  name: '[Read-Only] get-pending-rewards should return 0 initially',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const rewards = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-pending-rewards',
      []
    );
    
    assertEquals(rewards.result.expectOk(), types.uint(0));
  },
});

Clarinet.test({
  name: '[Integration] Full deposit-withdraw flow',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    chain.mineBlock([
      Tx.contractCall(
        'mock-sip-010',
        'mint',
        [types.uint(1000000), wallet1.address],
        wallet1.address
      )
    ]);
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [types.uint(1000000), types.ascii('deposit')],
        wallet1.address
      )
    ]);
    
    const balance1 = chain.callReadOnlyFn(CONTRACT_NAME, 'get-balance', []);
    assertEquals(balance1.result.expectOk(), types.uint(1000000));
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [types.uint(300000), types.ascii('withdraw')],
        wallet1.address
      )
    ]);
    
    const balance2 = chain.callReadOnlyFn(CONTRACT_NAME, 'get-balance', []);
    assertEquals(balance2.result.expectOk(), types.uint(700000));
    
    chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'execute',
        [types.uint(700000), types.ascii('withdraw')],
        wallet1.address
      )
    ]);
    
    const balance3 = chain.callReadOnlyFn(CONTRACT_NAME, 'get-balance', []);
    assertEquals(balance3.result.expectOk(), types.uint(0));
  },
});
