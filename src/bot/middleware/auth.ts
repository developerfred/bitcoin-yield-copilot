import { Context, NextFunction } from 'grammy';
import pino from 'pino';

const logger = pino({ name: 'bot:auth' });

// ============================================================================
// PUBLIC COMMANDS — never blocked, always reach their handlers
// ============================================================================
const PUBLIC_COMMANDS = new Set([
  '/start',
  '/help',  
  '/wallet',
  '/withdraw',
  '/setwallet',
  '/removewallet',
  '/txs',
  '/txstatus',]);

export interface UserSession {
  telegramId: string;
  step: 'awaiting_risk' | 'awaiting_tokens' | 'awaiting_wallet' | 'complete';
  isOnboarded: boolean;
  riskProfile?: 'conservative' | 'moderate' | 'aggressive';
  allowedTokens?: string[];
  stacksAddress?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * AuthMiddleware
 *
 * Provides:
 * 1. middleware() — grammY-compatible middleware that ALWAYS calls next() for
 *    public commands so /start can never be swallowed.
 * 2. requireOnboarded() — guard middleware for commands that need a complete
 *    onboarding. Use it per-command, not globally.
 * 3. Session helpers (getSession, startOnboarding, …)
 */
export class AuthMiddleware {
  constructor(private db: any) { }

  // --------------------------------------------------------------------------
  // Core grammY middleware — attaches session to ctx, then always calls next()
  // --------------------------------------------------------------------------
  middleware() {
    return async (ctx: Context, next: NextFunction): Promise<void> => {
      const text = ctx.message?.text ?? '';
      const command = text.split(' ')[0].toLowerCase();

      // Public commands bypass ALL auth logic and go straight to next()
      if (PUBLIC_COMMANDS.has(command)) {
        logger.debug({ command }, 'Public command — skipping auth');
        return next();
      }

      const telegramId = String(ctx.from?.id);
      if (!telegramId) {
        logger.warn('Message with no from.id — skipping');
        return next();
      }

      try {
        // Attach session to ctx for downstream handlers (optional convenience)
        const session = await this.getSession(telegramId);
        (ctx as any).session = session;
      } catch (err) {
        // Never block the update on a DB error — just log and continue
        logger.error({ err, telegramId }, 'Auth middleware: session fetch failed, continuing anyway');
      }

      return next();
    };
  }

  // --------------------------------------------------------------------------
  // Guard middleware — use on individual commands that require onboarding
  //
  // Usage in setupHandlers:
  //   bot.command('portfolio', auth.requireOnboarded(), async (ctx) => { … });
  // --------------------------------------------------------------------------
  requireOnboarded() {
    return async (ctx: Context, next: NextFunction): Promise<void> => {
      const telegramId = String(ctx.from?.id);
      const session = (ctx as any).session ?? (await this.getSession(telegramId));

      if (!session?.isOnboarded) {
        await ctx.reply(
          '👋 You need to complete setup first.\n\nUse /start to get started.',
        );
        return; // intentionally does NOT call next()
      }

      return next();
    };
  }

  // --------------------------------------------------------------------------
  // Session helpers
  // --------------------------------------------------------------------------

  async getSession(telegramId: string): Promise<UserSession | null> {
    try {
      const user = await this.db.getUser(telegramId);
      if (!user) return null;

      return {
        telegramId,
        step: user.onboarding_step || 'awaiting_risk',
        isOnboarded: !!user.is_onboarded,
        riskProfile: user.risk_profile,
        allowedTokens: user.allowed_tokens
          ? JSON.parse(user.allowed_tokens)
          : undefined,
        stacksAddress: user.stacks_address,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error) {
      logger.error({ error, telegramId }, 'Failed to get session');
      return null;
    }
  }

  async startOnboarding(telegramId: string): Promise<void> {
    await this.db.upsertUser(telegramId, {
      onboarding_step: 'awaiting_risk',
      is_onboarded: false,
    });
  }

  async updateRiskProfile(telegramId: string, riskProfile: string): Promise<void> {
    await this.db.upsertUser(telegramId, {
      risk_profile: riskProfile,
      onboarding_step: 'awaiting_tokens',
    });
  }

  async updateAllowedTokens(telegramId: string, tokens: string[]): Promise<void> {
    await this.db.upsertUser(telegramId, {
      allowed_tokens: JSON.stringify(tokens),
      onboarding_step: 'awaiting_wallet',
    });
  }

  async updateWalletAddress(telegramId: string, address: string): Promise<void> {
    await this.db.upsertUser(telegramId, {
      stacks_address: address,
      updated_at: Date.now(),
    });
  }

  async completeOnboarding(telegramId: string, address: string): Promise<void> {
    await this.db.upsertUser(telegramId, {
      stacks_address: address,
      onboarding_step: 'complete',
      is_onboarded: true,
      updated_at: Date.now(),
    });
    await this.db.completeOnboarding(telegramId);
  }
}