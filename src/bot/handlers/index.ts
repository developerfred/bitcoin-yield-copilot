import { Bot, Context } from 'grammy';

export function setupHandlers(bot: Bot<Context>) {
  bot.command('start', async (ctx) => {
    await ctx.reply(`👋 Welcome to Bitcoin Yield Copilot!

I help you manage your Bitcoin yield in the Stacks ecosystem using natural language.

Available commands:
/portfolio - View your yield positions
/yields - Discover current APYs
/help - Get help

Just tell me what you want to do with your Bitcoin!`);
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(`📖 Help

I can help you:
• Find the best yield opportunities
• Deposit your sBTC into yield protocols
• Withdraw your positions
• Monitor your portfolio

Just send me a message like:
• "Show me yields"
• "Put my sBTC to work"
• "What's my portfolio?"`);
  });

  bot.command('portfolio', async (ctx) => {
    await ctx.reply('📊 Portfolio\n\nConnect your wallet to see your positions.');
  });

  bot.command('yields', async (ctx) => {
    await ctx.reply('🔍 Searching for yield opportunities...');
  });

  bot.on('message:text', async (ctx) => {
    await ctx.reply('I received your message! This is the AI agent responding. More features coming soon.');
  });
}
