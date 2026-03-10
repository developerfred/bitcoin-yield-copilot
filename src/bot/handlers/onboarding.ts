/**
 * onboarding.ts - Bitcoin Yield Copilot Onboarding Flow
 * 
 * Complete onboarding flow management:
 * - Risk profile selection
 * - Token selection
 * - Contract wallet deployment
 * - Withdrawal address management
 * - Balance queries via Hiro API
 */

import { Bot, Context, Keyboard } from 'grammy';
import { 
  getWalletManager, 
  WalletLimits, 
  ProtocolConfig, 
  validateStacksAddress 
} from '../wallet/WalletManager.js';
import Database from 'better-sqlite3';
import { API_CONFIG } from '../config/apis.js';
import { getDatabase } from '../../agent/database.js';
import { AuthMiddleware } from '../middleware/auth.js';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const MAX_DEPLOY_ATTEMPTS = 3;
const STX_DECIMALS = 1_000_000;
const EXPLORER_URL = process.env.STACKS_EXPLORER_URL ?? 'https://explorer.stacks.co';

const RISK_PRESETS = {
  conservative: {
    label: 'Conservative',
    emoji: '🟢',
    maxPerTransaction: 500_000n,
    dailyLimit: 2_000_000n,
  },
  moderate: {
    label: 'Moderate',
    emoji: '🟡',
    maxPerTransaction: 5_000_000n,
    dailyLimit: 20_000_000n,
  },
  aggressive: {
    label: 'Aggressive',
    emoji: '🔴',
    maxPerTransaction: 50_000_000n,
    dailyLimit: 200_000_000n,
  },
} as const;

const TOKEN_CHOICES = {
  'Only sBTC': ['sBTC'],
  'sBTC + STX': ['sBTC', 'STX'],
  'All tokens': ['sBTC', 'STX', 'USDCx'],
} as const;

const TOKEN_SYMBOLS: Record<string, string> = {
  'SP1P712A95CRHVZEQ8E4EPXJJNN41P3MAB0RPBATS.token-t-alex': 'ALEX',
  'SP1P712A95CRHVZEQ8E4EPXJJNN41P3MAB0RPBATS.token-t-usda': 'USDA',
  'SP1P712A95CRHVZEQ8E4EPXJJNN41P3MAB0RPBATS.token-sbtc': 'sBTC',
};

// ============================================================================
// HUMAN-READABLE NUMBER FORMATTING
// ============================================================================

/**
 * Format numbers for humans:
 * - < 0.000001 → "<0.000001"
 * - < 0.01 → up to 6 significant decimal places
 * - < 1 → up to 4 decimal places
 * - < 1000 → up to 2 decimal places
 * - >= 1000 → with thousand separators
 */
function formatHumanNumber(value: number): string {
  if (value === 0) return '0';
  
  // Very small values
  if (value < 0.000001) {
    return '<0.000001';
  }
  
  // Small values (less than 1 cent)
  if (value < 0.01) {
    return value.toFixed(6);
  }
  
  // Small values (less than 1)
  if (value < 1) {
    return value.toFixed(4);
  }
  
  // Medium values (less than 1000)
  if (value < 1000) {
    return value.toFixed(2);
  }
  
  // Large values (>= 1000) - add thousand separators
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata valores monetários em STX de forma amigável
 */
function formatSTX(amount: number): string {
  if (amount === 0) return '0 STX';
  
  // Valores muito pequenos
  if (amount < 0.000001) {
    return '<0.000001 STX';
  }
  
  // Valores pequenos
  if (amount < 0.01) {
    return `${amount.toFixed(6)} STX`;
  }
  
  // Valores normais
  if (amount < 1000) {
    return `${amount.toFixed(4)} STX`;
  }
  
  // Valores grandes
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} STX`;
}

/**
 * Formata limites (bigint) de forma amigável
 */
function formatLimit(amount: bigint): string {
  const value = Number(amount) / STX_DECIMALS;
  return formatSTX(value);
}

/**
 * Formata porcentagens de forma amigável
 */
function formatPercentage(value: number): string {
  if (value < 0.01) return '<0.01%';
  if (value < 1) return value.toFixed(2) + '%';
  return Math.round(value) + '%';
}

// ============================================================================
// TYPES
// ============================================================================

type RiskProfile = keyof typeof RISK_PRESETS;
type OnboardingStep = 'risk' | 'tokens' | 'deploying' | 'done';

interface OnboardingState {
  step: OnboardingStep;
  riskProfile?: RiskProfile;
  allowedTokens?: string[];
  contractAddress?: string;
  deployAttempts?: number;
  lastError?: string;
}

interface TokenBalance {
  symbol: string;
  balance: number;
  value?: number; // Valor em USD (opcional)
}

interface ContractInfo {
  deploy_block_time: number;
  tx_count: number;
}

// ============================================================================
// DATABASE LAYER
// ============================================================================

class OnboardingDatabase {
  private static instance: Database.Database | null = null;

  static getInstance(): Database.Database {
    if (!this.instance) {
      const dbPath = process.env.DB_PATH ?? './data/copilot.db';
      console.log(`[Onboarding] Initializing database at ${dbPath}`);
      
      this.instance = new Database(dbPath);
      this.instance.exec('PRAGMA foreign_keys = ON;');
      this.initializeTables();
      this.runMigrations();
    }
    return this.instance;
  }

  private static initializeTables(): void {
    if (!this.instance) return;
    
    this.instance.exec(`
      CREATE TABLE IF NOT EXISTS onboarding_state (
        telegram_id      TEXT PRIMARY KEY,
        step             TEXT NOT NULL DEFAULT 'risk',
        risk_profile     TEXT,
        allowed_tokens   TEXT,
        contract_address TEXT,
        deploy_attempts  INTEGER DEFAULT 0,
        last_error       TEXT,
        updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS withdrawal_addresses (
        telegram_id    TEXT PRIMARY KEY,
        stacks_address TEXT NOT NULL,
        updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
    
    console.log('[Onboarding] Database tables initialized');
  }

  private static runMigrations(): void {
    if (!this.instance) return;
    
    try {
      const tableInfo = this.instance.prepare('PRAGMA table_info(onboarding_state)').all() as any[];
      const columns = tableInfo.map(col => col.name);

      if (!columns.includes('deploy_attempts')) {
        console.log('[Onboarding] Adding deploy_attempts column');
        this.instance.exec('ALTER TABLE onboarding_state ADD COLUMN deploy_attempts INTEGER DEFAULT 0');
      }

      if (!columns.includes('last_error')) {
        console.log('[Onboarding] Adding last_error column');
        this.instance.exec('ALTER TABLE onboarding_state ADD COLUMN last_error TEXT');
      }
    } catch (error) {
      console.error('[Onboarding] Migration error:', error);
    }
  }

  static loadState(telegramId: number): OnboardingState | null {
    try {
      const db = this.getInstance();
      const row = db
        .prepare('SELECT * FROM onboarding_state WHERE telegram_id = ?')
        .get(String(telegramId)) as any;

      if (!row) return null;

      return {
        step: row.step,
        riskProfile: row.risk_profile ?? undefined,
        allowedTokens: row.allowed_tokens ? JSON.parse(row.allowed_tokens) : undefined,
        contractAddress: row.contract_address ?? undefined,
        deployAttempts: row.deploy_attempts ?? 0,
        lastError: row.last_error ?? undefined,
      };
    } catch (error) {
      console.error('[Onboarding] Error loading state:', error);
      return null;
    }
  }

  static saveState(telegramId: number, state: OnboardingState): void {
    try {
      const db = this.getInstance();
      db
        .prepare(`
          INSERT INTO onboarding_state
            (telegram_id, step, risk_profile, allowed_tokens, contract_address, deploy_attempts, last_error, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
          ON CONFLICT(telegram_id) DO UPDATE SET
            step = excluded.step,
            risk_profile = excluded.risk_profile,
            allowed_tokens = excluded.allowed_tokens,
            contract_address = excluded.contract_address,
            deploy_attempts = excluded.deploy_attempts,
            last_error = excluded.last_error,
            updated_at = unixepoch()
        `)
        .run(
          String(telegramId),
          state.step,
          state.riskProfile ?? null,
          state.allowedTokens ? JSON.stringify(state.allowedTokens) : null,
          state.contractAddress ?? null,
          state.deployAttempts ?? 0,
          state.lastError ?? null,
        );
    } catch (error) {
      console.error('[Onboarding] Error saving state:', error);
      throw error;
    }
  }

  static loadWithdrawalAddress(telegramId: number): string | null {
    try {
      const db = this.getInstance();
      const row = db
        .prepare('SELECT stacks_address FROM withdrawal_addresses WHERE telegram_id = ?')
        .get(String(telegramId)) as any;
      return row?.stacks_address ?? null;
    } catch (error) {
      console.error('[Onboarding] Error loading withdrawal address:', error);
      return null;
    }
  }

  static saveWithdrawalAddress(telegramId: number, address: string): void {
    try {
      const db = this.getInstance();
      db
        .prepare(`
          INSERT INTO withdrawal_addresses (telegram_id, stacks_address, updated_at)
          VALUES (?, ?, unixepoch())
          ON CONFLICT(telegram_id) DO UPDATE SET
            stacks_address = excluded.stacks_address,
            updated_at = unixepoch()
        `)
        .run(String(telegramId), address);
    } catch (error) {
      console.error('[Onboarding] Error saving withdrawal address:', error);
      throw error;
    }
  }

  static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }
}

// ============================================================================
// HIRO API SERVICE
// ============================================================================

class HiroService {
  static async getStxBalance(contractPrincipal: string, network: 'mainnet' | 'testnet'): Promise<number | null> {
    try {
      const response = await fetch(
        `${API_CONFIG[network].hiroApi}/extended/v1/address/${contractPrincipal}/balances`
      );

      if (!response.ok) {
        console.error(`[Hiro] API returned ${response.status}`);
        return null;
      }

      const data = await response.json() as { stx: { balance: string } };
      const balance = BigInt(data.stx?.balance || '0');
      return Number(balance) / STX_DECIMALS;
    } catch (error) {
      console.error('[Hiro] Error fetching STX balance:', error);
      return null;
    }
  }

  static async getTokenBalances(contractPrincipal: string, network: 'mainnet' | 'testnet'): Promise<TokenBalance[]> {
    try {
      const response = await fetch(
        `${API_CONFIG[network].hiroApi}/extended/v1/address/${contractPrincipal}/balances`
      );

      if (!response.ok) return [];

      const data = await response.json() as { fungible_tokens: Record<string, { balance: string }> };
      const tokens: TokenBalance[] = [];

      for (const [contractId, tokenData] of Object.entries(data.fungible_tokens || {})) {
        const balance = BigInt(tokenData.balance);
        if (balance > 0) {
          tokens.push({
            symbol: TOKEN_SYMBOLS[contractId] || contractId.split('.')[1],
            balance: Number(balance) / STX_DECIMALS,
          });
        }
      }

      return tokens;
    } catch (error) {
      console.error('[Hiro] Error fetching token balances:', error);
      return [];
    }
  }

  static async getContractInfo(contractPrincipal: string, network: 'mainnet' | 'testnet'): Promise<ContractInfo | null> {
    try {
      const response = await fetch(
        `${API_CONFIG[network].hiroApi}/extended/v1/contract/${contractPrincipal}`
      );

      if (!response.ok) return null;

      const data = await response.json() as { deploy_block_time: number; tx_count: string };
      return {
        deploy_block_time: data.deploy_block_time,
        tx_count: parseInt(data.tx_count || '0'),
      };
    } catch (error) {
      console.error('[Hiro] Error fetching contract info:', error);
      return null;
    }
  }

  static async getRecentTransactions(contractPrincipal: string, network: 'mainnet' | 'testnet', limit = 5): Promise<string> {
    try {
      const response = await fetch(
        `${API_CONFIG[network].hiroApi}/extended/v1/address/${contractPrincipal}/transactions?limit=${limit}`
      );

      if (!response.ok) return 'Error fetching transactions.';

      const data = await response.json() as { results: any[] };
      
      if (data.results.length === 0) return 'No recent transactions.';

      return data.results
        .map(tx => {
          const date = new Date(tx.burn_block_time * 1000).toLocaleString('pt-BR');
          let amount = '';
          
          if (tx.stx_transfer?.amount) {
            const stxAmount = Number(tx.stx_transfer.amount) / STX_DECIMALS;
            amount = ` — ${formatSTX(stxAmount)}`;
          } else if (tx.fee_rate) {
            const feeAmount = Number(tx.fee_rate) / STX_DECIMALS;
            amount = ` (fee: ${formatSTX(feeAmount)})`;
          }
          
          const txType = tx.tx_type === 'contract_call' ? '📝' : '💸';
          
          return `• ${txType} ${tx.tx_type}${amount}\n  ${date}\n  [View](${API_CONFIG[network].hiroApi}/txid/${tx.tx_id})`;
        })
        .join('\n\n');
    } catch (error) {
      console.error('[Hiro] Error fetching transactions:', error);
      return 'Error fetching transactions.';
    }
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function buildProtocols(): ProtocolConfig[] {
  return [
    { address: process.env.ZEST_CONTRACT!, name: 'Zest', maxAlloc: 100_000_000n },
    { address: process.env.ALEX_CONTRACT!, name: 'ALEX', maxAlloc: 100_000_000n },
  ].filter(p => !!p.address);
}

// ============================================================================
// KEYBOARDS
// ============================================================================

const riskKeyboard = new Keyboard()
  .text('🟢 Conservative').row()
  .text('🟡 Moderate').row()
  .text('🔴 Aggressive')
  .oneTime()
  .resized();

const tokensKeyboard = new Keyboard()
  .text('Only sBTC').row()
  .text('sBTC + STX').row()
  .text('All tokens')
  .oneTime()
  .resized();

// ============================================================================
// DEPLOYMENT FLOW
// ============================================================================

async function deployContractWallet(
  ctx: Context,
  telegramId: number,
  state: OnboardingState,
): Promise<void> {
  const chatId = ctx.chat!.id;
  const attempts = (state.deployAttempts || 0) + 1;

  const updateProgress = async (messageId: number, text: string) => {
    await ctx.api.editMessageText(chatId, messageId, text, { parse_mode: 'Markdown' }).catch(() => {});
  };

  try {
    OnboardingDatabase.saveState(telegramId, { ...state, step: 'deploying', deployAttempts: attempts });

    const progressMsg = await ctx.api.sendMessage(
      chatId,
      `⚙️ *Creating your contract wallet…*\n\n` +
      `◻️ Step 1 — Preparing deployment\n` +
      `◻️ Step 2 — Deploying contract\n` +
      `◻️ Step 3 — Configuring limits\n` +
      `◻️ Step 4 — Registering on-chain\n\n` +
      `_This takes about 30–60 seconds._${attempts > 1 ? `\n\n_Attempt ${attempts} of ${MAX_DEPLOY_ATTEMPTS}_` : ''}`,
      { parse_mode: 'Markdown' },
    );

    const walletManager = await getWalletManager();
    const limits = RISK_PRESETS[state.riskProfile!];
    const protocols = buildProtocols();

    if (protocols.length === 0) {
      throw new Error('No DeFi protocols configured. Please check environment variables.');
    }

    await updateProgress(progressMsg.message_id,
      `⚙️ *Creating your contract wallet…*\n\n` +
      `✅ Step 1 — Preparation complete\n` +
      `🔄 Step 2 — Deploying contract to Stacks…\n` +
      `◻️ Step 3 — Configuring limits\n` +
      `◻️ Step 4 — Registering on-chain`
    );

    const walletRecord = await walletManager.createContractWallet(
      String(telegramId),
      { maxPerTransaction: limits.maxPerTransaction, dailyLimit: limits.dailyLimit },
      protocols,
    );

    try {
      const db = getDatabase();
      const auth = new AuthMiddleware(db);
      await auth.completeOnboarding(String(telegramId), walletRecord.contractAddress);
      console.log(`[Onboarding] User ${telegramId} marked as onboarded in auth system`);
    } catch (authErr) {      
      console.error('[Onboarding] Failed to sync auth state:', authErr);
    }

    await updateProgress(progressMsg.message_id,
      `⚙️ *Creating your contract wallet…*\n\n` +
      `✅ Step 1 — Preparation complete\n` +
      `✅ Step 2 — Contract deployed\n` +
      `✅ Step 3 — Limits configured\n` +
      `✅ Step 4 — Registration complete`
    );

    OnboardingDatabase.saveState(telegramId, {
      ...state,
      step: 'done',
      contractAddress: walletRecord.contractAddress,
      deployAttempts: attempts,
      lastError: undefined,
    });

    await ctx.api.sendMessage(
      chatId,
      `🎉 *Your Bitcoin Yield Copilot is ready!*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Deposit address (your contract wallet):*\n` +
      `\`${walletRecord.contractAddress}\`\n\n` +
      `Send sBTC or STX to this address to start earning.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*Spending limits:*\n` +
      `• Per transaction: ${formatLimit(limits.maxPerTransaction)}\n` +
      `• Daily: ${formatLimit(limits.dailyLimit)}\n\n` +
      `*What's next:*\n` +
      `1️⃣ Deposit sBTC/STX to the address above\n` +
      `2️⃣ Use /yields to discover earning opportunities\n` +
      `3️⃣ Use /setwallet to set a withdrawal address when ready to cash out\n\n` +
      `🔍 [View on Explorer](${EXPLORER_URL}/address/${walletRecord.contractAddress})`,
      { parse_mode: 'Markdown' },
    );
  } catch (err: any) {
    console.error('[Onboarding] Deploy failed:', err);

    OnboardingDatabase.saveState(telegramId, {
      ...state,
      step: 'tokens',
      deployAttempts: attempts,
      lastError: err.message,
    });

    const errorMessage = err.message.includes('timeout')
      ? 'The transaction is taking longer than expected.'
      : err.message.includes('broadcast')
      ? 'Network error while broadcasting the transaction.'
      : 'An unexpected error occurred.';

    await ctx.api.sendMessage(
      chatId,
      `❌ *Wallet creation failed*\n\n${errorMessage}\n\n` +
      `Your settings have been saved. Use /start to try again.` +
      (attempts < MAX_DEPLOY_ATTEMPTS ? `\n\n_Attempt ${attempts} of ${MAX_DEPLOY_ATTEMPTS}_` : ''),
      { parse_mode: 'Markdown' },
    );
  }
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

export function registerOnboardingHandlers(bot: Bot<Context>) {
  
  // --------------------------------------------------------------------------
  // /start - Inicia o fluxo de onboarding
  // --------------------------------------------------------------------------
  bot.command('start', async (ctx) => {
    console.log('[DEBUG /start] ========== HANDLER CALLED ==========');
    const userId = ctx.from!.id;
    console.log('[DEBUG /start] Received from user:', userId);

    try {
      console.log('[DEBUG /start] Getting wallet manager...');
      const walletManager = await getWalletManager();
      console.log('[DEBUG /start] Wallet manager ready, checking wallet...');
      const existing = walletManager.getCachedWallet(String(userId));
      console.log('[DEBUG /start] Existing wallet:', existing);

      if (existing?.isActive) {
        const withdrawal = OnboardingDatabase.loadWithdrawalAddress(userId);
        const info = await walletManager.getWalletInfo(String(userId)).catch(() => null);
        const remaining = info ? Number(info['remaining-today']) / STX_DECIMALS : 0;

        return ctx.reply(
          `👋 *Welcome back!*\n\n` +
          `📋 *Contract wallet:*\n\`${existing.contractAddress}\`\n` +
          `Network: ${existing.network} · 💰 Available today: ${formatSTX(remaining)}\n\n` +
          `💸 *Withdrawal address:* ${withdrawal ? `\`${withdrawal}\`` : '_not set — use /setwallet_'}\n\n` +
          `Use /yields to earn · /portfolio to review · /wallet for full details.`,
          { parse_mode: 'Markdown' },
        );
      }

      const state = OnboardingDatabase.loadState(userId);

      if (state?.step === 'deploying') {
        return ctx.reply(
          `⏳ Your wallet is still being deployed (up to 60 s).\n\n` +
          `If it seems stuck, send /start again to retry.` +
          (state.deployAttempts ? `\n\n_Attempt ${state.deployAttempts} of ${MAX_DEPLOY_ATTEMPTS}_` : ''),
          { parse_mode: 'Markdown' },
        );
      }

      if (state?.step === 'tokens' && state.riskProfile && state.allowedTokens) {
        const preset = RISK_PRESETS[state.riskProfile];
        const message = 
          `🔄 *Resuming deployment*\n\n` +
          `Your previous settings:\n` +
          `• Risk: ${preset.emoji} ${preset.label}\n` +
          `• Tokens: ${state.allowedTokens.join(', ')}\n\n` +
          (state.lastError ? `⚠️ Previous error: ${state.lastError}\n\n` : '') +
          `Starting deployment now…`;

        await ctx.reply(message, { parse_mode: 'Markdown' });
        deployContractWallet(ctx, userId, state).catch(err => 
          console.error('[Onboarding] Retry deploy error:', err)
        );
        return;
      }

      OnboardingDatabase.saveState(userId, { step: 'risk' });
      await ctx.reply(
        `👋 *Welcome to Bitcoin Yield Copilot!*\n\n` +
        `I autonomously put your Bitcoin to work across the Stacks DeFi ecosystem.\n\n` +
        `*How it works:*\n` +
        `• I deploy a personal smart contract wallet for you on Stacks\n` +
        `• You deposit sBTC or STX directly to that address\n` +
        `• I manage yield strategies within your spending limits\n` +
        `• Set a withdrawal address anytime via /setwallet\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Step 1 of 2 — Choose your risk profile:*`,
        { parse_mode: 'Markdown', reply_markup: riskKeyboard },
      );
    } catch (error: any) {
      console.error('[Onboarding] Error in /start:', error);
      await ctx.reply(
        `❌ *System initialization error*\n\n` +
        `The wallet system is still starting up. Please try again in a few seconds.`,
        { parse_mode: 'Markdown' },
      );
    }
  });

  // --------------------------------------------------------------------------
  // Risk Profile Selection
  // --------------------------------------------------------------------------
  for (const [key, preset] of Object.entries(RISK_PRESETS)) {
    bot.hears(`${preset.emoji} ${preset.label}`, async (ctx) => {
      const userId = ctx.from!.id;
      const state = OnboardingDatabase.loadState(userId);
      if (!state || state.step !== 'risk') return next();

      OnboardingDatabase.saveState(userId, {
        ...state,
        riskProfile: key as RiskProfile,
        step: 'tokens',
      });

      const limits = RISK_PRESETS[key as RiskProfile];
      await ctx.reply(
        `✅ *${preset.emoji} ${preset.label}* selected\n\n` +
        `Your contract wallet will enforce these limits:\n` +
        `• Per transaction: *${formatLimit(limits.maxPerTransaction)}*\n` +
        `• Daily total: *${formatLimit(limits.dailyLimit)}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Step 2 of 2 — Which tokens should I manage?*`,
        { parse_mode: 'Markdown', reply_markup: tokensKeyboard },
      );
    });
  }

  // --------------------------------------------------------------------------
  // Token Selection
  // --------------------------------------------------------------------------
  for (const [label, tokens] of Object.entries(TOKEN_CHOICES)) {
    bot.hears(label, async (ctx) => {
      const userId = ctx.from!.id;
      const state = OnboardingDatabase.loadState(userId);
      if (!state || state.step !== 'tokens') return next();

      const deployingState: OnboardingState = {
        ...state,
        allowedTokens: [...tokens],
        step: 'deploying',
        deployAttempts: 0,
        lastError: undefined,
      };

      OnboardingDatabase.saveState(userId, deployingState);

      await ctx.reply(
        `✅ Tokens: *${tokens.join(', ')}*\n\nAll set! Deploying your contract wallet now…`,
        { parse_mode: 'Markdown' },
      );

      deployContractWallet(ctx, userId, deployingState).catch(err =>
        console.error('[Onboarding] Deploy error:', err)
      );
    });
  }

  // --------------------------------------------------------------------------
  // /wallet - Exibe informações da wallet
  // --------------------------------------------------------------------------
  bot.command('wallet', async (ctx) => {
    const userId = ctx.from!.id;

    try {
      OnboardingDatabase.getInstance();
      
      const walletManager = await getWalletManager();
      const record = walletManager.getCachedWallet(String(userId));

      if (!record) {
        const state = OnboardingDatabase.loadState(userId);
        let hint = 'No wallet found. Use /start to create one.';

        if (state?.step === 'deploying') {
          hint = '⏳ Your wallet is still being deployed. Please wait a moment.';
        } else if (state?.step === 'tokens' && state.riskProfile) {
          hint = 'Your wallet setup is incomplete. Use /start to continue.';
        }

        return ctx.reply(hint);
      }

      const network = record.network as 'mainnet' | 'testnet';
      const contractPrincipal = record.contractAddress;

      console.log(`[Wallet] Fetching contract info for ${contractPrincipal} on ${network}`);

      const [stxBalance, tokenBalances, contractInfo] = await Promise.all([
        HiroService.getStxBalance(contractPrincipal, network),
        HiroService.getTokenBalances(contractPrincipal, network),
        HiroService.getContractInfo(contractPrincipal, network),
      ]);

      const limits = await walletManager.getRemainingLimits(String(userId)).catch(() => null);
      const withdrawal = OnboardingDatabase.loadWithdrawalAddress(userId);
      const history = walletManager.getOperationHistory(String(userId), 5) as any[];

      // Build balances text with human-readable formatting
      const balancesLines = ['\n\n*💰 Contract Balances:*'];
      
      if (stxBalance !== null) {
        balancesLines.push(`  • STX: ${formatSTX(stxBalance)}`);
      } else {
        balancesLines.push('  • STX: Error fetching');
      }
      
      tokenBalances.forEach(t => {
        balancesLines.push(`  • ${t.symbol}: ${formatSTX(t.balance)}`);
      });

      if (tokenBalances.length === 0 && stxBalance === 0) {
        balancesLines.push('  _No funds in contract_');
      }

      const balancesText = balancesLines.join('\n');

      // Build contract info text
      const contractDetails = contractInfo
        ? `\n\n*📄 Contract Info:*\n` +
          `  • Deployed: ${new Date(contractInfo.deploy_block_time * 1000).toLocaleString('pt-BR')}\n` +
          `  • Transactions: ${contractInfo.tx_count}`
        : '';

      // Build history text with human-readable amounts
      const historyText = history.length > 0
        ? '\n\n*Recent operations:*\n' +
          history.map(h => {
            const amount = Number(h.amount) / STX_DECIMALS;
            return `  • ${h.action} → ${h.protocol} — ${formatSTX(amount)}`;
          }).join('\n')
        : '';

      // Build limits text
      const limitsText = limits
        ? `\n\n*📊 Daily Limits*\n` +
          `  • Max per tx: ${formatSTX(Number(limits.maxPerTx) / STX_DECIMALS)}\n` +
          `  • Available today: ${formatSTX(Number(limits.remainingToday) / STX_DECIMALS)}`
        : '';

      await ctx.reply(
        `💼 *Your Wallet*\n\n` +
        `📋 *Contract address*\n` +
        `\`${contractPrincipal}\`\n` +
        `Network: ${record.network}  ${record.isActive ? '🟢 Active' : '🔴 Paused'}` +
        balancesText +
        contractDetails +
        limitsText +
        `\n\n💸 *Withdrawal address*\n` +
        `${withdrawal ? `\`${withdrawal}\`` : '_Not set — use /setwallet_'}\n` +
        `🔍 [View on Explorer](${EXPLORER_URL}/address/${contractPrincipal})` +
        historyText,
        { parse_mode: 'Markdown' },
      );
    } catch (error: any) {
      console.error('[Onboarding] Error in /wallet:', error);
      await ctx.reply(`❌ Error fetching wallet info. Please try again later.`);
    }
  });

  // --------------------------------------------------------------------------
  // /txs - Exibe transações recentes
  // --------------------------------------------------------------------------
  bot.command('txs', async (ctx) => {
    const userId = ctx.from!.id;

    try {
      const walletManager = await getWalletManager();
      const record = walletManager.getCachedWallet(String(userId));

      if (!record) {
        return ctx.reply('No wallet found.');
      }

      const network = record.network as 'mainnet' | 'testnet';
      const transactions = await HiroService.getRecentTransactions(record.contractAddress, network);

      await ctx.reply(
        `📋 *Recent Transactions*\n\n${transactions}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[Wallet] Error fetching transactions:', error);
      await ctx.reply('Error fetching transactions.');
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  OnboardingDatabase.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  OnboardingDatabase.close();
  process.exit(0);
});

function next(): unknown {
  throw new Error('Function not implemented.');
}
