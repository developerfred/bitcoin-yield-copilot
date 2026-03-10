import pino from 'pino';
import { getDatabase } from '../../agent/database.js';
import { walletSessionManager } from '../wallet/session.js';

const logger = pino({ name: 'auth:callback' });


export interface AuthCallbackData {
  telegramId: string;
  walletAddress: string;
  publicKey?: string;
  network: string;
}

/**
 * Process wallet authentication callback
 * Called when user completes wallet connection in Leather
 */
export async function processWalletAuthCallback(
  telegramId: string,
  walletAddress: string,
  publicKey?: string,
  network: string = 'testnet'
): Promise<boolean> {
  try {
    const db = await getDatabase();

    db.updateStacksAddress(telegramId, walletAddress);

    await walletSessionManager.createSession(
      telegramId,
      walletAddress,
      publicKey,
      network
    );

    logger.info({ telegramId, walletAddress, network }, 'Wallet authenticated successfully');
    return true;
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to process wallet auth callback');
    return false;
  }
}

/**
 * Verify wallet session is valid
 */
export async function verifyWalletSession(telegramId: string): Promise<boolean> {
  return walletSessionManager.hasActiveSession(telegramId);
}

/**
 * Get wallet address from session
 */
export async function getWalletAddressFromSession(telegramId: string): Promise<string | null> {
  return walletSessionManager.getWalletAddress(telegramId);
}

/**
 * Disconnect wallet (logout)
 */
export async function disconnectWallet(telegramId: string): Promise<void> {
  await walletSessionManager.disconnect(telegramId);
  
  const db = await getDatabase();
  db.updateStacksAddress(telegramId, '');
  
  logger.info({ telegramId }, 'Wallet disconnected');
}

/**
 * Generate auth response message for Telegram
 */
export function generateAuthSuccessMessage(walletAddress: string): string {
  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  
  return `✅ Wallet Connected!

Address: \`${shortAddress}\`

You can now:
• /yields - Discover yield opportunities
• /portfolio - View your positions
• /deposit - Deposit funds
• /withdraw - Withdraw funds

What would you like to do?`;
}

/**
 * Generate auth error message for Telegram
 */
export function generateAuthErrorMessage(error: string): string {
  return `❌ Wallet Connection Failed

${error}

Please try again with /connect`;
}
