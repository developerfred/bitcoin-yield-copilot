import { Context, NextFunction } from 'grammy';
import  pino from 'pino';

const logger = pino({ name: 'bot:middleware:error' });

export async function errorHandlingMiddleware(ctx: Context, next: NextFunction) {
  try {
    console.log('[DEBUG] Calling next middleware...');
    await next();
    console.log('[DEBUG] Next middleware completed');
  } catch (error: any) {
    console.log('[DEBUG] ERROR in handler:', error.message);
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
  
  const msgType = ctx.message ? 'text' : ctx.callbackQuery ? 'callback' : 'other';
  const msgText = ctx.message?.text || ctx.callbackQuery?.data || '';
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  
  console.log(`[TELEGRAM IN] type=${msgType} user=${userId} chat=${chatId} text="${msgText.substring(0, 50)}"`);
  
  logger.debug({
    chat: ctx.chat?.id,
    user: ctx.from?.id,
    text: ctx.message?.text,
  }, 'Incoming message');

  await next();

  const duration = Date.now() - start;
  logger.debug({ duration }, 'Message processed');
}
