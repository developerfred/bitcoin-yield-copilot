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
  
  // Comando para sacar - VERSÃO COM LÓGICA REAL
  bot.command('withdraw', async (ctx) => {
    try {
      console.log('[Withdraw] /withdraw command called');
      
      const userId = ctx.from!.id;
      const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
      
      console.log('[Withdraw] args:', args);
      
      // Formato: /withdraw <amount> <token> [address]
      // Exemplo: /withdraw 5 STX SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G
      // Se address não for fornecido, usa o salvo com /setwallet
      
      if (args.length < 2) {
        return ctx.reply(
          `❌ *Invalid format*\n\n` +
          `Usage: \`/withdraw <amount> <token> [address]\`\n` +
          `Examples:\n` +
          `• \`/withdraw 5 STX\` (uses your saved withdrawal address)\n` +
          `• \`/withdraw 5 STX SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G\`\n\n` +
          `Set a default address with /setwallet`,
          { parse_mode: 'Markdown' }
        );
      }
      
      const amount = parseFloat(args[0]);
      const token = args[1].toUpperCase();
      
      console.log('[Withdraw] amount:', amount, 'token:', token);
      
      // Verificar se tem endereço nos argumentos ou usar o salvo
      let destination: string | null = null;
      
      if (args.length >= 3) {
        destination = args[2];
        console.log('[Withdraw] Using address from args:', destination);
      } else {
        // Tentar carregar do banco de dados
        console.log('[Withdraw] Loading withdrawal address from DB...');
        destination = loadWithdrawalAddress(userId);
        console.log('[Withdraw] Loaded destination:', destination);
        
        if (!destination) {
          console.log('[Withdraw] No withdrawal address found in DB');
          return ctx.reply(
            `❌ *No withdrawal address set*\n\n` +
            `Please provide an address or set a default with:\n` +
            `\`/setwallet <your-stacks-address>\``,
            { parse_mode: 'Markdown' }
          );
        }
      }
      
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('❌ Please enter a valid positive amount.');
      }
      
      if (token !== 'STX') {
        return ctx.reply('❌ Only STX withdrawals are supported directly. For sBTC, use /alex to swap first.');
      }
      
      // Validar endereço Stacks
      if (!validateStacksAddress(destination)) {
        console.log(`[Withdraw] Invalid address: ${destination}`);
        return ctx.reply(
          `❌ *Invalid Stacks address*\n\n` +
          `A valid address starts with SP, SM, ST, or SN.\n` +
          `Example: \`ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD\``,
          { parse_mode: 'Markdown' }
        );
      }
      
      console.log('[Withdraw] Getting wallet manager...');
      const walletManager = await getWalletManager();
      const wallet = walletManager.getCachedWallet(String(userId));
      
      if (!wallet) {
        console.log('[Withdraw] No wallet found for user:', userId);
        return ctx.reply('❌ No wallet found. Use /start to create one first.');
      }
      
      console.log('[Withdraw] Wallet found, checking limits...');
      // Verificar limites
      const limits = await walletManager.getRemainingLimits(String(userId));
      if (!limits) {
        return ctx.reply('❌ Could not fetch wallet limits.');
      }
      
      const amountMicro = BigInt(Math.round(amount * STX_DECIMALS));
      
      if (amountMicro > limits.remainingToday) {
        return ctx.reply(
          `❌ *Daily limit exceeded*\n\n` +
          `Available today: ${Number(limits.remainingToday) / STX_DECIMALS} STX\n` +
          `Requested: ${amount} STX`,
          { parse_mode: 'Markdown' }
        );
      }
      
      if (amountMicro > limits.maxPerTx) {
        return ctx.reply(
          `❌ *Transaction limit exceeded*\n\n` +
          `Max per transaction: ${Number(limits.maxPerTx) / STX_DECIMALS} STX\n` +
          `Requested: ${amount} STX`,
          { parse_mode: 'Markdown' }
        );
      }
      
      // Verificar saldo STX no contrato via Hiro API
      try {
        // Import dinâmico para evitar dependência circular
        const { HiroService } = require('./onboarding');
        const stxBalance = await HiroService.getStxBalance(wallet.contractAddress, wallet.network as 'mainnet' | 'testnet');
        
        if (stxBalance !== null && stxBalance < amount) {
          return ctx.reply(
            `❌ *Insufficient balance*\n\n` +
            `Contract STX balance: ${stxBalance.toFixed(6)} STX\n` +
            `Requested: ${amount} STX`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('[Withdraw] Error checking balance:', error);
        // Continua mesmo sem conseguir verificar o saldo, o contrato vai rejeitar se não tiver saldo
      }
      
      // Confirmar saque - Agora usando o protocolo especial "withdraw"
      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Confirm Withdraw', callback_data: `withdraw:confirm:${amount}:${destination}` }],
          [{ text: '❌ Cancel', callback_data: 'withdraw:cancel' }]
        ]
      };
      
      console.log('[Withdraw] Sending confirmation message...');
      await ctx.reply(
        `⚠️ *Confirm Withdrawal*\n\n` +
        `Amount: ${amount} STX\n` +
        `To: \`${destination}\`\n\n` +
        `This will execute a transaction on the Stacks blockchain.`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
      
      console.log('[Withdraw] /withdraw command completed successfully');
    } catch (error) {
      console.error('[Withdraw] Error in /withdraw command:', error);
      try {
        await ctx.reply('❌ An error occurred while processing your withdrawal request. Please try again later.');
      } catch (replyError) {
        console.error('[Withdraw] Error sending error reply:', replyError);
      }
    }
  });
  
  // NOTE: Callback handlers for withdraw:(confirm|cancel) are registered
  // in withdraw.ts via registerWithdrawHandler() using walletManager.withdrawStx()
}
