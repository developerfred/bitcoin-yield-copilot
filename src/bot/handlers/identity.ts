import { Bot, Context, InlineKeyboard } from 'grammy';
import { callContract, ContractCallResult, Network } from '../../utils/contract-call';
import { config } from '../../config';

const IDENTITY_CONTRACT = 'erc8004-identity';

export function registerIdentityHandlers(bot: Bot<Context>) {
  bot.command('identity', handleIdentity);
  bot.command('register-identity', handleRegisterIdentity);
  bot.command('my-identity', handleMyIdentity);
  bot.command('verify-identity', handleVerifyIdentity);
}

async function handleIdentity(ctx: Context) {
  await ctx.reply(
    `🔐 *ERC-8004 Identity*\n\n` +
    `Your on-chain identity for the Bitcoin Yield Copilot.\n\n` +
    `Commands:\n` +
    `/register-identity — Register your identity\n` +
    `/my-identity — View your identity\n` +
    `/verify-identity — Verify an identity\n\n` +
    `Your identity allows you to:\n` +
    `• Sign agent actions on-chain\n` +
    `• Build reputation over time\n` +
    `• Enable trustless interactions`,
    { parse_mode: 'Markdown' }
  );
}

async function handleRegisterIdentity(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text('🌾 Yield Strategist', 'identity_cap_yield-strategist')
    .row()
    .text('📊 Data Analyst', 'identity_cap_data-analyst')
    .row()
    .text('🤖 General Agent', 'identity_cap_general');

  await ctx.reply(
    `📝 *Register Your Identity*\n\n` +
    `Choose your primary capability:\n\n` +
    `🌾 *Yield Strategist* — Yield optimization\n` +
    `📊 *Data Analyst* — DeFi data analysis\n` +
    `🤖 *General Agent* — General purpose`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

async function handleMyIdentity(ctx: Context) {
  await ctx.reply(
    `👤 *My Identity*\n\n` +
    `To view your identity, please connect your wallet first.\n\n` +
    `Use /setwallet <address> to connect.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleVerifyIdentity(ctx: Context) {
  await ctx.reply(
    `✅ *Verify Identity*\n\n` +
    `To verify an identity, please provide the Stacks address.\n\n` +
    `Usage: /verify-identity <address>`,
    { parse_mode: 'Markdown' }
  );
}

export async function registerIdentity(
  walletAddress: string,
  domain: string,
  capability: string
): Promise<ContractCallResult> {
  const network = config.stacks.network as Network;
  return callContract(network, IDENTITY_CONTRACT, 'register-identity', [
    { type: 'string', value: domain },
    { type: 'list', value: [{ type: 'string', value: capability }] },
  ]);
}

export async function getIdentity(walletAddress: string): Promise<ContractCallResult> {
  const network = config.stacks.network as Network;
  return callContract(network, IDENTITY_CONTRACT, 'get-identity', [
    { type: 'principal', value: walletAddress },
  ]);
}

export async function updateIdentity(
  walletAddress: string,
  domain: string,
  capabilities: string[]
): Promise<ContractCallResult> {
  const network = config.stacks.network as Network;
  return callContract(network, IDENTITY_CONTRACT, 'update-identity', [
    { type: 'string', value: domain },
    { type: 'list', value: capabilities.map(c => ({ type: 'string', value: c })) },
  ]);
}

export async function revokeIdentity(walletAddress: string): Promise<ContractCallResult> {
  const network = config.stacks.network as Network;
  return callContract(network, IDENTITY_CONTRACT, 'revoke-identity', []);
}
