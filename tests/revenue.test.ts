import { describe, it, expect, beforeEach } from 'vitest';
import { 
  RevenueManager, 
  FEES, 
  SUBSCRIPTION_PLANS,
  ServiceType,
  revenueManager 
} from '../src/agent/revenue.ts';

describe('RevenueManager', () => {
  let manager: RevenueManager;

  beforeEach(() => {
    manager = new RevenueManager();
  });

  describe('calculateFee', () => {
    it('should calculate percentage fee for yield optimization', () => {
      const fee = manager.calculateFee('yield-optimization', 1000000n);
      expect(fee).toBe(5000n);
    });

    it('should calculate fixed fee for strategy advice', () => {
      const fee = manager.calculateFee('strategy-advice');
      expect(fee).toBe(1000n);
    });

    it('should return 0 for unknown service', () => {
      const fee = manager.calculateFee('unknown' as ServiceType);
      expect(fee).toBe(0n);
    });

    it('should handle emergency withdrawal fee', () => {
      const fee = manager.calculateFee('emergency-withdrawal');
      expect(fee).toBe(5000n);
    });
  });

  describe('Subscriptions', () => {
    it('should create a subscription', async () => {
      const subscription = await manager.createSubscription('user123', 'pro');
      
      expect(subscription).toBeDefined();
      expect(subscription?.plan.id).toBe('pro');
      expect(subscription?.status).toBe('active');
    });

    it('should return null for invalid plan', async () => {
      const subscription = await manager.createSubscription('user123', 'invalid');
      expect(subscription).toBeNull();
    });

    it('should cancel subscription', async () => {
      const subscription = await manager.createSubscription('user123', 'pro');
      const cancelled = await manager.cancelSubscription(subscription!.id);
      
      expect(cancelled).toBe(true);
      expect(subscription?.status).toBe('cancelled');
    });

    it('should pause and resume subscription', async () => {
      const subscription = await manager.createSubscription('user123', 'pro');
      
      await manager.pauseSubscription(subscription!.id);
      expect(subscription?.status).toBe('paused');
      
      await manager.resumeSubscription(subscription!.id);
      expect(subscription?.status).toBe('active');
    });

    it('should get user subscriptions', async () => {
      await manager.createSubscription('user123', 'pro');
      await manager.createSubscription('user123', 'basic');
      
      const subs = manager.getUserSubscriptions('user123');
      expect(subs.length).toBe(2);
    });

    it('should check if user has active subscription', async () => {
      const hasSub = manager.hasActiveSubscription('user456');
      expect(hasSub).toBe(false);
      
      await manager.createSubscription('user456', 'pro');
      const hasSubAfter = manager.hasActiveSubscription('user456');
      expect(hasSubAfter).toBe(true);
    });

    it('should get user plan', async () => {
      await manager.createSubscription('user789', 'enterprise');
      const plan = manager.getUserPlan('user789');
      
      expect(plan?.id).toBe('enterprise');
    });
  });

  describe('Revenue History', () => {
    it('should record revenue', () => {
      manager.recordRevenue('user1', 1000n);
      manager.recordRevenue('user1', 2000n);
      
      const total = manager.getTotalRevenue('user1');
      expect(total).toBe(3000n);
    });

    it('should return 0 for user without revenue', () => {
      const total = manager.getTotalRevenue('nonexistent');
      expect(total).toBe(0n);
    });
  });

  describe('formatFeeDescription', () => {
    it('should format percentage fee', () => {
      const desc = manager.formatFeeDescription('yield-optimization');
      expect(desc).toContain('0.5%');
    });

    it('should format fixed fee', () => {
      const desc = manager.formatFeeDescription('strategy-advice');
      expect(desc).toContain('1000');
    });
  });

  describe('Plans', () => {
    it('should have all subscription plans', () => {
      expect(SUBSCRIPTION_PLANS.length).toBe(3);
      expect(SUBSCRIPTION_PLANS.find(p => p.id === 'basic')).toBeDefined();
      expect(SUBSCRIPTION_PLANS.find(p => p.id === 'pro')).toBeDefined();
      expect(SUBSCRIPTION_PLANS.find(p => p.id === 'enterprise')).toBeDefined();
    });

    it('should have correct monthly rates', () => {
      const basic = SUBSCRIPTION_PLANS.find(p => p.id === 'basic');
      const pro = SUBSCRIPTION_PLANS.find(p => p.id === 'pro');
      
      expect(basic?.monthlyRate).toBe(0n);
      expect(pro?.monthlyRate).toBe(5000n);
    });
  });
});

describe('FEES constant', () => {
  it('should have all service fees defined', () => {
    expect(FEES['yield-optimization']).toBeDefined();
    expect(FEES['strategy-advice']).toBeDefined();
    expect(FEES['emergency-withdrawal']).toBeDefined();
    expect(FEES['portfolio-report']).toBeDefined();
    expect(FEES['risk-assessment']).toBeDefined();
  });
});
