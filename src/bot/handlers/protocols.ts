import { Bot, Context, InlineKeyboard } from 'grammy';
import { getWalletManager, ProtocolConfig } from '../wallet/WalletManager.js';

export function registerProtocolHandlers(bot: Bot<Context>) {
  
  // ========================================================================
  // COMMAND /addwithdraw - Add withdrawal protocol
  // ========================================================================
  
  bot.command('addwithdraw', async (ctx) => {
    const userId = String(ctx.from!.id);
    
    const walletManager = await getWalletManager();
    const wallet = walletManager.getCachedWallet(userId);
    
    if (!wallet) {
      return ctx.reply(
        `❌ *No wallet found*\n\n` +
        `Use /start to create a wallet first.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // First, check if contract is initialized
    const statusMsg = await ctx.reply(
      `🔍 *Checking contract status...*\n\n` +
      `Wallet: \`${wallet.contractAddress}\``,
      { parse_mode: 'Markdown' }
    );
    
    try {
      const isInitialized = await walletManager.isContractInitialized(userId);
      
      if (!isInitialized) {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMsg.message_id,
          `⚠️ *Contract not initialized*\n\n` +
          `The contract needs to be initialized before adding protocols.\n\n` +
          `🔄 Initializing contract automatically...`,
          { parse_mode: 'Markdown' }
        );
        
        await walletManager.initializeContractForUser(userId);
        
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMsg.message_id,
          `✅ *Contract initialized successfully!*\n\n` +
          `Now we can add the withdrawal protocol.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMsg.message_id,
          `✅ *Contract is already initialized*\n\n` +
          `Proceeding with withdrawal activation...`,
          { parse_mode: 'Markdown' }
        );
      }
      
      // IMPORTANTE: Usar o endereço do contrato como protocolo de saque
      const withdrawProtocolAddress = wallet.contractAddress;
      
      // Verificar se o protocolo de saque já está ativo
      let withdrawActive = false;
      try {
        const existing = await walletManager.getProtocolConfig(userId, withdrawProtocolAddress);
        withdrawActive = !!existing;
      } catch (error) {
        withdrawActive = false;
      }
      
      if (withdrawActive) {
        return ctx.reply(
          `✅ *Protocolo de saque já está ativo!*\n\n` +
          `Sua carteira: \`${wallet.contractAddress}\`\n` +
          `Use /withdraw para sacar STX.`,
          { parse_mode: 'Markdown' }
        );
      }
      
      // Confirmation buttons
      const keyboard = new InlineKeyboard()
        .text('✅ Yes, activate withdraw', 'withdraw:activate')
        .text('❌ No, cancel', 'withdraw:cancel');
      
      await ctx.reply(
        `💸 *Activate Withdraw Protocol*\n\n` +
        `This will allow you to withdraw STX from your wallet.\n\n` +
        `*Details:*\n` +
        `• Protocol address: \`${withdrawProtocolAddress}\`\n` +
        `• Limit: 1000 STX\n` +
        `• Your wallet: \`${wallet.contractAddress}\`\n\n` +
        `Do you want to activate withdraw?`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      
    } catch (error: any) {
      console.error('[AddWithdraw] Error:', error);
      await ctx.reply(
        `❌ *Error processing*\n\n${error.message}`,
        { parse_mode: 'Markdown' }
      );
    }
  });
  
  // ========================================================================
  // CALLBACK - Ativar withdraw
  // ========================================================================
  
  bot.callbackQuery('withdraw:activate', async (ctx) => {
    const userId = String(ctx.from.id);
    
    await ctx.answerCallbackQuery({ text: 'Ativando saque...' });
    await ctx.editMessageText('⏳ Enviando transação para a blockchain...');
    
    try {
      const walletManager = await getWalletManager();
      const wallet = walletManager.getCachedWallet(userId);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Verificar novamente se o contrato está inicializado
      const isInitialized = await walletManager.isContractInitialized(userId);
      if (!isInitialized) {
        await ctx.editMessageText(
          `⚠️ *Contrato não inicializado*\n\n` +
          `Tente novamente com /addwithdraw`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Usar o endereço do contrato como protocolo de saque
      const withdrawProtocolAddress = wallet.contractAddress;
      
      console.log(`[Withdraw] Ativando saque para usuário ${userId} com protocolo ${withdrawProtocolAddress}`);
      
      const txId = await walletManager.addProtocol(
        userId,
        {
          address: withdrawProtocolAddress,
          name: 'Withdraw',
          maxAlloc: 1_000_000_000n // 1000 STX
        },
        20 // expiry blocks
      );
      
      console.log(`[Withdraw] Transação enviada: ${txId}`);
      
      const explorerUrl = wallet.network === 'mainnet'
        ? `https://explorer.hiro.so/txid/${txId}`
        : `https://explorer.hiro.so/txid/${txId}?chain=testnet`;
      
      await ctx.editMessageText(
        `✅ *Saque Ativado com Sucesso!*\n\n` +
        `Agora você pode sacar STX usando:\n` +
        `\`/withdraw <quantidade>\`\n\n` +
        `*Exemplo:* \`/withdraw 10\`\n\n` +
        `🔗 *Transação:* \`${txId}\`\n` +
        `[Ver no Explorador](${explorerUrl})`,
        {
          parse_mode: 'Markdown'
        }
      );
      
    } catch (error: any) {
      console.error('[Withdraw] Error activating:', error);
      
      let errorMessage = error.message || 'Unknown error';
      
      if (errorMessage.includes('412')) {
        errorMessage = 'Protocolo de saque já está ativo na sua carteira.';
      } else if (errorMessage.includes('401')) {
        errorMessage = 'Não autorizado. Tente novamente.';
      } else if (errorMessage.includes('404')) {
        errorMessage = 'Transação expirou. Tente novamente.';
      } else if (errorMessage.includes('408')) {
        errorMessage = 'Contrato não inicializado. Use /addwithdraw novamente.';
      }
      
      await ctx.editMessageText(
        `❌ *Error Activating Withdraw*\n\n` +
        `Error: ${errorMessage}\n\n` +
        `Tente novamente com /addwithdraw`,
        { parse_mode: 'Markdown' }
      );
    }
  });
  
  // ========================================================================
  // CALLBACK - Cancelar
  // ========================================================================
  
  bot.callbackQuery('withdraw:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Cancelado' });
    await ctx.editMessageText('❌ Ativação de saque cancelada.');
  });
  
  // ========================================================================
  // COMANDO /protocols - Versão melhorada
  // ========================================================================
  
  bot.command('protocols', async (ctx) => {
    const userId = String(ctx.from!.id);
    
    const walletManager = await getWalletManager();
    const wallet = walletManager.getCachedWallet(userId);
    
    if (!wallet) {
      return ctx.reply(
        `❌ *Nenhuma carteira encontrada*\n\n` +
        `Use /start para criar uma carteira primeiro.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // Verificar se o contrato está inicializado
    const isInitialized = await walletManager.isContractInitialized(userId);
    
    let message = `🔌 *Protocolos Disponíveis*\n\n`;
    message += `Carteira: \`${wallet.contractAddress}\`\n`;
    message += `Status: ${isInitialized ? '✅ Inicializado' : '❌ Não inicializado'}\n\n`;
    
    if (!isInitialized) {
      message += `⚠️ *O contrato precisa ser inicializado*\n\n`;
      message += `Use /addwithdraw to initialize and activate withdraw automatically.\n\n`;
    }
    
    // Usar o endereço do contrato para verificar withdraw
    const withdrawProtocolAddress = wallet.contractAddress;
    
    // Verificar se withdraw está ativo
    let withdrawActive = false;
    try {
      const existing = await walletManager.getProtocolConfig(userId, withdrawProtocolAddress);
      withdrawActive = !!existing;
    } catch (error) {
      withdrawActive = false;
    }
    
    message += withdrawActive 
      ? `✅ *Withdraw* (Saque) - **ATIVO**\n   Use /withdraw para sacar STX\n`
      : `📋 *Withdraw* - **Available**\n   Use /addwithdraw to activate\n`;
    
    // Verificar outros protocolos (opcional)
    const otherProtocols = [
      { name: 'ALEX', env: process.env.ALEX_CONTRACT },
      { name: 'Zest', env: process.env.ZEST_CONTRACT },
      { name: 'Hermetica', env: process.env.HERMETICA_CONTRACT },
      { name: 'Bitflow', env: process.env.BITFLOW_CONTRACT },
    ];
    
    for (const p of otherProtocols) {
      if (p.env) {
        try {
          const existing = await walletManager.getProtocolConfig(userId, p.env);
          message += existing 
            ? `✅ *${p.name}* - Ativo\n`
            : `📋 *${p.name}* - Disponível\n`;
        } catch {
          message += `📋 *${p.name}* - Disponível\n`;
        }
      }
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  });
  
  // ========================================================================
  // COMANDO /botinfo - Para debug (opcional)
  // ========================================================================
  
  bot.command('botinfo', async (ctx) => {
    const walletManager = await getWalletManager();
    const botAddress = walletManager.getBotAddress();
    
    await ctx.reply(
      `🤖 *Informações do Bot*\n\n` +
      `Endereço do Bot (deployer): \`${botAddress}\`\n` +
      `Endereço do seu contrato: \`${(await walletManager.getCachedWallet(String(ctx.from!.id)))?.contractAddress || 'N/A'}\`\n\n` +
      `Para saques, usamos o endereço do seu contrato como protocolo.`,
      { parse_mode: 'Markdown' }
    );
  });
}