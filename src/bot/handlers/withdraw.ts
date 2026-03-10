import { Bot, Context } from 'grammy';
import { getWalletManager } from '../wallet/WalletManager.js';
import Database from 'better-sqlite3';

const STX_DECIMALS = 1_000_000;

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

// Function to load withdrawal address (using singleton instance)
function loadWithdrawalAddress(telegramId: string): string | null {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT stacks_address FROM withdrawal_addresses WHERE telegram_id = ?')
      .get(telegramId) as { stacks_address: string } | undefined;
    
    return row?.stacks_address ?? null;
  } catch (error) {
    console.error('[Withdraw] Error loading withdrawal address:', error);
    return null;
  }
}

// Function to validate Stacks address
function validateStacksAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Trim whitespace
  address = address.trim();
  
  // Basic Stacks format validation:
  // - Must start with SP, SM (mainnet) or ST, SN (testnet)
  // - Can be an account address (28-40 alphanumeric characters)
  // - Or a contract address (account.contract-name)
  
  // First, check if starts with valid prefix
  const validPrefix = /^(SP|SM|ST|SN)/.test(address);
  if (!validPrefix) return false;
  
  // Split parts if it's a contract
  const parts = address.split('.');
  
  if (parts.length === 1) {
    // It's an account address
    // O corpo depois do prefixo deve ser alfanumérico (base58-check)
    const body = address.substring(2); // Remove os 2 primeiros caracteres (SP/SM/ST/SN)
    return /^[A-Za-z0-9]{28,40}$/.test(body);
  } 
  else if (parts.length === 2) {
    // É um endereço de contrato: "conta.nome"
    const [accountPart, contractName] = parts;
    
    // Valida a parte da conta
    if (!accountPart || !accountPart.startsWith('SP') && !accountPart.startsWith('SM') && 
        !accountPart.startsWith('ST') && !accountPart.startsWith('SN')) {
      return false;
    }
    
    const accountBody = accountPart.substring(2);
    if (!/^[A-Za-z0-9]{28,40}$/.test(accountBody)) return false;
    
    // Valida o nome do contrato (pode conter letras, números, hífen, underscore)
    return /^[a-zA-Z0-9_-]{1,128}$/.test(contractName);
  }
  
  return false;
}

// Função para obter saldo STX do contrato
async function getContractStxBalance(contractAddress: string, network: string): Promise<bigint> {
  try {
    const walletManager = await getWalletManager();
    const networkConfig = walletManager.getNetwork();
    
    const response = await fetch(
      `${networkConfig.apiUrl}/extended/v1/address/${contractAddress}/balances`
    );
    
    if (!response.ok) return 0n;
    
    const data = await response.json() as { stx: { balance: string } };
    return BigInt(data.stx?.balance || '0');
  } catch (error) {
    console.error('[Withdraw] Error fetching balance:', error);
    return 0n;
  }
}

export function registerWithdrawHandler(bot: Bot<Context>) {
  console.log('[withdraw] Registering /withdraw command handler');

  // --------------------------------------------------------------------------
  // /setwallet - Define ou mostra endereço de saque
  // --------------------------------------------------------------------------
  bot.command('setwallet', async (ctx) => {
    const userId = String(ctx.from!.id);
    const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
    const address = args[0]?.trim();

    // Se não forneceu endereço, mostra o atual
    if (!address) {
      const current = loadWithdrawalAddress(userId);
      return ctx.reply(
        `💸 *Withdrawal Address*\n\n` +
        `Current: ${current ? `\`${current}\`` : '_not set_'}\n\n` +
        `To set: \`/setwallet <your-stacks-address>\`\n` +
        `To remove: \`/removewallet\``,
        { parse_mode: 'Markdown' }
      );
    }

    // Valida o endereço
    if (!validateStacksAddress(address)) {
      return ctx.reply(
        `❌ *Invalid Stacks address*\n\n` +
        `Examples:\n` +
        `• Account: \`ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD\`\n` +
        `• Contract: \`ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD.my-contract\``,
        { parse_mode: 'Markdown' }
      );
    }

    try {
      const db = getDb();
      
      // Verifica se o usuário tem uma wallet ativa
      const walletManager = await getWalletManager();
      const record = walletManager.getCachedWallet(userId);

      // Salva o endereço
      db.prepare(`
        INSERT INTO withdrawal_addresses (telegram_id, stacks_address, updated_at)
        VALUES (?, ?, unixepoch())
        ON CONFLICT(telegram_id) DO UPDATE SET
          stacks_address = excluded.stacks_address,
          updated_at = unixepoch()
      `).run(userId, address);

      // Detecta rede do endereço
      const network = address.startsWith('ST') || address.startsWith('SN') ? 'testnet' : 'mainnet';

      await ctx.reply(
        `✅ *Withdrawal address saved!*\n\n` +
        `\`${address}\`\n` +
        `Network: ${network}\n\n` +
        `All future withdrawals will be sent here.` +
        (record ? `\n\n📋 Contract wallet: \`${record.contractAddress}\`` : ''),
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[setwallet] Error:', error);
      await ctx.reply('❌ Error saving address. Please try again.');
    }
  });

  // --------------------------------------------------------------------------
  // /removewallet - Remove endereço de saque
  // --------------------------------------------------------------------------
  bot.command('removewallet', async (ctx) => {
    const userId = String(ctx.from!.id);

    try {
      const db = getDb();
      
      // Verifica se existe
      const existing = loadWithdrawalAddress(userId);
      
      if (!existing) {
        return ctx.reply(
          `ℹ️ *No withdrawal address set*\n\n` +
          `Use /setwallet to add one first.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Remove o endereço
      db.prepare('DELETE FROM withdrawal_addresses WHERE telegram_id = ?').run(userId);

      await ctx.reply(
        `✅ *Withdrawal address removed*\n\n` +
        `Your funds will stay in your contract wallet until you set a new withdrawal address.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[removewallet] Error:', error);
      await ctx.reply('❌ Error removing address. Please try again.');
    }
  });

  // --------------------------------------------------------------------------
  // /withdraw - Inicia processo de saque
  // --------------------------------------------------------------------------

  bot.callbackQuery(/withdraw:(confirm|cancel)/, async (ctx) => {
    console.log('[DEBUG callback] ===== CALLBACK RECEIVED =====');
    console.log('[DEBUG callback] Full callback data:', ctx.callbackQuery);

    const data = ctx.callbackQuery.data;
    console.log('[DEBUG callback] Callback data string:', data);

    const parts = data.split(':');
    console.log('[DEBUG callback] Split parts:', parts);

    const action = parts[1];
    const userId = String(ctx.from.id);

    console.log('[DEBUG callback] Action:', action);
    console.log('[DEBUG callback] User ID:', userId);
    console.log('[DEBUG callback] Parts length:', parts.length);
    console.log('[DEBUG callback] All parts:', parts);

    // Cancela a operação
    if (action === 'cancel') {
      console.log('[DEBUG callback] Processing cancel');
      await ctx.answerCallbackQuery({ text: 'Withdrawal cancelled' });
      await ctx.editMessageText('❌ Withdrawal cancelled.');
      console.log('[DEBUG callback] Cancel completed');
      return;
    }

    // Confirma e executa o saque
    if (action === 'confirm') {
      console.log('[DEBUG callback] Processing confirm');

      // Pega o amount e destination dos próximos partes
      const amount = parseFloat(parts[2]);
      const destination = parts.slice(3).join(':'); // Junta caso o endereço tenha :

      console.log('[DEBUG callback] Extracted amount:', amount);
      console.log('[DEBUG callback] Extracted destination:', destination);

      if (!amount || !destination) {
        console.log('[DEBUG callback] Missing amount or destination');
        await ctx.answerCallbackQuery({ text: 'Invalid withdrawal data' });
        await ctx.editMessageText('❌ Invalid withdrawal request. Please try again.');
        return;
      }

      console.log('[DEBUG callback] Answering callback query...');
      await ctx.answerCallbackQuery({ text: 'Processing withdrawal...' });

      console.log('[DEBUG callback] Editing message...');
      await ctx.editMessageText('⏳ Broadcasting transaction to Stacks...\n\nThis may take 30-60 seconds...');

      try {
        console.log('[DEBUG callback] Getting wallet manager...');
        const walletManager = await getWalletManager();

        console.log('[DEBUG callback] Getting cached wallet...');
        const wallet = walletManager.getCachedWallet(userId);

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        console.log('[DEBUG callback] Calculating amount in microSTX...');
        const amountMicro = BigInt(Math.round(amount * STX_DECIMALS));

        console.log(`[DEBUG callback] Executing withdrawal:`, {
          userId,
          amount: amountMicro.toString(),
          destination
        });

        // Executa o saque
        console.log('[DEBUG callback] Calling withdrawStx...');
        const result = await walletManager.withdrawStx(
          userId,
          destination,
          amountMicro,
          10  // expiry blocks
        );

        console.log(`[DEBUG callback] Withdrawal result:`, result);

        const explorerBase = wallet.network === 'mainnet'
          ? 'https://explorer.hiro.so/txid'
          : 'https://explorer.hiro.so/txid?chain=testnet';

        console.log('[DEBUG callback] Sending success message');
        await ctx.editMessageText(
          `✅ *Withdrawal Initiated*\n\n` +
          `Amount: ${amount} STX\n` +
          `To: \`${destination}\`\n\n` +
          `**Authorization TX:**\n` +
          `\`${result.txIdAuth}\`\n` +
          `[View](${explorerBase}/${result.txIdAuth})\n\n` +
          `**Withdrawal TX:**\n` +
          `\`${result.txIdWithdraw}\`\n` +
          `[View](${explorerBase}/${result.txIdWithdraw})\n\n` +
          `The withdrawal will be processed in the next block.\n` +
          `Use /wallet to check your balance.`,
          { parse_mode: 'Markdown' }
        );

      } catch (error) {
        console.error('[DEBUG callback] Error:', error);

        let errorMessage = (error as Error).message || 'Unknown error';

        // Mapear erros comuns do contrato
        if (errorMessage.includes('423')) {
          errorMessage = 'Wallet não registrada no withdraw-helper.';
        } else if (errorMessage.includes('402')) {
          errorMessage = 'Assinatura inválida.';
        } else if (errorMessage.includes('403')) {
          errorMessage = 'Limite por transação excedido.';
        } else if (errorMessage.includes('419')) {
          errorMessage = 'Limite diário excedido.';
        } else if (errorMessage.includes('415')) {
          errorMessage = 'Saldo insuficiente no contrato.';
        } else if (errorMessage.includes('414')) {
          errorMessage = 'Saldo insuficiente no contrato.';
        }

        await ctx.editMessageText(
          `❌ *Withdrawal Failed*\n\n` +
          `Error: ${errorMessage}\n\n` +
          `Please try again later.`,
          { parse_mode: 'Markdown' }
        );
      }
    }

    console.log('[DEBUG callback] ===== CALLBACK COMPLETED =====');
  });


  // --------------------------------------------------------------------------
  // /txstatus - Verifica status de uma transação
  // --------------------------------------------------------------------------
  bot.command('txstatus', async (ctx) => {
    const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
    const txId = args[0];
    
    if (!txId) {
      return ctx.reply(
        `📋 *Transaction Status*\n\n` +
        `Usage: \`/txstatus <transaction-id>\`\n` +
        `Example: \`/txstatus dad7f628f982c42fdede95e722173a6b50287038128851f585e59292506fd89d\``,
        { parse_mode: 'Markdown' }
      );
    }
    
    try {
      const walletManager = await getWalletManager();
      const network = walletManager.getNetwork();
      
      const response = await fetch(`${network.apiUrl}/extended/v1/tx/${txId}`);
      if (!response.ok) {
        return ctx.reply('❌ Transaction not found.');
      }
      
      const data = await response.json() as any;
      
      let status = '⏳ Pending';
      let statusEmoji = '⏳';
      
      if (data.tx_status === 'success') {
        status = '✅ Success';
        statusEmoji = '✅';
      } else if (data.tx_status === 'abort_by_response') {
        status = '❌ Failed (Contract Error)';
        statusEmoji = '❌';
      } else if (data.tx_status === 'abort_by_post_condition') {
        status = '❌ Failed (Post-condition)';
        statusEmoji = '❌';
      }
      
      const explorerBase = network.name === 'mainnet'
        ? 'https://explorer.hiro.so/txid'
        : 'https://explorer.hiro.so/txid?chain=testnet';
      
      await ctx.reply(
        `${statusEmoji} *Transaction Status*\n\n` +
        `Status: ${status}\n` +
        `Block: ${data.block_height || 'Pending'}\n` +
        `Fee: ${(Number(data.fee_rate) / STX_DECIMALS).toFixed(6)} STX\n\n` +
        `[View on Explorer](${explorerBase}/${txId})`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[txstatus] Error:', error);
      await ctx.reply('❌ Error checking transaction.');
    }
  });
}

// Cleanup na saída da aplicação
process.on('SIGINT', () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
});

process.on('SIGTERM', () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
});