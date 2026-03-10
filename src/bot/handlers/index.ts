/**
 * handlers.ts — Main bot handlers
 *
 * Architecture:
 * 1. auth.middleware() is registered ONCE via bot.use() — it attaches the
 *    session to ctx and always calls next(), so NO command is ever swallowed.
 * 2. Public commands (/start, /help, /test) are declared first and bypass
 *    all session logic inside auth.middleware() via PUBLIC_COMMANDS allowlist.
 * 3. Protected commands use auth.requireOnboarded() as a per-route guard.
 * 4. Module handlers (onboarding, alex, withdraw, protocols) are registered
 *    after the core commands.
 * 5. The AI text handler is last — lowest priority.
 */

import { Bot, Context, InlineKeyboard } from 'grammy';
import { getDatabase } from '../../agent/database.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { mcpClient } from '../../mcp/client.js';
import { ClaudeAgent, Tool, IncomingMessage } from '../../agent/claude.js';
import { getWalletManager } from '../wallet/WalletManager.js';
import { registerOnboardingHandlers } from './onboarding.js';
import { registerAlexHandlers } from './alex.js';
import { registerWithdrawHandler } from './withdraw.js';
import { registerDepositHandlers } from './deposit.js';
import { registerProtocolHandlers } from './protocols.js';
import { syncOnboardingToAuth } from '../../utils/syncOnboardingState.js';

import pino from 'pino';

const logger = pino({ name: 'bot:handlers' });

const STX_DECIMALS = 1_000_000;

const agentTools: Tool[] = [
  {
    name: 'get_yields',
    description: 'Get current yield opportunities from DeFi protocols',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_portfolio',
    description: 'Get user portfolio positions',
    input_schema: { type: 'object', properties: {} },
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

function resolveProtocolAddress(protocolName: string): string {
  const map: Record<string, string | undefined> = {
    zest: process.env.ZEST_CONTRACT,
    alex: process.env.ALEX_CONTRACT,
    hermetica: process.env.HERMETICA_CONTRACT,
    bitflow: process.env.BITFLOW_CONTRACT,
  };
  const addr = map[protocolName.toLowerCase()];
  if (!addr) throw new Error(`Unknown protocol: ${protocolName}`);
  return addr;
}

// ============================================================================
// MAIN SETUP
// ============================================================================

export function setupHandlers(bot: Bot<Context>) {
  logger.info('Setting up handlers...');

  const db = getDatabase();
  const auth = new AuthMiddleware(db);
  const claudeAgent = new ClaudeAgent();

  bot.use(auth.middleware());

  syncOnboardingToAuth().catch(err =>
    logger.error({ err }, 'Failed to sync onboarding state')
  );


  // ── /help ─────────────────────────────────────────────────────────────────
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 *Bitcoin Yield Copilot Help*\n\n` +
      `*Commands:*\n` +
      `/start — Start or restart onboarding\n` +
      `/wallet — View your contract wallet info\n` +
      `/yields — Discover current yield opportunities\n` +
      `/portfolio — View your positions\n` +
      `/alex — Access ALEX DEX (swap, pools, balances)\n` +
      `/alerts — Manage APY alerts\n` +
      `/help — This message\n\n` +
      `*Examples:*\n` +
      `• "Show me yields"\n` +
      `• "Put my sBTC to work"\n` +
      `• "What's my portfolio?"\n` +
      `• "Withdraw from Zest"`,
      { parse_mode: 'Markdown' },
    );
  });

  // ==========================================================================
  // STEP 3 — Module handlers (onboarding registers /start internally)
  // ==========================================================================
  registerOnboardingHandlers(bot);  // registers /start, /wallet, /txs, /setwallet
  registerAlexHandlers(bot);
  registerDepositHandlers(bot);  // registers /withdraw, /deposit
  registerWithdrawHandler(bot);  // registers /setwallet, /removewallet, callbacks
  registerProtocolHandlers(bot);

  // ==========================================================================
  // STEP 4 — Protected commands (require completed onboarding)
  // ==========================================================================

  // ── /yields ───────────────────────────────────────────────────────────────
  bot.command('yields', async (ctx) => {
    await ctx.reply('🔍 Fetching yield opportunities...');
    try {
      const apys = await mcpClient.getProtocolAPYs();
      if (apys.length === 0) {
        return ctx.reply('⚠️ Could not fetch APYs right now. Try again later.');
      }
      let msg = '📈 *Current Yield Opportunities:*\n\n';
      for (const { protocol, apy, token } of apys) {
        const dot = apy > 8 ? '🟢' : apy > 5 ? '🟡' : '🔴';
        msg += `${dot} *${protocol.toUpperCase()}*: ${apy.toFixed(2)}% APY (${token})\n`;
      }
      msg += '\nUse /portfolio to view your positions.';
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch yields');
      await ctx.reply('❌ Failed to fetch yields. Please try again later.');
    }
  });

  // ── /portfolio ────────────────────────────────────────────────────────────
  bot.command(
    'portfolio',
    auth.requireOnboarded(),
    async (ctx) => {
      const telegramId = String(ctx.from?.id);
      try {
        const walletManager = await getWalletManager();
        const user = await db.getUser(telegramId);
        const positions = user ? await db.getUserPositions(user.id) : [];
        const contractAddress = walletManager.getAddress(telegramId);

        let msg = `📊 *Your Portfolio*\n\nContract: \`${contractAddress ?? 'not set'}\`\n\n`;

        if (positions.length === 0) {
          msg += 'No active positions.\n\nUse /yields to discover opportunities!';
        } else {
          let total = 0;
          for (const pos of positions as any[]) {
            msg += `• ${pos.protocol}: ${pos.amount} ${pos.token} @ ${pos.apy}% APY\n`;
            total += pos.amount;
          }
          msg += `\nTotal: ${total} sBTC`;
        }
        await ctx.reply(msg, { parse_mode: 'Markdown' });
      } catch (err) {
        logger.error({ err }, 'Failed to get portfolio');
        await ctx.reply('❌ Failed to fetch portfolio. Please try again later.');
      }
    },
  );

  // ── /alerts ───────────────────────────────────────────────────────────────
  bot.command(
    'alerts',
    auth.requireOnboarded(),
    async (ctx) => {
      const telegramId = String(ctx.from?.id);
      try {
        const user = await db.getUser(telegramId);
        const alerts = user ? await db.getUserAlerts(user.id) : [];

        if (alerts.length === 0) {
          return ctx.reply(
            '📢 No active alerts.\n\nSay "Alert me if Zest drops below 5%" to create one.',
          );
        }

        let msg = '📢 *Your APY Alerts:*\n\n';
        for (const alert of alerts as any[]) {
          msg += `• ${alert.protocol}: below ${alert.threshold}%\n`;
        }
        await ctx.reply(msg, { parse_mode: 'Markdown' });
      } catch (err) {
        logger.error({ err }, 'Failed to get alerts');
        await ctx.reply('❌ Failed to fetch alerts. Please try again later.');
      }
    },
  );

  // ==========================================================================
  // STEP 5 — Callback query handlers
  // ==========================================================================

  async function ensureWalletReady(telegramId: string, ctx: Context): Promise<boolean> {
    try {
      const walletManager = await getWalletManager();
      if (!walletManager.isConnected(telegramId)) {
        await ctx.editMessageText('❌ Wallet contract not found. Use /start to set up.');
        return false;
      }
      return true;
    } catch (err) {
      logger.error({ err }, 'Wallet not ready');
      await ctx.editMessageText(
        '❌ Wallet system is still initializing. Please try again in a few seconds.',
      );
      return false;
    }
  }

  // ── confirm deposit ───────────────────────────────────────────────────────
  bot.callbackQuery(/confirm_deposit_(.+)_(\d+\.?\d*)/, async (ctx) => {
    const [, protocolName, amountStr] = ctx.match;
    const telegramId = String(ctx.from?.id);
    await ctx.answerCallbackQuery('Processing deposit...');

    try {
      const walletManager = await getWalletManager();
      if (!await ensureWalletReady(telegramId, ctx)) return;

      const limits = await walletManager.getRemainingLimits(telegramId);
      const amountMicro = BigInt(Math.floor(parseFloat(amountStr) * STX_DECIMALS));

      if (limits && amountMicro > limits.maxPerTx) {
        return ctx.editMessageText(
          `❌ Amount exceeds per-tx limit (${Number(limits.maxPerTx) / STX_DECIMALS} STX).\nAdjust in /wallet settings.`,
        );
      }
      if (limits && amountMicro > limits.remainingToday) {
        return ctx.editMessageText(
          `❌ Daily limit reached. Remaining: ${Number(limits.remainingToday) / STX_DECIMALS} STX.`,
        );
      }

      await ctx.editMessageText(`⏳ Submitting deposit to ${protocolName}...`);

      const result = await walletManager.executeOperation(
        telegramId,
        resolveProtocolAddress(protocolName),
        'deposit',
        amountMicro,
      );

      const user = await db.getUser(telegramId);
      if (user) {
        await db.createPosition(user.id, protocolName, 'sBTC', parseFloat(amountStr), 0, result.txId);
      }

      await ctx.editMessageText(
        `✅ *Deposit submitted!*\n\n` +
        `Amount: ${amountStr} sBTC\n` +
        `Protocol: ${protocolName}\n` +
        `Tx: \`${result.txId}\`\n\n` +
        `[View on Explorer](${process.env.STACKS_EXPLORER_URL ?? 'https://explorer.stacks.co'}/txid/${result.txId})`,
        { parse_mode: 'Markdown' },
      );
    } catch (err: any) {
      logger.error({ err }, 'Deposit failed');
      await ctx.editMessageText(`❌ Deposit failed: ${err.message}`);
    }
  });

  // ── confirm withdraw ──────────────────────────────────────────────────────
  bot.callbackQuery(/confirm_withdraw_(.+)_(\d+\.?\d*)/, async (ctx) => {
    const [, protocolName, amountStr] = ctx.match;
    const telegramId = String(ctx.from?.id);
    await ctx.answerCallbackQuery('Processing withdrawal...');

    try {
      const walletManager = await getWalletManager();
      if (!await ensureWalletReady(telegramId, ctx)) return;

      await ctx.editMessageText(`⏳ Submitting withdrawal from ${protocolName}...`);

      const amountMicro = BigInt(Math.floor(parseFloat(amountStr) * STX_DECIMALS));
      const result = await walletManager.executeOperation(
        telegramId,
        resolveProtocolAddress(protocolName),
        'withdraw',
        amountMicro,
      );

      await ctx.editMessageText(
        `✅ *Withdrawal submitted!*\n\n` +
        `Amount: ${amountStr} sBTC\n` +
        `Protocol: ${protocolName}\n` +
        `Tx: \`${result.txId}\`\n\n` +
        `[View on Explorer](${process.env.STACKS_EXPLORER_URL ?? 'https://explorer.stacks.co'}/txid/${result.txId})`,
        { parse_mode: 'Markdown' },
      );
    } catch (err: any) {
      logger.error({ err }, 'Withdrawal failed');
      await ctx.editMessageText(`❌ Withdrawal failed: ${err.message}`);
    }
  });

  // ── cancel ────────────────────────────────────────────────────────────────
  bot.callbackQuery('cancel_action', async (ctx) => {
    await ctx.answerCallbackQuery('Action cancelled');
    await ctx.editMessageText('❌ Action cancelled');
  });

  // ==========================================================================
  // STEP 6 — AI free-text handler (lowest priority, last registered)
  // ==========================================================================
  bot.on('message:text', async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const text = ctx.message.text;

    // Commands should have been handled above — ignore leftovers
    if (text.startsWith('/')) return;

    const session = (ctx as any).session ?? (await auth.getSession(telegramId));

    if (!session?.isOnboarded) {
      return ctx.reply('Please complete onboarding first: /start');
    }

    await ctx.reply('🤔 Thinking...');

    try {
      const walletManager = await getWalletManager();
      const user = await db.getUser(telegramId);
      const positions = user ? await db.getUserPositions(user.id) : [];
      const contractAddress = walletManager.getAddress(telegramId);
      const limits = await walletManager.getRemainingLimits(telegramId).catch(() => null);

      const contextMessage =
        `User context:\n` +
        `- Risk profile: ${session.riskProfile || 'not set'}\n` +
        `- Allowed tokens: ${session.allowedTokens?.join(', ') || 'not set'}\n` +
        `- Contract wallet: ${contractAddress ?? 'not deployed'}\n` +
        `- Daily limit remaining: ${limits ? Number(limits.remainingToday) / STX_DECIMALS : '?'} STX\n` +
        `- Current positions: ${positions.length > 0
          ? (positions as any[]).map((p: any) => `${p.protocol}: ${p.amount} ${p.token}`).join(', ')
          : 'none'
        }\n\n` +
        `User message: ${text}`;

      const { response, toolCalls } = await claudeAgent.sendMessage(
        [{ role: 'user', content: contextMessage }],
        agentTools,
      );

      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
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
              const addr = contractAddress ?? (toolCall.input.address as string);
              const balance = await mcpClient.getStacksBalance(addr);
              toolResult = JSON.stringify(balance);
              break;
            }
            case 'deposit': {
              if (!walletManager.isConnected(telegramId)) {
                await ctx.reply('❌ Please complete wallet setup first using /start');
                return;
              }
              const kb = new InlineKeyboard()
                .text('✅ Confirm', `confirm_deposit_${toolCall.input.protocol}_${toolCall.input.amount}`)
                .text('❌ Cancel', 'cancel_action');
              await ctx.reply(
                `📝 *Confirm Deposit*\n\n` +
                `Protocol: ${toolCall.input.protocol}\n` +
                `Token: ${toolCall.input.token}\n` +
                `Amount: ${toolCall.input.amount}\n\n` +
                `This will be executed via your contract wallet.`,
                { parse_mode: 'Markdown', reply_markup: kb },
              );
              return;
            }
            case 'withdraw': {
              if (!walletManager.isConnected(telegramId)) {
                await ctx.reply('❌ Please complete wallet setup first using /start');
                return;
              }
              const kb = new InlineKeyboard()
                .text('✅ Confirm', `confirm_withdraw_${toolCall.input.protocol}_${toolCall.input.amount}`)
                .text('❌ Cancel', 'cancel_action');
              await ctx.reply(
                `📝 *Confirm Withdrawal*\n\n` +
                `Protocol: ${toolCall.input.protocol}\n` +
                `Token: ${toolCall.input.token}\n` +
                `Amount: ${toolCall.input.amount}`,
                { parse_mode: 'Markdown', reply_markup: kb },
              );
              return;
            }
            default:
              toolResult = `Unknown tool: ${toolCall.name}`;
          }

          const continueMessages: IncomingMessage[] = [
            { role: 'user', content: contextMessage },
            { role: 'assistant', content: response || '' },
            { role: 'tool_result', tool_use_id: toolCall.id, content: toolResult },
          ];

          const continueResponse = await claudeAgent.sendMessage(continueMessages, agentTools);
          await ctx.reply(continueResponse.response);
          return;
        }
      }

      await ctx.reply(response);
    } catch (err) {
      logger.error({ err }, 'AI message processing failed');
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  });

  logger.info('Bot handlers configured successfully');
}

// Re-export wallet helpers
export {
  createWalletConnectKeyboard,
  sendWalletConnectionPrompt,
  handleWebAppWalletData,
  handleWalletAuthCallback,
  isWalletConnected,
  getUserWalletAddress,
} from './wallet.js';