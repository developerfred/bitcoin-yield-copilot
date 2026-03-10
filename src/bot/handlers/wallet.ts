import { Context, InlineKeyboard } from 'grammy';
import { AuthMiddleware } from '../middleware/auth.js';
import pino from 'pino';

const logger = pino({ name: 'bot:wallet' });

// URL where your wallet-connect.html is hosted
// Set this in your environment: MINI_APP_URL=https://yourdomain.com/wallet-connect
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://62e8-94-43-63-89.ngrok-free.app/wallet-connect.html';

/**
 * Data received from the Telegram Mini App after wallet connection
 */
export interface WalletConnectData {
  type: 'wallet_connected';
  address: string;
  network: 'mainnet' | 'testnet';
  timestamp: number;
}

/**
 * Validate a Stacks address format
 */
export function validateStacksAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^(SP|SM|ST|SN)[A-HJ-NP-Za-km-z1-9]{38,50}$/.test(address.trim());
}

/**
 * Detect network from Stacks address prefix
 */
export function detectNetworkFromAddress(address: string): 'mainnet' | 'testnet' | null {
  if (address.startsWith('SP') || address.startsWith('SM')) return 'mainnet';
  if (address.startsWith('ST') || address.startsWith('SN')) return 'testnet';
  return null;
}

/**
 * Check if user has a wallet connected
 */
export function isWalletConnected(session: any): boolean {
  return !!(session?.isOnboarded && session?.stacksAddress);
}

/**
 * Get user wallet address from session
 */
export function getUserWalletAddress(session: any): string | null {
  return session?.stacksAddress || null;
}

/**
 * Create the inline keyboard with Mini App button for wallet connection
 */
export function createWalletConnectKeyboard(network: string = 'mainnet'): InlineKeyboard {
  const url = `${MINI_APP_URL}?network=${network}`;

  return new InlineKeyboard()
    .webApp('🔗 Connect Wallet', url);
}

/**
 * Send the wallet connection prompt to the user
 */
export async function sendWalletConnectionPrompt(ctx: Context, session: any): Promise<void> {
  const network = process.env.STACKS_NETWORK || 'mainnet';
  const keyboard = createWalletConnectKeyboard(network);

  await ctx.reply(
    `🔗 *Connect Your Stacks Wallet*\n\n` +
    `Tap the button below to connect your wallet.\n\n` +
    `Supported wallets:\n` +
    `• Leather\n` +
    `• Xverse\n` +
    `• Or paste your address manually\n\n` +
    `Network: \`${network}\``,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

/**
 * Handle wallet data received from Telegram Mini App (web_app_data event)
 * This is called when the user submits data via tg.sendData() in the Mini App
 */
export async function handleWebAppWalletData(ctx: Context, auth: AuthMiddleware): Promise<void> {
  const telegramId = String(ctx.from?.id);
  const rawData = ctx.message?.web_app_data?.data;

  if (!rawData) {
    logger.warn({ telegramId }, 'Received empty web_app_data');
    await ctx.reply('❌ No wallet data received. Please try again.');
    return;
  }

  let walletData: WalletConnectData;

  try {
    walletData = JSON.parse(rawData);
  } catch (e) {
    logger.error({ telegramId, rawData }, 'Failed to parse wallet data');
    await ctx.reply('❌ Invalid wallet data. Please try connecting again.');
    return;
  }

  // Validate the data
  if (walletData.type !== 'wallet_connected') {
    logger.warn({ telegramId, type: walletData.type }, 'Unexpected web_app_data type');
    await ctx.reply('❌ Unexpected data type. Please try again.');
    return;
  }

  if (!validateStacksAddress(walletData.address)) {
    logger.warn({ telegramId, address: walletData.address }, 'Invalid address from Mini App');
    await ctx.reply('❌ Invalid Stacks address. Please try connecting again.');
    return;
  }

  const address = walletData.address.trim();

  logger.info({ telegramId, address, network: walletData.network }, 'Wallet connected via Mini App');

  try {
    // Complete onboarding or just update wallet
    const session = await auth.getSession(telegramId);

    if (session?.step === 'awaiting_wallet' || !session?.isOnboarded) {
      // Part of onboarding flow
      await auth.completeOnboarding(telegramId, address);

      await ctx.reply(
        `🎉 *Wallet Connected!*\n\n` +
        `Address: \`${address}\`\n` +
        `Network: ${walletData.network}\n\n` +
        `You're all set! Here's what you can do:\n` +
        `• /yields — Discover yield opportunities\n` +
        `• /portfolio — View your positions\n` +
        `• /help — Get help\n\n` +
        `What would you like to do with your Bitcoin? 🚀`,
        { parse_mode: 'Markdown' }
      );
    } else {
      // Updating existing wallet
      await auth.updateWalletAddress(telegramId, address);

      await ctx.reply(
        `✅ *Wallet Updated*\n\n` +
        `New address: \`${address}\`\n` +
        `Network: ${walletData.network}`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to save wallet address');
    await ctx.reply('❌ Failed to save wallet. Please try again.');
  }
}

/**
 * Handle wallet auth callback (for OAuth-style flows)
 */
export async function handleWalletAuthCallback(ctx: Context, auth: AuthMiddleware): Promise<void> {
  const telegramId = String(ctx.from?.id);

  // Extract address from callback query data
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('wallet_auth_')) return;

  const address = data.replace('wallet_auth_', '');

  if (!validateStacksAddress(address)) {
    await ctx.answerCallbackQuery('Invalid wallet address');
    return;
  }

  try {
    await auth.completeOnboarding(telegramId, address);
    await ctx.answerCallbackQuery('Wallet connected!');
    await ctx.editMessageText(
      `✅ Wallet connected: \`${address}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error({ error }, 'Failed to handle wallet auth callback');
    await ctx.answerCallbackQuery('Failed to connect wallet');
  }
}