import { describe, it, expect, beforeEach } from 'vitest';
import { USDCxProtocol, USDCxPool, usdcxProtocol } from '../src/protocols/usdcx.ts';

describe('USDCxProtocol', () => {
  let protocol: USDCxProtocol;

  beforeEach(() => {
    protocol = new USDCxProtocol();
  });

  describe('getPools', () => {
    it('should return all available pools', async () => {
      const pools = await protocol.getPools();
      expect(pools).toBeDefined();
      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBeGreaterThan(0);
    });

    it('should include ALEX pool', async () => {
      const pools = await protocol.getPools();
      const alexPool = pools.find(p => p.protocol === 'alex');
      expect(alexPool).toBeDefined();
      expect(alexPool?.name).toContain('ALEX');
    });

    it('should include Bitflow pool', async () => {
      const pools = await protocol.getPools();
      const bitflowPool = pools.find(p => p.protocol === 'bitflow');
      expect(bitflowPool).toBeDefined();
    });

    it('should include Hermetica pool', async () => {
      const pools = await protocol.getPools();
      const hermeticaPool = pools.find(p => p.protocol === 'hermetica');
      expect(hermeticaPool).toBeDefined();
    });
  });

  describe('getPool', () => {
    it('should return pool by protocol name', async () => {
      const pool = await protocol.getPool('alex');
      expect(pool).toBeDefined();
      expect(pool?.protocol).toBe('alex');
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
      const amount = 1000000n;
      const apy = 5.5;
      const days = 30;
      
      const yield_ = protocol.calculateEstimatedYield(amount, apy, days);
      expect(yield_).toBeGreaterThan(0n);
    });

    it('should return higher yield for longer periods', () => {
      const amount = 1000000n;
      const apy = 5;
      
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
});

describe('USDCxPool Type', () => {
  it('should have required properties', () => {
    const pool: USDCxPool = {
      protocol: 'alex',
      name: 'ALEX USDCx/STX',
      apy: 5.5,
      tvl: 1000000n,
      token0: 'USDCx',
      token1: 'STX',
      poolAddress: 'SP1234567890.pool',
    };

    expect(pool.protocol).toBe('alex');
    expect(pool.apy).toBe(5.5);
    expect(pool.tvl).toBe(1000000n);
  });
});

describe('usdcxProtocol singleton', () => {
  it('should be an instance of USDCxProtocol', () => {
    expect(usdcxProtocol).toBeInstanceOf(USDCxProtocol);
  });

  it('should have same functionality as new instance', async () => {
    const pools1 = await usdcxProtocol.getPools();
    const pools2 = await new USDCxProtocol().getPools();
    
    expect(pools1.length).toBe(pools2.length);
  });
});
