import { config } from '../config.ts';
import { EnhancedX402Client } from '../x402/enhanced-client.ts';

export type ServiceType = 
  | 'yield-optimization'
  | 'strategy-advice'
  | 'emergency-withdrawal'
  | 'portfolio-report'
  | 'risk-assessment';

export interface ServiceFee {
  type: 'percentage' | 'fixed';
  amount: number;
  token: 'STX' | 'sBTC' | 'USDCx';
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'paused' | 'cancelled';
  startDate: number;
  nextBillingDate: number;
  monthlyRate: bigint;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyRate: bigint;
  features: string[];
}

export const FEES: Record<ServiceType, ServiceFee> = {
  'yield-optimization': { type: 'percentage', amount: 0.5, token: 'STX' },
  'strategy-advice': { type: 'fixed', amount: 1000, token: 'STX' },
  'emergency-withdrawal': { type: 'fixed', amount: 5000, token: 'STX' },
  'portfolio-report': { type: 'fixed', amount: 500, token: 'STX' },
  'risk-assessment': { type: 'fixed', amount: 2000, token: 'STX' },
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyRate: 0n,
    features: [
      'Basic yield monitoring',
      'Daily portfolio updates',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyRate: 5000n,
    features: [
      'Advanced yield optimization',
      'Real-time alerts',
      'Priority support',
      'Custom strategies',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyRate: 20000n,
    features: [
      'Everything in Pro',
      'Dedicated strategist',
      'API access',
      'Custom integrations',
    ],
  },
];

export class RevenueManager {
  private readonly x402: EnhancedX402Client;
  private readonly subscriptions: Map<string, Subscription> = new Map();
  private readonly revenueHistory: Map<string, bigint[]> = new Map();

  constructor() {
    this.x402 = new EnhancedX402Client();
  }

  calculateFee(serviceType: ServiceType, yieldAmount?: bigint): bigint {
    const fee = FEES[serviceType];
    
    if (!fee) {
      return 0n;
    }

    if (fee.type === 'percentage' && yieldAmount) {
      return (yieldAmount * BigInt(Math.floor(fee.amount * 100))) / 10000n;
    }

    return BigInt(fee.amount);
  }

  async chargeForService(
    userId: string,
    userAddress: string,
    serviceType: ServiceType,
    yieldAmount?: bigint
  ): Promise<{ success: boolean; amount: bigint; txId?: string }> {
    const fee = this.calculateFee(serviceType, yieldAmount);
    
    if (fee <= 0n) {
      return { success: true, amount: 0n };
    }

    try {
      const payment = await this.x402.createPaymentRequest(
        fee.toString(),
        `Service: ${serviceType}`,
        'STX',
        config.molbot?.registryAddress?.split('.')[0]
      );

      this.recordRevenue(userId, fee);
      
      return {
        success: true,
        amount: fee,
        txId: 'mock-tx-id',
      };
    } catch (error) {
      console.error('Payment failed:', error);
      return { success: false, amount: fee };
    }
  }

  async createSubscription(
    userId: string,
    planId: string
  ): Promise<Subscription | null> {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    
    if (!plan) {
      return null;
    }

    const subscription: Subscription = {
      id: this.generateId(),
      userId,
      plan,
      status: 'active',
      startDate: Date.now(),
      nextBillingDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      monthlyRate: plan.monthlyRate,
    };

    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      return false;
    }

    subscription.status = 'cancelled';
    this.subscriptions.set(subscriptionId, subscription);
    return true;
  }

  async pauseSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription || subscription.status !== 'active') {
      return false;
    }

    subscription.status = 'paused';
    this.subscriptions.set(subscriptionId, subscription);
    return true;
  }

  async resumeSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription || subscription.status !== 'paused') {
      return false;
    }

    subscription.status = 'active';
    subscription.nextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
    this.subscriptions.set(subscriptionId, subscription);
    return true;
  }

  getSubscription(subscriptionId: string): Subscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  getUserSubscriptions(userId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(
      s => s.userId === userId && s.status === 'active'
    );
  }

  getSubscriptionPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  hasActiveSubscription(userId: string): boolean {
    return this.getUserSubscriptions(userId).length > 0;
  }

  getUserPlan(userId: string): SubscriptionPlan | null {
    const subs = this.getUserSubscriptions(userId);
    return subs[0]?.plan || null;
  }

  recordRevenue(userId: string, amount: bigint): void {
    const history = this.revenueHistory.get(userId) || [];
    history.push(amount);
    this.revenueHistory.set(userId, history);
  }

  getTotalRevenue(userId: string): bigint {
    const history = this.revenueHistory.get(userId) || [];
    return history.reduce((sum, amount) => sum + amount, 0n);
  }

  getMonthlyRevenue(userId: string): bigint {
    const history = this.revenueHistory.get(userId) || [];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    return history
      .slice(-100)
      .reduce((sum, amount) => sum + amount, 0n);
  }

  formatFeeDescription(serviceType: ServiceType): string {
    const fee = FEES[serviceType];
    
    if (!fee) {
      return 'Unknown service';
    }

    if (fee.type === 'percentage') {
      return `${fee.amount}% of yield generated`;
    }

    return `${fee.amount} micro-STX`;
  }

  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

export const revenueManager = new RevenueManager();
