import { InlineKeyboard } from 'grammy';
import { createWalletManager } from '../../wallet/index.js';
import { config } from '../../config.js';
import { AuthMiddleware, UserSession } from './auth.js';
import { getDatabase } from '../../agent/database.js';
import { createLogger } from 'pino';

const logger = createLogger({ name: 'bot:handlers:wallet' });

/**
 * Generate wallet connection URL for a user
 */
function generateWalletAuthUrl(telegramId: string): string {
  const walletManager = createWalletManager();
  const baseUrl = `${config.wallet.appDomain}/auth`;
  
  // Generate auth request and create URL with state
  const state = Buffer.from(JSON.stringify({ 
    telegramId, 
    callback: '/auth/callback' 
  })).toString('base64');
  
  const authUrl = walletManager.generateAuthUrl(config.wallet.appDomain, config.wallet.appName);
  
  // Return full URL with state parameter
  return `${authUrl}&state=${state}`;
}

/**
 * Create inline keyboard with wallet connection button
 */
export function createWalletConnectKeyboard(telegramId: string): InlineKeyboard {
  const authUrl = generateWalletAuthUrl(telegramId);
  
  return new InlineKeyboard()
    .webApp('🔗 Connect Wallet', authUrl);
}

/**
 * Create inline keyboard with just the callback button (for inline mode)
 */
export function createWalletCallbackKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔗 Connect Wallet', 'connect_wallet');
}

/**
 * Send wallet connection message
 */
export async function sendWalletConnectionPrompt(
  ctx: any,
  session: UserSession
): Promise<void> {
  const keyboard = createWalletConnectKeyboard(session.telegramId);
  
  await ctx.reply(
    `🔐 Connect Your Wallet\n\nTo get started, please connect your Stacks wallet.\n\nThis will allow me to:\n• View your balance\n• Prepare transactions\n• Execute deposits and withdrawals\n\nClick the button below to connect:`,
    { reply_markup: keyboard }
  );
}

/**
 * Handle wallet connection callback
 */
export async function handleWalletConnection(ctx: any, authMiddleware: AuthMiddleware): Promise<void> {
  const telegramId = String(ctx.from?.id);
  
  await ctx.answerCallbackQuery('Opening wallet connection...');
  
  const session = await authMiddleware.getSession(telegramId);
  if (!session) {
    await ctx.editMessageText('❌ Please start with /start first');
    return;
  }
  
  const keyboard = createWalletConnectKeyboard(telegramId);
  
  await ctx.editMessageText(
    `🔗 Click the button below to connect your Leather Wallet:\n\n${generateWalletAuthUrl(telegramId)}`,
    { reply_markup: keyboard }
  );
}

/**
 * Handle wallet authentication callback (from web app)
 */
export async function handleWalletAuthCallback(
  telegramId: string,
  walletAddress: string,
  publicKey?: string
): Promise<boolean> {
  try {
    const db = getDatabase();
    
    // Update user's wallet address
    await db.updateStacksAddress(telegramId, walletAddress);
    
    // Get or create session
    let session = await db.getUser(telegramId);
    
    if (!session) {
      await db.createUser(telegramId);
      await db.updateStacksAddress(telegramId, walletAddress);
      await db.completeOnboarding(telegramId);
    }
    
    logger.info({ telegramId, walletAddress }, 'Wallet connected successfully');
    return true;
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to handle wallet auth callback');
    return false;
  }
}

/**
 * Check if user has wallet connected
 */
export async function isWalletConnected(telegramId: string): Promise<boolean> {
  const db = getDatabase();
  const user = await db.getUser(telegramId);
  
  return !!user?.stacks_address;
}

/**
 * Get user's wallet address
 */
export async function getUserWalletAddress(telegramId: string): Promise<string | null> {
  const db = getDatabase();
  const user = await db.getUser(telegramId);
  
  return user?.stacks_address ?? null;
}
