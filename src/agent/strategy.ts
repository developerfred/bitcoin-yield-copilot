import { x402Client, X402PaymentResponse } from '../x402/client';
import pino from 'pino';

const logger = pino({ name: 'agent:strategy' });

export interface YieldOpportunity {
  protocol: 'zest' | 'alex' | 'hermetica' | 'bitflow';
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  token: string;
  estimatedFee: number;
  dataCost: number;
  netApy: number;
  timestamp: number;
}

export interface YieldData {
  protocol: 'zest' | 'alex' | 'hermetica' | 'bitflow';
  apy: number;
  tvl: number;
  timestamp: number;
  source: string;
}

export interface PriceData {
  [token: string]: number;
}

export interface UserPreferences {
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  allowedTokens: string[];
  maxDataCost: number;
  minNetApy: number;
}

export class YieldStrategy {
  private userPreferences: UserPreferences;
  private paidDataEnabled: boolean;
  private totalDataCost: number;

  constructor(preferences: UserPreferences) {
    this.userPreferences = preferences;
    this.paidDataEnabled = process.env.ENABLE_PAID_DATA === 'true';
    this.totalDataCost = 0;
  }

  async findBestYieldOpportunities(amount: number): Promise<YieldOpportunity[]> {
    logger.info(`Finding yield opportunities for ${amount} sBTC`);
    
    const allOpportunities: YieldOpportunity[] = [];
    
    try {
      if (this.paidDataEnabled) {
        allOpportunities.push(...await this.getPaidYieldOpportunities());
      } else {
        allOpportunities.push(...await this.getFreeYieldOpportunities());
      }
    } catch (error) {
      logger.error('Failed to get yield opportunities: %s', error);
      return [];
    }

    const filtered = this.filterOpportunities(allOpportunities);
    const scored = this.scoreOpportunities(filtered, amount);
    
    return scored.slice(0, 3);
  }

  private async getPaidYieldOpportunities(): Promise<YieldOpportunity[]> {
    const opportunities: YieldOpportunity[] = [];
    const protocols: ('zest' | 'alex' | 'hermetica' | 'bitflow')[] = ['zest', 'alex', 'hermetica', 'bitflow'];
    
    for (const protocol of protocols) {
      try {
        const paymentStart = Date.now();
        const yieldData = await x402Client.getPaidAPYData(protocol);
        const paymentTime = Date.now() - paymentStart;
        
        this.totalDataCost += this.calculateDataCost(paymentTime);
        
        const priceData = await this.getCurrentPrices([yieldData.source]);
        
        const estimatedFee = this.estimateProtocolFee(protocol, yieldData.apy);
        const dataCost = this.calculateDataCost(paymentTime);
        const netApy = yieldData.apy - estimatedFee - dataCost;
        
        if (netApy > this.userPreferences.minNetApy) {
          opportunities.push({
            protocol,
            apy: yieldData.apy,
            tvl: yieldData.tvl,
            risk: this.assessRisk(protocol, { ...yieldData, protocol }),
            token: yieldData.source,
            estimatedFee,
            dataCost,
            netApy,
            timestamp: yieldData.timestamp,
          });
        }
        
        logger.info(`Paid data for ${protocol}: APY=${yieldData.apy}%, Net=${netApy}%`);
      } catch (error) {
        logger.warn('Failed to get paid data for %s: %s', protocol, error);
      }
    }
    
    return opportunities;
  }

  private async getFreeYieldOpportunities(): Promise<YieldOpportunity[]> {
    const opportunities: YieldOpportunity[] = [];
    
    opportunities.push({
      protocol: 'zest',
      apy: 8.2,
      tvl: 50000000,
      risk: 'low',
      token: 'sBTC',
      estimatedFee: 0.1,
      dataCost: 0,
      netApy: 8.1,
      timestamp: Date.now(),
    });
    
    opportunities.push({
      protocol: 'alex',
      apy: 11.4,
      tvl: 75000000,
      risk: 'medium',
      token: 'sBTC',
      estimatedFee: 0.2,
      dataCost: 0,
      netApy: 11.2,
      timestamp: Date.now(),
    });
    
    opportunities.push({
      protocol: 'hermetica',
      apy: 6.1,
      tvl: 30000000,
      risk: 'low',
      token: 'sBTC',
      estimatedFee: 0.15,
      dataCost: 0,
      netApy: 5.95,
      timestamp: Date.now(),
    });
    
    return opportunities;
  }

  private filterOpportunities(opportunities: YieldOpportunity[]): YieldOpportunity[] {
    return opportunities.filter(opp => {
      if (!this.userPreferences.allowedTokens.includes(opp.token)) {
        return false;
      }
      
      if (opp.netApy < this.userPreferences.minNetApy) {
        return false;
      }
      
      if (this.userPreferences.riskProfile === 'conservative' && opp.risk !== 'low') {
        return false;
      }
      
      if (this.userPreferences.riskProfile === 'moderate' && opp.risk === 'high') {
        return false;
      }
      
      return true;
    });
  }

  private scoreOpportunities(opportunities: YieldOpportunity[], amount: number): YieldOpportunity[] {
    return opportunities.sort((a, b) => {
      const scoreA = this.calculateScore(a, amount);
      const scoreB = this.calculateScore(b, amount);
      return scoreB - scoreA;
    });
  }

  private calculateScore(opportunity: YieldOpportunity, amount: number): number {
    let score = opportunity.netApy * 100;
    
    if (this.userPreferences.riskProfile === 'conservative') {
      score *= opportunity.risk === 'low' ? 1.5 : opportunity.risk === 'medium' ? 1.2 : 0.8;
    } else if (this.userPreferences.riskProfile === 'moderate') {
      score *= opportunity.risk === 'low' ? 1.2 : opportunity.risk === 'medium' ? 1.5 : 1.0;
    } else {
      score *= opportunity.risk === 'low' ? 0.8 : opportunity.risk === 'medium' ? 1.2 : 1.5;
    }
    
    const tvlScore = Math.log10(opportunity.tvl) * 10;
    score += tvlScore;
    
    const estimatedYield = (amount * opportunity.netApy) / 100;
    score += estimatedYield * 100;
    
    return score;
  }

  private assessRisk(protocol: 'zest' | 'alex' | 'hermetica' | 'bitflow', data: YieldData): 'low' | 'medium' | 'high' {
    const riskMap: Record<string, 'low' | 'medium' | 'high'> = {
      zest: 'low',
      hermetica: 'low',
      alex: 'medium',
      bitflow: 'high',
    };
    
    const baseRisk = riskMap[protocol];
    
    if (data.tvl > 100000000) {
      return 'low';
    } else if (data.tvl > 50000000) {
      return baseRisk === 'high' ? 'medium' : baseRisk;
    } else {
      return baseRisk === 'low' ? 'medium' : baseRisk;
    }
  }

  private estimateProtocolFee(protocol: string, apy: number): number {
    const feeMap: Record<string, number> = {
      zest: 0.1,
      alex: 0.2,
      hermetica: 0.15,
      bitflow: 0.3,
    };
    
    return feeMap[protocol] || 0.2;
  }

  private calculateDataCost(paymentTimeMs: number): number {
    return (paymentTimeMs / 1000) * 0.001;
  }

  private async getCurrentPrices(tokens: string[]): Promise<PriceData> {
    if (this.paidDataEnabled) {
      try {
        return await x402Client.getPaidPriceData(tokens);
      } catch (error) {
        logger.warn('Failed to get paid price data: %s', error);
      }
    }
    
    const defaultPrices: PriceData = {
      sBTC: 65000,
      STX: 2.5,
      USDA: 1.0,
    };
    
    const result: PriceData = {};
    tokens.forEach(token => {
      result[token] = defaultPrices[token] || 1.0;
    });
    
    return result;
  }

  getTotalDataCost(): number {
    return this.totalDataCost;
  }

  resetDataCost(): void {
    this.totalDataCost = 0;
  }

  shouldUsePaidData(): boolean {
    return this.paidDataEnabled && this.userPreferences.maxDataCost > 0;
  }

  createDecisionSummary(opportunities: YieldOpportunity[], selectedIndex: number): string {
    if (opportunities.length === 0) {
      return 'No suitable yield opportunities found.';
    }

    const selected = opportunities[selectedIndex];
    const others = opportunities.filter((_, i) => i !== selectedIndex);

    let summary = `Selected: ${selected.protocol.toUpperCase()} at ${selected.netApy.toFixed(2)}% APY (net after fees)\n`;
    summary += `Risk: ${selected.risk.toUpperCase()}, TVL: $${selected.tvl.toLocaleString()}\n`;
    summary += `Estimated fees: ${selected.estimatedFee}% protocol + ${selected.dataCost.toFixed(4)}% data cost\n\n`;
    
    if (others.length > 0) {
      summary += 'Other considered options:\n';
      others.forEach((opp, i) => {
        summary += `${i + 1}. ${opp.protocol}: ${opp.netApy.toFixed(2)}% APY (${opp.risk} risk)\n`;
      });
    }

    if (this.paidDataEnabled) {
      summary += `\nTotal data cost incurred: ${this.totalDataCost.toFixed(4)}%`;
    }

    return summary;
  }
}