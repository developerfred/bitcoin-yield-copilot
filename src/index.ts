import 'dotenv/config';
import { Bot } from 'grammy';
import { createLogger } from 'pino';
import { config } from './config.js';
import { setupHandlers } from './bot/handlers/index.js';
import { errorHandlingMiddleware, loggingMiddleware } from './bot/middleware/error.js';
import { rateLimitMiddleware } from './bot/middleware/rate-limit.js';

const logger = createLogger({
  level: config.log.level,
  name: 'bitcoin-yield-copilot',
});

async function main() {
  logger.info('Starting Bitcoin Yield Copilot...');

  const bot = new Bot(config.telegram.botToken);

  // Apply middleware in order
  bot.use(rateLimitMiddleware);
  bot.use(loggingMiddleware);
  bot.use(errorHandlingMiddleware);

  setupHandlers(bot);

  logger.info(`Bot username: ${bot.botInfo.username}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    await bot.stop();
    logger.info('Bot stopped');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bot.start();

  logger.info('Bot started successfully');
}

main().catch((error) => {
  logger.error(error, 'Failed to start bot');
  process.exit(1);
});
