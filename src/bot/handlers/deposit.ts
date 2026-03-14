import { Bot, Context } from 'grammy';
import { getWalletManager } from '../wallet/WalletManager.js';
import Database from 'better-sqlite3';

// Constants
const STX_DECIMALS = 1_000_000;

// Database interface
interface WithdrawalAddressRow {
  stacks_address: string;
}

// Singleton for database connection
let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH ?? './data/copilot.db';
    dbInstance = new Database(dbPath);
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS withdrawal_addresses (
        telegram_id    TEXT PRIMARY KEY,
        stacks_address TEXT NOT NULL,
        updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
  }
  return dbInstance;
}

// Function to load withdrawal address from database
function loadWithdrawalAddress(telegramId: number): string | null {
  try {
    const db = getDb();
    
    const row = db
      .prepare('SELECT stacks_address FROM withdrawal_addresses WHERE telegram_id = ?')
      .get(String(telegramId)) as WithdrawalAddressRow | undefined;
    
    return row?.stacks_address ?? null;
  } catch (error) {
    console.error('[Withdraw] Error loading withdrawal address:', error);
    return null;
  }
}

// Function to validate Stacks address (permissive version)
function validateStacksAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  address = address.trim();
  
  // Check prefix (SP, SM, ST, SN)
  if (!/^(SP|SM|ST|SN)/.test(address)) return false;
  
  // Check if remaining contains only valid characters (base58-check)
  const validChars = /^[A-HJ-NP-Za-km-z1-9]+$/;
  const body = address.slice(2); // Remove prefix
  
  // Addresses can have between 28 and 40 characters
  if (body.length < 28 || body.length > 40) return false;
  
  return validChars.test(body);
}

export function registerDepositHandlers(bot: Bot<Context>) {
  
  // Deposit command (simulated - deposit is done by sending tokens to contract)
  bot.command('deposit', async (ctx) => {
    const userId = ctx.from!.id;
    const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
    
    // Format: /deposit <amount> <token>
    // Example: /deposit 10 STX
    
    if (args.length < 2) {
      return ctx.reply(
        `❌ *Invalid format*\n\n` +
        `Usage: \`/deposit <amount> <token>\`\n` +
        `Example: \`/deposit 10 STX\`\n\n` +
        `Available tokens: STX, sBTC`,
        { parse_mode: 'Markdown' }
      );
    }
    
    const amount = parseFloat(args[0]);
    const token = args[1].toUpperCase();
    
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ Please enter a valid positive amount.');
    }
    
    if (token !== 'STX' && token !== 'SBTC') {
      return ctx.reply('❌ Only STX and sBTC are supported for deposits.');
    }
    
    const walletManager = await getWalletManager();
    const wallet = walletManager.getCachedWallet(String(userId));
    
    if (!wallet) {
      return ctx.reply('❌ No wallet found. Use /start to create one first.');
    }
    
    // Para STX: instruções de depósito
    if (token === 'STX') {
      await ctx.reply(
        `📥 *Deposit Instructions*\n\n` +
        `To deposit ${amount} STX into your contract wallet:\n\n` +
        `1️⃣ Send exactly ${amount} STX to:\n` +
        `\`${wallet.contractAddress}\`\n\n` +
        `2️⃣ Wait for 1-2 block confirmations\n` +
        `3️⃣ Use /wallet to check your balance\n\n` +
        `⚠️ *Important:* Always send STX directly to this address. ` +
        `Do not send through any exchange or intermediary.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // Para sBTC: instruções (pode precisar de swap via ALEX)
    if (token === 'SBTC') {
      await ctx.reply(
        `📥 *sBTC Deposit Instructions*\n\n` +
        `To deposit sBTC into your contract wallet:\n\n` +
        `1️⃣ First, swap BTC to sBTC on ALEX\n` +
        `2️⃣ Send sBTC to:\n` +
        `\`${wallet.contractAddress}\`\n\n` +
        `Or use /alex to swap directly within the bot.`,
        { parse_mode: 'Markdown' }
      );
    }
  });
  
  // NOTE: Callback handlers for withdraw:(confirm|cancel) are registered
  // in withdraw.ts via registerWithdrawHandler() using walletManager.withdrawStx()
}
