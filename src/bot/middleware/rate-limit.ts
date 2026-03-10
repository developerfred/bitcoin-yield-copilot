import { Context, NextFunction, MiddlewareFn } from 'grammy';
import pino from 'pino';

const logger = pino({ name: 'bot:middleware:rate-limit' });

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface UserBucket {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private buckets: Map<string, UserBucket> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Cleanup old buckets every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetTime < now) {
        this.buckets.delete(key);
      }
    }
  }

  isRateLimited(userId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket || bucket.resetTime < now) {
      bucket = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
      this.buckets.set(userId, bucket);
    }

    bucket.count++;
    return bucket.count > this.config.maxRequests;
  }

  getRemainingRequests(userId: string): number {
    const bucket = this.buckets.get(userId);
    if (!bucket) return this.config.maxRequests;
    return Math.max(0, this.config.maxRequests - bucket.count);
  }
}

// Default: 20 messages per minute
const rateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 20,
});

export const rateLimitMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = String(ctx.from?.id);
  
  if (!userId) {
    await next();
    return;
  }

  if (rateLimiter.isRateLimited(userId)) {
    const remaining = rateLimiter.getRemainingRequests(userId);
    
    logger.warn({ userId, remaining }, 'User rate limited');
    
    await ctx.reply(
      `⏳ You're sending messages too quickly. Please wait a moment.\n\nRemaining: ${remaining} requests`
    );
    return;
  }

  await next();
};
