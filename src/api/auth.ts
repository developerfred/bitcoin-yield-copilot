import pino from 'pino';
import { 
  processWalletAuthCallback, 
  generateAuthSuccessMessage, 
  generateAuthErrorMessage 
} from '../bot/auth/callback.js';
import { config } from '../config.js';

const logger = pino({ name: 'api:auth' });


export interface AuthCallbackRequest {
  telegramId: string;
  walletAddress: string;
  publicKey?: string;
  network?: string;
}

export interface AuthCallbackResponse {
  success: boolean;
  message: string;
  data?: {
    walletAddress: string;
  };
}

/**
 * Handle auth callback from wallet connection
 * This is called when the user completes wallet authentication
 */
export async function handleAuthCallback(request: AuthCallbackRequest): Promise<AuthCallbackResponse> {
  const { telegramId, walletAddress, publicKey, network } = request;

  logger.info({ telegramId, walletAddress, network }, 'Processing auth callback');

  // Validate required fields
  if (!telegramId || !walletAddress) {
    return {
      success: false,
      message: 'Missing required fields: telegramId and walletAddress',
    };
  }

  // Validate Stacks address format
  const validAddress = /^(SP|SM|SZ)[A-HJ-NP-Za-km-z1-9]{38,50}$/.test(walletAddress);
  if (!validAddress) {
    return {
      success: false,
      message: 'Invalid Stacks address format',
    };
  }

  // Process the authentication
  const success = await processWalletAuthCallback(
    telegramId,
    walletAddress,
    publicKey,
    network || config.stacks.network
  );

  if (!success) {
    return {
      success: false,
      message: 'Failed to process wallet authentication',
    };
  }

  return {
    success: true,
    message: 'Wallet connected successfully',
    data: {
      walletAddress,
    },
  };
}

/**
 * Handle disconnect wallet request
 */
export async function handleDisconnectWallet(telegramId: string): Promise<AuthCallbackResponse> {
  if (!telegramId) {
    return {
      success: false,
      message: 'Missing telegramId',
    };
  }

  const { disconnectWallet } = await import('../bot/auth/callback.js');
  await disconnectWallet(telegramId);

  return {
    success: true,
    message: 'Wallet disconnected successfully',
  };
}

/**
 * Check wallet connection status
 */
export async function handleCheckConnection(telegramId: string): Promise<AuthCallbackResponse> {
  if (!telegramId) {
    return {
      success: false,
      message: 'Missing telegramId',
    };
  }

  const { getWalletAddressFromSession, verifyWalletSession } = await import('../bot/auth/callback.js');
  
  const isValid = await verifyWalletSession(telegramId);
  const walletAddress = await getWalletAddressFromSession(telegramId);

  if (!isValid || !walletAddress) {
    return {
      success: false,
      message: 'No active wallet session',
    };
  }

  return {
    success: true,
    message: 'Wallet is connected',
    data: {
      walletAddress,
    },
  };
}

/**
 * Express-style route handler for auth callback
 * Can be used with any HTTP server (Express, Fastify, etc.)
 */
export function createAuthCallbackRoute(req: any, res: any): void {
  const { telegramId, walletAddress, publicKey, network } = req.body || req.query;

  handleAuthCallback({ telegramId, walletAddress, publicKey, network })
    .then((response) => {
      if (response.success) {
        // Redirect to success page or send success message
        const message = generateAuthSuccessMessage(walletAddress);
        res.json({ ...response, message });
      } else {
        const message = generateAuthErrorMessage(response.message);
        res.status(400).json({ ...response, message });
      }
    })
    .catch((error) => {
      logger.error({ error }, 'Auth callback error');
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    });
}
