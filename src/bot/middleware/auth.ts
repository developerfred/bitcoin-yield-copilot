import { Database } from './database.js';
import { createLogger } from 'pino';

const logger = createLogger({ name: 'bot:middleware:auth' });

export interface UserSession {
  telegramId: string;
  stacksAddress?: string;
  riskProfile?: 'conservative' | 'moderate' | 'aggressive';
  allowedTokens?: ('sBTC' | 'STX' | 'USDCx')[];
  isOnboarded: boolean;
  step?: 'awaiting_risk' | 'awaiting_tokens' | 'awaiting_wallet';
}

export class AuthMiddleware {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getSession(telegramId: string): Promise<UserSession | null> {
    const user = await this.db.getUser(telegramId);
    if (!user) return null;
    return {
      telegramId: user.telegram_id,
      stacksAddress: user.stacks_address ?? undefined,
      riskProfile: user.risk_profile as UserSession['riskProfile'],
      allowedTokens: user.allowed_tokens ? JSON.parse(user.allowed_tokens) : undefined,
      isOnboarded: user.is_onboarded === 1,
      step: user.onboarding_step as UserSession['step'],
    };
  }

  async startOnboarding(telegramId: string): Promise<void> {
    await this.db.createUser(telegramId);
    await this.db.updateOnboardingStep(telegramId, 'awaiting_risk');
    logger.info({ telegramId }, 'Started onboarding');
  }

  async updateRiskProfile(telegramId: string, riskProfile: UserSession['riskProfile']): Promise<void> {
    await this.db.updateRiskProfile(telegramId, riskProfile);
    await this.db.updateOnboardingStep(telegramId, 'awaiting_tokens');
    logger.info({ telegramId, riskProfile }, 'Risk profile updated');
  }

  async updateAllowedTokens(telegramId: string, tokens: UserSession['allowedTokens']): Promise<void> {
    await this.db.updateAllowedTokens(telegramId, tokens);
    await this.db.updateOnboardingStep(telegramId, 'awaiting_wallet');
    logger.info({ telegramId, tokens }, 'Allowed tokens updated');
  }

  async completeOnboarding(telegramId: string, stacksAddress: string): Promise<void> {
    await this.db.updateStacksAddress(telegramId, stacksAddress);
    await this.db.completeOnboarding(telegramId);
    logger.info({ telegramId, stacksAddress }, 'Onboarding completed');
  }
}
