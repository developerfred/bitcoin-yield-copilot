import 'dotenv/config';
import { Bot } from 'grammy';
import { createLogger } from 'pino';
import { config } from './config.js';
import { setupHandlers } from './bot/handlers/index.js';

const logger = createLogger({
  level: config.log.level,
  name: 'bitcoin-yield-copilot',
});

async function main() {
  logger.info('Starting Bitcoin Yield Copilot...');

  const bot = new Bot(config.telegram.botToken);

  setupHandlers(bot);

  logger.info(`Bot username: ${bot.botInfo.username}`);

  await bot.start();

  logger.info('Bot started successfully');
}

main().catch((error) => {
  logger.error(error, 'Failed to start bot');
  process.exit(1);
});
