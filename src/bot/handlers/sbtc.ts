import { Bot, Context, InlineKeyboard } from 'grammy';
import { sBTCProtocol, sBTCPool, sbtcProtocol } from '../../protocols/sbtc.ts';

const sbtc = new sBTCProtocol();

export function registersBTCHandlers(bot: Bot<Context>) {
  bot.command('sbtc', handlesBTC);
  bot.command('sbtc-deposit', handlesBTCDeposit);
  bot.command('sbtc-withdraw', handlesBTCWithdraw);
  bot.command('sbtc-pools', handlesBTCPools);
}

async function handlesBTC(ctx: Context) {
  await ctx.reply(
    `₿ *sBTC Yield Options*\n\n` +
    `sBTC is a yield-bearing Bitcoin on Stacks.\n\n` +
    `Available pools:\n` +
    `• Zest sBTC Vault - 8.5% APY\n` +
    `• Hermetica sBTC - 6.1% APY\n` +
    `• ALEX sBTC/STX LP - 11.4% APY\n\n` +
    `Use /sbtc-pools to see all pools\n` +
    `Use /sbtc-deposit to deposit\n` +
    `Use /sbtc-withdraw to withdraw`,
    { parse_mode: 'Markdown' }
  );
}

async function handlesBTCPools(ctx: Context) {
  const pools = await sbtc.getPools();
  
  let message = `📊 *sBTC Pool Details*\n\n`;
  
  for (const pool of pools) {
    message += `*${pool.name}*\n`;
    message += `APY: ${pool.apy}%\n`;
    message += `TVL: $${pool.tvl.toString()}\n`;
    message += `Token: ${pool.token}\n\n`;
  }
  
  message += `_Data fetched from on-chain pools_`;
  
  const keyboard = new InlineKeyboard()
    .text('📈 Deposit sBTC', 'sbtc_deposit')
    .text('📉 Withdraw sBTC', 'sbtc_withdraw');
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

async function handlesBTCDeposit(ctx: Context) {
  const pools = await sbtc.getPools();
  
  let message = `📥 *Deposit sBTC*\n\n`;
  message += `Select a pool to deposit:\n\n`;
  
  const keyboard = new InlineKeyboard();
  
  for (const pool of pools) {
    keyboard.text(
      `${pool.name} (${pool.apy}%)`,
      `sbtc_deposit_${pool.protocol}`
    ).row();
  }
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

async function handlesBTCWithdraw(ctx: Context) {
  let message = `📤 *Withdraw sBTC*\n\n`;
  message += `To withdraw your sBTC, please specify:\n`;
  message += `1. Amount\n`;
  message += `2. Pool\n\n`;
  message += `_Use /portfolio to see your current positions_`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function getSBTCPoolButtons(): Promise<InlineKeyboard> {
  const pools = await sbtc.getPools();
  const keyboard = new InlineKeyboard();
  
  for (const pool of pools) {
    keyboard.text(
      `${pool.name} - ${pool.apy}% APY`,
      `sbtc_pool_${pool.protocol}`
    );
    keyboard.row();
  }
  
  return keyboard;
}

export async function formatSBTCPoolList(): Promise<string> {
  const pools = await sbtc.getPools();
  const bestPool = sbtc.findBestPool(0n);
  
  let message = `🎯 *Top sBTC Opportunities*\n\n`;
  message += `*Best APY:* ${bestPool.name} at ${bestPool.apy}%\n\n`;
  
  const sorted = [...pools].sort((a, b) => b.apy - a.apy);
  
  for (let i = 0; i < sorted.length; i++) {
    const pool = sorted[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    message += `${medal} *${pool.name}*\n`;
    message += `   APY: ${pool.apy}% | TVL: $${formatTVL(pool.tvl)}\n\n`;
  }
  
  return message;
}

function formatTVL(tvl: bigint): string {
  const num = Number(tvl);
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export { sbtc };
