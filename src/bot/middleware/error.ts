import { Context, NextFunction } from 'grammy';
import { createLogger } from 'pino';

const logger = createLogger({ name: 'bot:middleware:error' });

export async function errorHandlingMiddleware(ctx: Context, next: NextFunction) {
  try {
    await next();
  } catch (error: any) {
    logger.error({ error, chat: ctx.chat?.id, user: ctx.from?.id }, 'Unhandled error in bot');

    const errorMessage = error.message || 'An unexpected error occurred';

    try {
      if (ctx.chat?.id) {
        await ctx.reply(
          `❌ An error occurred: ${errorMessage}\n\nPlease try again or contact support.`
        );
      }
    } catch (replyError) {
      logger.error({ replyError }, 'Failed to send error reply');
    }
  }
}

export async function loggingMiddleware(ctx: Context, next: NextFunction) {
  const start = Date.now();
  
  logger.debug({
    chat: ctx.chat?.id,
    user: ctx.from?.id,
    text: ctx.message?.text,
  }, 'Incoming message');

  await next();

  const duration = Date.now() - start;
  logger.debug({ duration }, 'Message processed');
}
