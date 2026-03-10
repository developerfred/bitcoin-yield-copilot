import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YieldStrategy, YieldOpportunity, UserPreferences } from '../strategy';

vi.mock('../../x402/client', () => ({
  x402Client: {
    getPaidAPYData: vi.fn(),
    getPaidPriceData: vi.fn(),
  },
}));

describe('YieldStrategy', () => {
  let strategy: YieldStrategy;
  let mockPreferences: UserPreferences;

  beforeEach(() => {
    mockPreferences = {
      riskProfile: 'moderate',
      allowedTokens: ['sBTC', 'STX'],
      maxDataCost: 0.1,
      minNetApy: 5.0,
    };

    strategy = new YieldStrategy(mockPreferences);
  });

  describe('findBestYieldOpportunities', () => {
    it('should return filtered and scored opportunities', async () => {
      vi.spyOn(strategy as any, 'getFreeYieldOpportunities').mockResolvedValue([
        {
          protocol: 'zest',
          apy: 8.2,
          tvl: 50000000,
          risk: 'low',
          token: 'sBTC',
          estimatedFee: 0.1,
          dataCost: 0,
          netApy: 8.1,
          timestamp: Date.now(),
        },
        {
          protocol: 'alex',
          apy: 11.4,
          tvl: 75000000,
          risk: 'medium',
          token: 'sBTC',
          estimatedFee: 0.2,
          dataCost: 0,
          netApy: 11.2,
          timestamp: Date.now(),
        },
      ]);

      const opportunities = await strategy.findBestYieldOpportunities(1000);

      expect(opportunities).toHaveLength(2);
      expect(opportunities[0].netApy).toBeGreaterThanOrEqual(opportunities[1].netApy);
    });

    it('should use paid data when enabled', async () => {
      process.env.ENABLE_PAID_DATA = 'true';
      
      const mockPaidData = [
        {
          protocol: 'zest',
          apy: 8.5,
          tvl: 55000000,
          risk: 'low',
          token: 'sBTC',
          estimatedFee: 0.1,
          dataCost: 0.02,
          netApy: 8.38,
          timestamp: Date.now(),
        },
      ];

      vi.spyOn(strategy as any, 'getPaidYieldOpportunities').mockResolvedValue(mockPaidData);

      const strategyWithPaid = new YieldStrategy(mockPreferences);
      const opportunities = await strategyWithPaid.findBestYieldOpportunities(1000);

      expect(opportunities).toEqual(mockPaidData);
      expect((strategyWithPaid as any).getPaidYieldOpportunities).toHaveBeenCalled();
    });
  });

  describe('filterOpportunities', () => {
    it('should filter by allowed tokens', () => {
      const opportunities: YieldOpportunity[] = [
        {
          protocol: 'zest',
          apy: 8.2,
          tvl: 50000000,
          risk: 'low',
          token: 'sBTC',
          estimatedFee: 0.1,
          dataCost: 0,
          netApy: 8.1,
          timestamp: Date.now(),
        },
        {
          protocol: 'alex',
          apy: 11.4,
          tvl: 75000000,
          risk: 'medium',
          token: 'USDA',
          estimatedFee: 0.2,
          dataCost: 0,
          netApy: 11.2,
          timestamp: Date.now(),
        },
      ];

      const filtered = (strategy as any).filterOpportunities(opportunities);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].token).toBe('sBTC');
    });

    it('should filter by min net APY', () => {
      const preferences: UserPreferences = {
        ...mockPreferences,
        minNetApy: 10.0,
      };

      const strategyWithHighMin = new YieldStrategy(preferences);
      
      const opportunities: YieldOpportunity[] = [
        {
          protocol: 'zest',
          apy: 8.2,
          tvl: 50000000,
          risk: 'low',
          token: 'sBTC',
          estimatedFee: 0.1,
          dataCost: 0,
          netApy: 8.1,
          timestamp: Date.now(),
        },
        {
          protocol: 'alex',
          apy: 11.4,
          tvl: 75000000,
          risk: 'medium',
          token: 'sBTC',
          estimatedFee: 0.2,
          dataCost: 0,
          netApy: 11.2,
          timestamp: Date.now(),
        },
      ];

      const filtered = (strategyWithHighMin as any).filterOpportunities(opportunities);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].protocol).toBe('alex');
    });

    it('should filter by risk profile', () => {
      const conservativePrefs: UserPreferences = {
        ...mockPreferences,
        riskProfile: 'conservative',
      };

      const conservativeStrategy = new YieldStrategy(conservativePrefs);
      
      const opportunities: YieldOpportunity[] = [
        {
          protocol: 'zest',
          apy: 8.2,
          tvl: 50000000,
          risk: 'low',
          token: 'sBTC',
          estimatedFee: 0.1,
          dataCost: 0,
          netApy: 8.1,
          timestamp: Date.now(),
        },
        {
          protocol: 'alex',
          apy: 11.4,
          tvl: 75000000,
          risk: 'high',
          token: 'sBTC',
          estimatedFee: 0.2,
          dataCost: 0,
          netApy: 11.2,
          timestamp: Date.now(),
        },
      ];

      const filtered = (conservativeStrategy as any).filterOpportunities(opportunities);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].risk).toBe('low');
    });
  });

  describe('scoreOpportunities', () => {
    it('should sort by score descending', () => {
      const opportunities: YieldOpportunity[] = [
        {
          protocol: 'zest',
          apy: 8.2,
          tvl: 50000000,
          risk: 'low',
          token: 'sBTC',
          estimatedFee: 0.1,
          dataCost: 0,
          netApy: 8.1,
          timestamp: Date.now(),
        },
        {
          protocol: 'alex',
          apy: 11.4,
          tvl: 75000000,
          risk: 'medium',
          token: 'sBTC',
          estimatedFee: 0.2,
          dataCost: 0,
          netApy: 11.2,
          timestamp: Date.now(),
        },
      ];

      const scored = (strategy as any).scoreOpportunities(opportunities, 1000);

      expect(scored[0].netApy).toBeGreaterThan(scored[1].netApy);
    });
  });

  describe('assessRisk', () => {
    it('should assess risk based on protocol and TVL', () => {
      const data = { apy: 8.2, tvl: 50000000, timestamp: Date.now(), source: 'zest' };
      
      expect((strategy as any).assessRisk('zest', data)).toBe('low');
      expect((strategy as any).assessRisk('alex', data)).toBe('medium');
      expect((strategy as any).assessRisk('bitflow', data)).toBe('high');
    });

    it('should adjust risk based on TVL', () => {
      const highTVL = { apy: 8.2, tvl: 200000000, timestamp: Date.now(), source: 'bitflow' };
      const lowTVL = { apy: 8.2, tvl: 10000000, timestamp: Date.now(), source: 'zest' };
      
      expect((strategy as any).assessRisk('bitflow', highTVL)).toBe('low');
      expect((strategy as any).assessRisk('zest', lowTVL)).toBe('medium');
    });
  });

  describe('createDecisionSummary', () => {
    it('should create a comprehensive summary', () => {
      const opportunities: YieldOpportunity[] = [
        {
          protocol: 'zest',
          apy: 8.2,
          tvl: 50000000,
          risk: 'low',
          token: 'sBTC',
          estimatedFee: 0.1,
          dataCost: 0.02,
          netApy: 8.08,
          timestamp: Date.now(),
        },
        {
          protocol: 'alex',
          apy: 11.4,
          tvl: 75000000,
          risk: 'medium',
          token: 'sBTC',
          estimatedFee: 0.2,
          dataCost: 0.03,
          netApy: 11.17,
          timestamp: Date.now(),
        },
      ];

      const summary = strategy.createDecisionSummary(opportunities, 0);

      expect(summary).toContain('Selected: ZEST');
      expect(summary).toContain('8.08% APY');
      expect(summary).toContain('Other considered options');
      expect(summary).toContain('alex: 11.17%');
    });

    it('should handle empty opportunities', () => {
      const summary = strategy.createDecisionSummary([], 0);

      expect(summary).toBe('No suitable yield opportunities found.');
    });
  });

  describe('data cost tracking', () => {
    it('should track total data cost', () => {
      expect(strategy.getTotalDataCost()).toBe(0);

      (strategy as any).totalDataCost = 0.05;
      expect(strategy.getTotalDataCost()).toBe(0.05);

      strategy.resetDataCost();
      expect(strategy.getTotalDataCost()).toBe(0);
    });

    it('should calculate data cost based on payment time', () => {
      const cost = (strategy as any).calculateDataCost(2000);
      expect(cost).toBe(0.002);
    });
  });
});