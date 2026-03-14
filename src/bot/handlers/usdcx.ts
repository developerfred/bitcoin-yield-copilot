import { Bot, Context, InlineKeyboard } from 'grammy';
import { USDCxProtocol, USDCxPool } from '../../protocols/usdcx.ts';

const usdcx = new USDCxProtocol();

export function registerUSDCxHandlers(bot: Bot<Context>) {
  bot.command('usdcx', handleUSDCx);
  bot.command('usdcx-deposit', handleUSDCxDeposit);
  bot.command('usdcx-withdraw', handleUSDCxWithdraw);
  bot.command('usdcx-pools', handleUSDCxPools);
}

async function handleUSDCx(ctx: Context) {
  await ctx.reply(
    `💰 *USDCx Yield Options*\n\n` +
    `USDCx is a yield-bearing stablecoin on Stacks.\n\n` +
    `Available pools:\n` +
    `• ALEX USDCx/STX - 5.5% APY\n` +
    `• Bitflow USDCx/sBTC - 4.2% APY\n` +
    `• Hermetica USDCx - 6.1% APY\n\n` +
    `Use /usdcx-pools to see all pools\n` +
    `Use /usdcx-deposit to deposit\n` +
    `Use /usdcx-withdraw to withdraw`,
    { parse_mode: 'Markdown' }
  );
}

async function handleUSDCxPools(ctx: Context) {
  const pools = await usdcx.getPools();
  
  let message = `📊 *USDCx Pool Details*\n\n`;
  
  for (const pool of pools) {
    message += `*${pool.name}*\n`;
    message += `APY: ${pool.apy}%\n`;
    message += `TVL: $${pool.tvl.toString()}\n`;
    message += `Tokens: ${pool.token0}/${pool.token1}\n\n`;
  }
  
  message += `_Data fetched from on-chain pools_`;
  
  const keyboard = new InlineKeyboard()
    .text('📈 Deposit USDCx', 'usdcx_deposit')
    .text('📉 Withdraw USDCx', 'usdcx_withdraw');
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

async function handleUSDCxDeposit(ctx: Context) {
  const pools = await usdcx.getPools();
  
  let message = `📥 *Deposit USDCx*\n\n`;
  message += `Select a pool to deposit:\n\n`;
  
  const keyboard = new InlineKeyboard();
  
  for (const pool of pools) {
    keyboard.text(
      `${pool.name} (${pool.apy}%)`,
      `usdcx_deposit_${pool.protocol}`
    ).row();
  }
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

async function handleUSDCxWithdraw(ctx: Context) {
  let message = `📤 *Withdraw USDCx*\n\n`;
  message += `To withdraw your USDCx, please specify:\n`;
  message += `1. Amount\n`;
  message += `2. Pool\n\n`;
  message += `_Use /portfolio to see your current positions_`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function getUSDCxPoolButtons(): Promise<InlineKeyboard> {
  const pools = await usdcx.getPools();
  const keyboard = new InlineKeyboard();
  
  for (const pool of pools) {
    keyboard.text(
      `${pool.name} - ${pool.apy}% APY`,
      `usdcx_pool_${pool.protocol}`
    );
    keyboard.row();
  }
  
  return keyboard;
}

export async function formatUSDCxPoolList(): Promise<string> {
  const pools = await usdcx.getPools();
  const bestPool = usdcx.findBestPool(0n);
  
  let message = `🎯 *Top USDCx Opportunities*\n\n`;
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

export { usdcx };
