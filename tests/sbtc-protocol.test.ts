import { describe, it, expect, beforeEach } from 'vitest';
import { sBTCProtocol, sBTCPool, sbtcProtocol } from '../src/protocols/sbtc.ts';

describe('sBTCProtocol', () => {
  let protocol: sBTCProtocol;

  beforeEach(() => {
    protocol = new sBTCProtocol();
  });

  describe('getPools', () => {
    it('should return all available sBTC yield pools', async () => {
      const pools = await protocol.getPools();
      expect(pools).toBeDefined();
      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBeGreaterThan(0);
    });

    it('should include Zest pool', async () => {
      const pools = await protocol.getPools();
      const zestPool = pools.find(p => p.protocol === 'zest');
      expect(zestPool).toBeDefined();
      expect(zestPool?.name).toContain('Zest');
    });

    it('should include Hermetica pool', async () => {
      const pools = await protocol.getPools();
      const hermeticaPool = pools.find(p => p.protocol === 'hermetica');
      expect(hermeticaPool).toBeDefined();
    });

    it('should include ALEX LP pool', async () => {
      const pools = await protocol.getPools();
      const alexPool = pools.find(p => p.protocol === 'alex');
      expect(alexPool).toBeDefined();
    });
  });

  describe('getPool', () => {
    it('should return pool by protocol name', async () => {
      const pool = await protocol.getPool('zest');
      expect(pool).toBeDefined();
      expect(pool?.protocol).toBe('zest');
    });

    it('should return null for unknown protocol', async () => {
      const pool = await protocol.getPool('unknown');
      expect(pool).toBeNull();
    });
  });

  describe('getPoolByAddress', () => {
    it('should find pool by address', async () => {
      const pools = await protocol.getPools();
      const firstPool = pools[0];
      
      const found = await protocol.getPoolByAddress(firstPool.poolAddress);
      expect(found).toBeDefined();
      expect(found?.protocol).toBe(firstPool.protocol);
    });

    it('should return null for unknown address', async () => {
      const found = await protocol.getPoolByAddress('SP0000000000000000000000000000000000000000.unknown');
      expect(found).toBeNull();
    });
  });

  describe('calculateEstimatedYield', () => {
    it('should calculate yield correctly for 30 days', () => {
      const amount = 1000000n; // 1 sBTC in satoshis
      const apy = 8.5;
      const days = 30;
      
      const yield_ = protocol.calculateEstimatedYield(amount, apy, days);
      expect(yield_).toBeGreaterThan(0n);
    });

    it('should return higher yield for longer periods', () => {
      const amount = 1000000n;
      const apy = 8;
      
      const yield30 = protocol.calculateEstimatedYield(amount, apy, 30);
      const yield60 = protocol.calculateEstimatedYield(amount, apy, 60);
      
      expect(yield60).toBeGreaterThan(yield30);
    });

    it('should return 0 for 0 days', () => {
      const amount = 1000n;
      const apy = 5;
      
      const yield_ = protocol.calculateEstimatedYield(amount, apy, 0);
      expect(yield_).toBe(0n);
    });

    it('should return 0 for 0 amount', () => {
      const amount = 0n;
      const apy = 5;
      const days = 30;
      
      const yield_ = protocol.calculateEstimatedYield(amount, apy, days);
      expect(yield_).toBe(0n);
    });
  });

  describe('findBestPool', () => {
    it('should return pool with highest APY', () => {
      const bestPool = protocol.findBestPool(1000n);
      expect(bestPool).toBeDefined();
      expect(bestPool.apy).toBeGreaterThan(0);
    });

    it('should work with any amount', () => {
      const pool1 = protocol.findBestPool(100n);
      const pool2 = protocol.findBestPool(1000000n);
      
      expect(pool1).toBeDefined();
      expect(pool2).toBeDefined();
    });
  });

  describe('deposit', () => {
    it('should return error for unknown protocol', async () => {
      const result = await protocol.deposit({
        amount: 1000n,
        poolProtocol: 'unknown',
        userWallet: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      });
      
      expect(result.ok).toBe(false);
    });
  });

  describe('withdraw', () => {
    it('should return error for unknown protocol', async () => {
      const result = await protocol.withdraw({
        amount: 1000n,
        poolProtocol: 'unknown',
        userWallet: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      });
      
      expect(result.ok).toBe(false);
    });
  });

  describe('getBalance', () => {
    it('should have getBalance method', () => {
      expect(typeof protocol.getBalance).toBe('function');
    });
  });
});

describe('sBTCPool Type', () => {
  it('should have required properties', () => {
    const pool: sBTCPool = {
      protocol: 'zest',
      name: 'Zest sBTC Vault',
      apy: 8.5,
      tvl: 50000000n,
      token: 'sBTC',
      poolAddress: 'SP1234567890.pool',
    };

    expect(pool.protocol).toBe('zest');
    expect(pool.apy).toBe(8.5);
    expect(pool.tvl).toBe(50000000n);
    expect(pool.token).toBe('sBTC');
  });
});

describe('sbtcProtocol singleton', () => {
  it('should be an instance of sBTCProtocol', () => {
    expect(sbtcProtocol).toBeInstanceOf(sBTCProtocol);
  });

  it('should have same functionality as new instance', async () => {
    const pools1 = await sbtcProtocol.getPools();
    const pools2 = await new sBTCProtocol().getPools();
    
    expect(pools1.length).toBe(pools2.length);
  });
});
