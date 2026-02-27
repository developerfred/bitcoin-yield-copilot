import { Bot, Context, Keyboard, InlineKeyboard } from 'grammy';
import { getDatabase } from '../../agent/database.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { mcpClient } from '../../mcp/client.js';
import { ClaudeAgent, Tool } from '../../agent/claude.js';
import { createLogger } from 'pino';

const logger = createLogger({ name: 'bot:handlers' });

// Define tools available to Claude
const agentTools: Tool[] = [
  {
    name: 'get_yields',
    description: 'Get current yield opportunities from DeFi protocols',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_portfolio',
    description: 'Get user portfolio positions',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'deposit',
    description: 'Deposit funds into a yield protocol',
    input_schema: {
      type: 'object',
      properties: {
        protocol: { type: 'string', description: 'Protocol name (zest, alex, hermetica, bitflow)' },
        token: { type: 'string', description: 'Token to deposit (sBTC, STX)' },
        amount: { type: 'string', description: 'Amount to deposit' },
      },
      required: ['protocol', 'token', 'amount'],
    },
  },
  {
    name: 'withdraw',
    description: 'Withdraw funds from a yield protocol',
    input_schema: {
      type: 'object',
      properties: {
        protocol: { type: 'string', description: 'Protocol name' },
        token: { type: 'string', description: 'Token to withdraw' },
        amount: { type: 'string', description: 'Amount to withdraw' },
      },
      required: ['protocol', 'token', 'amount'],
    },
  },
  {
    name: 'get_balance',
    description: 'Get wallet balance',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Stacks wallet address' },
      },
      required: ['address'],
    },
  },
];

export function setupHandlers(bot: Bot<Context>) {
  const db = getDatabase();
  const auth = new AuthMiddleware(db);
  const claudeAgent = new ClaudeAgent();

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

  // /connectwallet command - Connect wallet separately
  bot.command('connect', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const session = await auth.getSession(telegramId);

    if (!session) {
      await ctx.reply('Please start with /start first');
      return;
    }

    await sendWalletConnectionPrompt(ctx, session);
  });

  // Handle wallet connection callback
  bot.callbackQuery('connect_wallet', async (ctx) => {
    await handleWalletConnection(ctx, auth);
  });

  // Handle wallet address input - backward compatibility
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

    // Process AI message with Claude
    await ctx.reply('🤔 Thinking...');

    try {
      // Build context for Claude
      const user = await db.getUser(telegramId);
      const positions = user ? await db.getUserPositions(user.id) : [];
      
      const contextMessage = `User context:
- Risk profile: ${session.riskProfile || 'not set'}
- Allowed tokens: ${session.allowedTokens?.join(', ') || 'not set'}
- Wallet: ${session.stacksAddress}
- Current positions: ${positions.length > 0 ? (positions as any[]).map((p) => `${p.protocol}: ${p.amount} ${p.token}`).join(', ') : 'none'}

User message: ${text}`;

      // Get AI response
      const { response, toolCalls } = await claudeAgent.sendMessage(
        [{ role: 'user', content: contextMessage }],
        agentTools
      );

      // If Claude wants to use tools, execute them
      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          logger.info({ tool: toolCall.name, args: toolCall.input }, 'Executing tool');
          
          let toolResult = '';
          
          switch (toolCall.name) {
            case 'get_yields': {
              const apys = await mcpClient.getProtocolAPYs();
              toolResult = JSON.stringify(apys);
              break;
            }
            case 'get_portfolio':
              toolResult = JSON.stringify(positions);
              break;
            case 'get_balance': {
              const balance = await mcpClient.getStacksBalance(toolCall.input.address as string);
              toolResult = JSON.stringify(balance);
              break;
            }
            case 'deposit': {
              const depositInlineKeyboard = new InlineKeyboard()
                .text('✅ Confirm', `confirm_deposit_${toolCall.input.protocol}_${toolCall.input.amount}`)
                .text('❌ Cancel', 'cancel_action');
              
              await ctx.reply(
                `📝 Confirm Deposit\n\nProtocol: ${toolCall.input.protocol}\nToken: ${toolCall.input.token}\nAmount: ${toolCall.input.amount}\n\nIs this correct?`,
                { reply_markup: depositInlineKeyboard }
              );
              return;
            }
            case 'withdraw': {
              const withdrawInlineKeyboard = new InlineKeyboard()
                .text('✅ Confirm', `confirm_withdraw_${toolCall.input.protocol}_${toolCall.input.amount}`)
                .text('❌ Cancel', 'cancel_action');
              
              await ctx.reply(
                `📝 Confirm Withdrawal\n\nProtocol: ${toolCall.input.protocol}\nToken: ${toolCall.input.token}\nAmount: ${toolCall.input.amount}\n\nIs this correct?`,
                { reply_markup: withdrawInlineKeyboard }
              );
              return;
            }
            default:
              toolResult = `Unknown tool: ${toolCall.name}`;
          }
          
          // Continue conversation with tool result
          const continueResponse = await claudeAgent.sendMessage(
            [
              { role: 'user', content: contextMessage },
              { role: 'assistant' as any, content: response },
              { role: 'tool' as any, content: toolResult },
            ],
            agentTools
          );
          
          await ctx.reply(continueResponse.response);
          return;
        }
      }

      // Just send the response
      await ctx.reply(response);
      
    } catch (error) {
      logger.error({ error }, 'AI message processing failed');
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  });

  // Handle confirmation callbacks
  bot.callbackQuery(/confirm_deposit_(.+)_(\d+\.?\d*)/, async (ctx) => {
    const [protocol, amount] = ctx.match;
    const telegramId = String(ctx.from?.id);
    
    await ctx.answerCallbackQuery('Processing deposit...');
    
    const session = await auth.getSession(telegramId);
    if (!session?.stacksAddress) {
      await ctx.editMessageText('❌ Wallet not connected');
      return;
    }

    try {
      await ctx.editMessageText(`⏳ Depositing ${amount} sBTC to ${protocol}...`);
      
      const result = await mcpClient.executeDeposit(protocol, 'sBTC', amount, session.stacksAddress);
      
      // Store position in database
      const user = await db.getUser(telegramId);
      if (user) {
        await db.createPosition(user.id, protocol, 'sBTC', parseFloat(amount), 0, result.txId);
      }
      
      await ctx.editMessageText(
        `✅ Deposit successful!\n\nAmount: ${amount} sBTC\nProtocol: ${protocol}\nTx: \`${result.txId}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      await ctx.editMessageText(`❌ Deposit failed: ${error.message}`);
    }
  });

  bot.callbackQuery(/confirm_withdraw_(.+)_(\d+\.?\d*)/, async (ctx) => {
    const [protocol, amount] = ctx.match;
    const telegramId = String(ctx.from?.id);
    
    await ctx.answerCallbackQuery('Processing withdrawal...');
    
    const session = await auth.getSession(telegramId);
    if (!session?.stacksAddress) {
      await ctx.editMessageText('❌ Wallet not connected');
      return;
    }

    try {
      await ctx.editMessageText(`⏳ Withdrawing ${amount} sBTC from ${protocol}...`);
      
      const result = await mcpClient.executeWithdraw(protocol, 'sBTC', amount, session.stacksAddress);
      
      await ctx.editMessageText(
        `✅ Withdrawal successful!\n\nAmount: ${amount} sBTC\nProtocol: ${protocol}\nTx: \`${result.txId}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      await ctx.editMessageText(`❌ Withdrawal failed: ${error.message}`);
    }
  });

  bot.callbackQuery('cancel_action', async (ctx) => {
    await ctx.answerCallbackQuery('Action cancelled');
    await ctx.editMessageText('❌ Action cancelled');
  });

  logger.info('Bot handlers configured');
}


export { 
  createWalletConnectKeyboard, 
  createWalletCallbackKeyboard,
  sendWalletConnectionPrompt,
  handleWalletConnection,
  handleWalletAuthCallback,
  isWalletConnected,
  getUserWalletAddress 
} from './wallet.js';