import { Bot, Context, InlineKeyboard } from 'grammy';
import { MolbotClient } from '../../molbot/client.ts';
import { SUBSCRIPTION_PLANS, revenueManager } from '../../agent/revenue.ts';

const molbotClient = new MolbotClient();

export function registerMarketplaceHandlers(bot: Bot<Context>) {
  bot.command('marketplace', handleMarketplace);
  bot.command('hire', handleHire);
  bot.command('my-molbot', handleMyMolbot);
  bot.command('register-molbot', handleRegisterMolbot);
  bot.command('subscription', handleSubscription);
}

async function handleMarketplace(ctx: Context) {
  let message = `🤖 *Molbot Marketplace*\n\n`;
  message += `Specialized AI agents you can hire:\n\n`;
  message += `*Yield Strategist*\n`;
  message += `Advanced yield optimization strategies\n`;
  message += `💰 1000 STX per call\n\n`;
  message += `*Content Generator*\n`;
  message += `Create content about your portfolio\n`;
  message += `💰 500 STX per call\n\n`;
  message += `*Data Analyst*\n`;
  message += `Deep dive into DeFi data\n`;
  message += `💰 2000 STX per call\n\n`;
  message += `Use /hire <service> to hire a molbot`;

  const keyboard = new InlineKeyboard()
    .text('💼 Hire Yield Strategist', 'hire_yield-optimizer')
    .row()
    .text('📝 Hire Content Generator', 'hire_content-generator')
    .row()
    .text('📊 Hire Data Analyst', 'hire_data-analyst');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

async function handleHire(ctx: Context) {
  const args = ctx.message?.text?.split(' ');
  const serviceType = args?.[1];

  if (!serviceType) {
    return ctx.reply(
      `Usage: /hire <service>\n\n` +
      `Available services:\n` +
      `• yield-optimizer\n` +
      `• content-generator\n` +
      `• data-analyst`,
      { parse_mode: 'Markdown' }
    );
  }

  const servicePrices: Record<string, string> = {
    'yield-optimizer': '1000',
    'content-generator': '500',
    'data-analyst': '2000',
  };

  const price = servicePrices[serviceType];

  if (!price) {
    return ctx.reply(`Unknown service: ${serviceType}`);
  }

  let message = `💼 *Hiring ${serviceType}*\n\n`;
  message += `Price: ${price} STX\n\n`;
  message += `This will connect you with the molbot for a single task.\n`;
  message += `The payment will be processed via x402.`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleMyMolbot(ctx: Context) {
  let message = `🤖 *Your Molbot Services*\n\n`;
  message += `You haven't registered any molbot services yet.\n\n`;
  message += `Use /register-molbot to offer your services to others.`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleRegisterMolbot(ctx: Context) {
  let message = `📝 *Register as a Molbot*\n\n`;
  message += `To register your AI agent as a molbot:\n\n`;
  message += `1. Define your service capabilities\n`;
  message += `2. Set your price per call\n`;
  message += `3. Choose payment token (STX, sBTC, USDCx)\n\n`;
  message += `Use /subscription to see available plans.`;

  const keyboard = new InlineKeyboard()
    .text('Start Registration', 'start_register_molbot');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

async function handleSubscription(ctx: Context) {
  let message = `💎 *Subscription Plans*\n\n`;
  message += `Choose a plan for premium features:\n\n`;

  for (const plan of SUBSCRIPTION_PLANS) {
    const price = plan.monthlyRate === 0n ? 'Free' : `${plan.monthlyRate} STX/mo`;
    message += `*${plan.name}* - ${price}\n`;
    message += `${plan.features.join(', ')}\n\n`;
  }

  const keyboard = new InlineKeyboard()
    .text('Subscribe to Pro', 'subscribe_pro')
    .text('Subscribe to Enterprise', 'subscribe_enterprise');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function getMarketplaceSummary(): Promise<string> {
  let message = `🎯 *Top Molbots*\n\n`;
  
  message += `*Yield Strategist*\n`;
  message += `⭐ 4.8/5 (120 calls)\n`;
  message += `💰 1000 STX\n\n`;
  
  message += `*Content Generator*\n`;
  message += `⭐ 4.5/5 (85 calls)\n`;
  message += `💰 500 STX\n\n`;

  return message;
}
