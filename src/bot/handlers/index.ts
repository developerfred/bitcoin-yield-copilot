import { Bot, Context, Keyboard } from 'grammy';
import { Database } from '../../agent/database.js';
import { AuthMiddleware, UserSession } from '../middleware/auth.js';
import { mcpClient } from '../../mcp/client.js';
import { createLogger } from 'pino';

const logger = createLogger({ name: 'bot:handlers' });

export function setupHandlers(bot: Bot<Context>) {
  const db = new Database();
  const auth = new AuthMiddleware(db);

  // Keyboard helpers
  const riskKeyboard = new Keyboard()
    .text('🟢 Conservative')
    .text('🟡 Moderate')
    .text('🔴 Aggressive')
    .oneTime();

  const tokensKeyboard = new Keyboard()
    .text('Only sBTC')
    .text('sBTC + STX')
    .text('All tokens')
    .oneTime();

  // /start command - initiates onboarding for new users
  bot.command('start', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    
    const session = await auth.getSession(telegramId);

    if (session?.isOnboarded) {
      await ctx.reply(`👋 Welcome back!\n\nYour wallet: \`${session.stacksAddress}\`\n\nWhat would you like to do with your Bitcoin?`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    if (session?.step === 'awaiting_risk') {
      await ctx.reply('Please select your risk profile:', { reply_markup: riskKeyboard });
      return;
    }

    if (session?.step === 'awaiting_tokens') {
      await ctx.reply('Which tokens can I manage?', { reply_markup: tokensKeyboard });
      return;
    }

    if (session?.step === 'awaiting_wallet') {
      await ctx.reply('Please connect your Stacks wallet by sending your address:');
      return;
    }

    // Start new onboarding
    await auth.startOnboarding(telegramId);

    await ctx.reply(
      `👋 Welcome to Bitcoin Yield Copilot!\n\nI help you earn yield on your Bitcoin in the Stacks ecosystem.\n\nLet's set up your profile.`,
    );

    await ctx.reply(
      '📊 What is your risk profile?',
      { reply_markup: riskKeyboard }
    );
  });

  // Risk profile responses
  bot.hear('🟢 Conservative', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (session?.step !== 'awaiting_risk') {
      await ctx.reply('Please use /start to begin.');
      return;
    }

    await auth.updateRiskProfile(telegramId, 'conservative');

    await ctx.reply(
      '✅ Risk profile set to Conservative\n\nWhich tokens can I manage?',
      { reply_markup: tokensKeyboard }
    );
  });

  bot.hear('🟡 Moderate', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (session?.step !== 'awaiting_risk') {
      await ctx.reply('Please use /start to begin.');
      return;
    }

    await auth.updateRiskProfile(telegramId, 'moderate');

    await ctx.reply(
      '✅ Risk profile set to Moderate\n\nWhich tokens can I manage?',
      { reply_markup: tokensKeyboard }
    );
  });

  bot.hear('🔴 Aggressive', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (session?.step !== 'awaiting_risk') {
      await ctx.reply('Please use /start to begin.');
      return;
    }

    await auth.updateRiskProfile(telegramId, 'aggressive');

    await ctx.reply(
      '✅ Risk profile set to Aggressive\n\nWhich tokens can I manage?',
      { reply_markup: tokensKeyboard }
    );
  });

  // Token selection responses
  bot.hear('Only sBTC', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (session?.step !== 'awaiting_tokens') {
      await ctx.reply('Please use /start to begin.');
      return;
    }

    await auth.updateAllowedTokens(telegramId, ['sBTC']);

    await ctx.reply(
      '✅ I can only manage sBTC\n\nNow, please send me your Stacks wallet address (starts with SP, SM, or SZ):'
    );
  });

  bot.hear('sBTC + STX', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (session?.step !== 'awaiting_tokens') {
      await ctx.reply('Please use /start to begin.');
      return;
    }

    await auth.updateAllowedTokens(telegramId, ['sBTC', 'STX']);

    await ctx.reply(
      '✅ I can manage sBTC and STX\n\nNow, please send me your Stacks wallet address:'
    );
  });

  bot.hear('All tokens', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (session?.step !== 'awaiting_tokens') {
      await ctx.reply('Please use /start to begin.');
      return;
    }

    await auth.updateAllowedTokens(telegramId, ['sBTC', 'STX', 'USDCx']);

    await ctx.reply(
      '✅ I can manage all tokens (sBTC, STX, USDCx)\n\nNow, please send me your Stacks wallet address:'
    );
  });

  // Handle wallet address input
  bot.hear(/^(SP|SM|SZ)[A-HJ-NP-Za-km-z1-9]{38,50}$/, async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (session?.step !== 'awaiting_wallet') {
      return;
    }

    const address = ctx.match[0];

    await auth.completeOnboarding(telegramId, address);

    await ctx.reply(
      `🎉 Onboarding complete!\n\nYour Stacks wallet: \`${address}\`\n\nYou can now:\n• /yields - Discover yield opportunities\n• /portfolio - View your positions\n• /help - Get more help\n\nWhat would you like to do?`,
      { parse_mode: 'Markdown' }
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(`📖 Bitcoin Yield Copilot Help

I help you manage your Bitcoin yield in the Stacks ecosystem.

Commands:
/start - Start or restart onboarding
/yields - Discover current yield opportunities
/portfolio - View your positions
/alerts - Manage APY alerts
/help - Show this help

Examples:
• "Show me yields"
• "Put my sBTC to work"
• "What's my portfolio?"
• "Withdraw from Zest"`);
  });

  // /yields command - fetch current APYs
  bot.command('yields', async (ctx) => {
    await ctx.reply('🔍 Fetching yield opportunities...');

    try {
      const apys = await mcpClient.getProtocolAPYs();

      if (apys.length === 0) {
        await ctx.reply(
          '⚠️ Could not fetch APYs at the moment. Please try again later.\n\nThe MCP server may be unavailable.'
        );
        return;
      }

      let message = '📈 Current Yield Opportunities:\n\n';
      
      for (const { protocol, apy, token } of apys) {
        const emoji = apy > 8 ? '🟢' : apy > 5 ? '🟡' : '🔴';
        message += `${emoji} ${protocol.toUpperCase()}: ${apy.toFixed(2)}% APY (${token})\n`;
      }

      message += '\nUse /portfolio to view your positions.';
      await ctx.reply(message);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch yields');
      await ctx.reply('❌ Failed to fetch yields. Please try again later.');
    }
  });

  // /portfolio command
  bot.command('portfolio', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (!session?.isOnboarded) {
      await ctx.reply('Please complete onboarding first: /start');
      return;
    }

    const user = await db.getUser(telegramId);
    if (!user) return;

    const positions = await db.getUserPositions(user.id);

    if (positions.length === 0) {
      await ctx.reply(
        `📊 Your Portfolio\n\nWallet: \`${session.stacksAddress}\`\n\nNo active positions.\n\nUse /yields to discover opportunities!`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let totalValue = 0;
    let message = `📊 Your Portfolio\n\nWallet: \`${session.stacksAddress}\`\n\nPositions:\n`;

    for (const pos of positions as any[]) {
      message += `• ${pos.protocol}: ${pos.amount} ${pos.token} @ ${pos.apy}% APY\n`;
      totalValue += pos.amount;
    }

    message += `\nTotal: ${totalValue} sBTC\n`;
    message += '\nUse /yields to find more opportunities!';

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // /alerts command
  bot.command('alerts', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (!session?.isOnboarded) {
      await ctx.reply('Please complete onboarding first: /start');
      return;
    }

    const user = await db.getUser(telegramId);
    if (!user) return;

    const alerts = await db.getUserAlerts(user.id);

    if (alerts.length === 0) {
      await ctx.reply('📢 APY Alerts\n\nNo active alerts.\n\nSay something like "Alert me if Zest drops below 5%" to create one.');
      return;
    }

    let message = '📢 Your APY Alerts:\n\n';
    for (const alert of alerts as any[]) {
      message += `• ${alert.protocol}: below ${alert.threshold}%\n`;
    }

    await ctx.reply(message);
  });

  // AI message handler - uses Claude for natural language
  bot.on('message:text', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const text = ctx.message.text;

    // Skip if it's a command
    if (text.startsWith('/')) return;

    const session = await auth.getSession(telegramId);

    // Handle onboarding states
    if (session?.step === 'awaiting_wallet') {
      // Try to match Stacks address
      const addressMatch = text.match(/^(SP|SM|SZ)[A-HJ-NP-Za-km-z1-9]{38,50}$/);
      if (addressMatch) {
        await ctx.react('👍');
        return;
      }
      await ctx.reply('Please send a valid Stacks address (starts with SP, SM, or SZ):');
      return;
    }

    // If not onboarded, redirect to /start
    if (!session?.isOnboarded) {
      await ctx.reply('Please complete onboarding first: /start');
      return;
    }

    // Process AI message
    await ctx.reply('🤔 Thinking...');

    try {
      const apys = await mcpClient.getProtocolAPYs();
      
      // Simple response based on keywords
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('yield') || lowerText.includes('ap') || lowerText.includes('render')) {
        if (apys.length > 0) {
          let message = '📈 Yield Opportunities:\n\n';
          for (const { protocol, apy, token } of apys) {
            message += `• ${protocol}: ${apy.toFixed(2)}% APY\n`;
          }
          message += '\nWhich protocol would you like to use?';
          await ctx.reply(message);
        } else {
          await ctx.reply('Could not fetch yields. Please try /yields');
        }
      } else if (lowerText.includes('portfolio') || lowerText.includes('posição')) {
        await ctx.reply('Use /portfolio to view your positions.');
      } else {
        await ctx.reply(
          `I understand you want to: "${text}"\n\n` +
          'I can help you with:\n' +
          '• Finding yield opportunities (/yields)\n' +
          '• Viewing your portfolio (/portfolio)\n' +
          '• Depositing Bitcoin\n\nTry: "Show me yields"'
        );
      }
    } catch (error) {
      logger.error({ error }, 'AI message processing failed');
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  });

  logger.info('Bot handlers configured');
}
