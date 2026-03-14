import pino from 'pino';

const logger = pino({ name: 'security:asset-protection' });

export interface AssetProtectionConfig {
  maxSingleTransactionPercent: number;
  maxDailyTransactionPercent: number;
  requireConfirmationForLargeTx: boolean;
  largeTransactionThreshold: number;
  enableWhitelistMode: boolean;
  whitelistedProtocols: string[];
  enableEmergencyPause: boolean;
  emergencyContacts: string[];
}

const DEFAULT_CONFIG: AssetProtectionConfig = {
  maxSingleTransactionPercent: 80,
  maxDailyTransactionPercent: 95,
  requireConfirmationForLargeTx: true,
  largeTransactionThreshold: 1000,
  enableWhitelistMode: true,
  whitelistedProtocols: ['zest', 'alex', 'hermetica', 'bitflow'],
  enableEmergencyPause: true,
  emergencyContacts: [],
};

interface TransactionRequest {
  userId: string;
  protocol: string;
  token: string;
  amount: number;
  action: 'deposit' | 'withdraw';
}

interface UserPortfolio {
  totalValue: number;
  tokens: { symbol: string; value: number }[];
}

export class AssetProtection {
  private config: AssetProtectionConfig;
  private dailyTransactionVolume: Map<string, { amount: number; date: string }> = new Map();
  private isPaused: boolean = false;
  private pauseReason?: string;

  constructor(config: Partial<AssetProtectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  validateTransaction(request: TransactionRequest, portfolio: UserPortfolio): { allowed: boolean; error?: string; warnings?: string[] } {
    if (this.isPaused) {
      logger.warn({ userId: request.userId, reason: this.pauseReason }, 'Transaction blocked - system paused');
      return { allowed: false, error: `System is currently paused: ${this.pauseReason || 'maintenance'}` };
    }

    const warnings: string[] = [];
    const amount = Number(request.amount);

    if (amount <= 0) {
      return { allowed: false, error: 'Amount must be greater than 0' };
    }

    if (this.config.enableWhitelistMode) {
      if (!this.config.whitelistedProtocols.includes(request.protocol)) {
        logger.warn({ protocol: request.protocol }, 'Protocol not in whitelist');
        return { allowed: false, error: `Protocol ${request.protocol} is not supported` };
      }
    }

    const singlePercent = (amount / portfolio.totalValue) * 100;
    if (singlePercent > this.config.maxSingleTransactionPercent) {
      logger.warn({ 
        userId: request.userId, 
        percent: singlePercent,
        max: this.config.maxSingleTransactionPercent 
      }, 'Single transaction exceeds limit');
      return { 
        allowed: false, 
        error: `Transaction of ${singlePercent.toFixed(1)}% of portfolio exceeds maximum of ${this.config.maxSingleTransactionPercent}%` 
      };
    }

    if (singlePercent > 50) {
      warnings.push(`Large transaction: ${singlePercent.toFixed(1)}% of portfolio`);
    }

    const dailyTotal = this.getDailyTransactionTotal(request.userId);
    const projectedDaily = dailyTotal + amount;
    const dailyPercent = (projectedDaily / portfolio.totalValue) * 100;
    
    if (dailyPercent > this.config.maxDailyTransactionPercent) {
      logger.warn({
        userId: request.userId,
        percent: dailyPercent,
        max: this.config.maxDailyTransactionPercent
      }, 'Daily transaction limit exceeded');
      return {
        allowed: false,
        error: `Daily transaction limit of ${this.config.maxDailyTransactionPercent}% would be exceeded`
      };
    }

    if (amount > this.config.largeTransactionThreshold && this.config.requireConfirmationForLargeTx) {
      warnings.push(`Large transaction requires confirmation: ${amount} ${request.token}`);
    }

    this.recordTransaction(request.userId, amount);

    logger.info({ 
      userId: request.userId,
      protocol: request.protocol,
      amount: request.amount,
      percentOfPortfolio: singlePercent.toFixed(2)
    }, 'Transaction validated');

    return { allowed: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  private getDailyTransactionTotal(userId: string): number {
    const today = new Date().toISOString().split('T')[0];
    const record = this.dailyTransactionVolume.get(userId);
    
    if (!record || record.date !== today) {
      return 0;
    }
    
    return record.amount;
  }

  private recordTransaction(userId: string, amount: number): void {
    const today = new Date().toISOString().split('T')[0];
    const current = this.dailyTransactionVolume.get(userId);
    
    if (current && current.date === today) {
      current.amount += amount;
    } else {
      this.dailyTransactionVolume.set(userId, { amount, date: today });
    }
  }

  pause(reason: string): void {
    if (!this.config.enableEmergencyPause) {
      logger.warn('Emergency pause requested but disabled in config');
      return;
    }

    this.isPaused = true;
    this.pauseReason = reason;
    logger.warn({ reason }, 'Asset protection emergency pause activated');
  }

  resume(): void {
    this.isPaused = false;
    this.pauseReason = undefined;
    logger.info('Asset protection resumed');
  }

  isSystemPaused(): boolean {
    return this.isPaused;
  }

  getSystemStatus(): { paused: boolean; reason?: string } {
    return { paused: this.isPaused, reason: this.pauseReason };
  }

  getDailyLimit(): number {
    return this.config.maxDailyTransactionPercent;
  }

  getSingleTransactionLimit(): number {
    return this.config.maxSingleTransactionPercent;
  }

  isWhitelistedProtocol(protocol: string): boolean {
    return this.config.whitelistedProtocols.includes(protocol);
  }

  getWhitelistedProtocols(): string[] {
    return [...this.config.whitelistedProtocols];
  }

  addWhitelistedProtocol(protocol: string): void {
    if (!this.config.whitelistedProtocols.includes(protocol)) {
      this.config.whitelistedProtocols.push(protocol);
      logger.info({ protocol }, 'Protocol added to whitelist');
    }
  }

  removeWhitelistedProtocol(protocol: string): void {
    const index = this.config.whitelistedProtocols.indexOf(protocol);
    if (index > -1) {
      this.config.whitelistedProtocols.splice(index, 1);
      logger.info({ protocol }, 'Protocol removed from whitelist');
    }
  }
}

export const assetProtection = new AssetProtection();
