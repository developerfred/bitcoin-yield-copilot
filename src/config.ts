import { z } from 'zod';

const envSchema = z.object({
  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  // Stacks
  AGENT_STACKS_PRIVATE_KEY: z.string().min(1),
  STACKS_NETWORK: z.enum(['mainnet', 'testnet', 'devnet']).default('mainnet'),

  // MCP Server
  AIBTC_MCP_SERVER_PATH: z.string().default('./node_modules/.bin/aibtc-mcp'),

  // x402
  X402_FACILITATOR_URL: z.string().url().default('https://x402.aibtc.com'),

  // ERC-8004
  AGENT_IDENTITY_CONTRACT: z.string().optional(),

  // Database
  DATABASE_PATH: z.string().default('./data/agent.db'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  },
  stacks: {
    privateKey: process.env.AGENT_STACKS_PRIVATE_KEY ?? '',
    network: (process.env.STACKS_NETWORK ?? 'mainnet') as 'mainnet' | 'testnet' | 'devnet',
  },
  mcp: {
    serverPath: process.env.AIBTC_MCP_SERVER_PATH ?? './node_modules/.bin/aibtc-mcp',
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
