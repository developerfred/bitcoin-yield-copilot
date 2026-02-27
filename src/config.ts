import { z } from 'zod';

const envSchema = z.object({
  // Anthropic / OpenRouter
  ANTHROPIC_API_KEY: z.string().min(1),
  LLM_PROVIDER: z.enum(['anthropic', 'openrouter']).default('anthropic'),
  OPENROUTER_API_KEY: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  // Stacks Network
  STACKS_NETWORK: z.enum(['mainnet', 'testnet', 'devnet']).default('testnet'),
  STACKS_API_URL: z.string().url().default('https://stacks-node-api.testnet.alexlab.co'),

  // Wallet Connection (for redirect URL)
  APP_DOMAIN: z.string().url().default('https://bitcoin-yield.com'),
  APP_NAME: z.string().default('Bitcoin Yield Copilot'),

  // MCP Server
  AIBTC_MCP_SERVER_PATH: z.string().default('./node_modules/.bin/aibtc-mcp'),
  AIBTC_MCP_NETWORK: z.enum(['mainnet', 'testnet', 'devnet']).default('testnet'),

  // x402
  X402_FACILITATOR_URL: z.string().url().default('https://x402.aibtc.com'),

  // ERC-8004
  AGENT_IDENTITY_CONTRACT: z.string().optional(),

  // Database
  DATABASE_PATH: z.string().default('./data/agent.db'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Session
  SESSION_DURATION_MS: z.coerce.number().default(30 * 60 * 1000), // 30 minutes
});

export const config = {
  llm: {
    provider: (process.env.LLM_PROVIDER as 'anthropic' | 'openrouter') || 'anthropic',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  },
  stacks: {
    network: (process.env.STACKS_NETWORK ?? 'testnet') as 'mainnet' | 'testnet' | 'devnet',
    apiUrl: process.env.STACKS_API_URL ?? 'https://stacks-node-api.testnet.alexlab.co',
  },
  wallet: {
    appDomain: process.env.APP_DOMAIN ?? 'https://bitcoin-yield.com',
    appName: process.env.APP_NAME ?? 'Bitcoin Yield Copilot',
  },
  mcp: {
    serverPath: process.env.AIBTC_MCP_SERVER_PATH ?? './node_modules/.bin/aibtc-mcp',
    network: (process.env.AIBTC_MCP_NETWORK ?? 'testnet') as 'mainnet' | 'testnet' | 'devnet',
  },
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? 'https://x402.aibtc.com',
  },
  erc8004: {
    contract: process.env.AGENT_IDENTITY_CONTRACT,
  },
  database: {
    path: process.env.DATABASE_PATH ?? './data/agent.db',
  },
  session: {
    durationMs: parseInt(process.env.SESSION_DURATION_MS ?? '1800000', 10),
  },
  log: {
    level: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
};

// Validate at startup
try {
  envSchema.parse(process.env);
} catch (error) {
  console.error('Invalid environment configuration:', error);
  process.exit(1);
}
