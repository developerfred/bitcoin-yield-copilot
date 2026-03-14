import { z } from 'zod';

const envSchema = z.object({
  // Skip validation flag
  SKIP_CONFIG_VALIDATION: z.string().optional(),

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

  // Molbot Contracts
  MOLBOT_REGISTRY_ADDRESS: z.string().optional(),
  MOLBOT_PAYMENT_ADDRESS: z.string().optional(),

  // Database
  DATABASE_PATH: z.string().default('./data/agent.db'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Encryption
  ENCRYPTION_KEY: z.string().min(32).default('default-encryption-key-must-be-32-chars'),
  KEY_DERIVATION_SALT: z.string().min(16).default('default-key-salt'),
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
    miniAppUrl: process.env.MINI_APP_URL ?? '',
  },
  mcp: {
    serverPath: process.env.AIBTC_MCP_SERVER_PATH ?? './node_modules/.bin/aibtc-mcp-server',
    network: (process.env.AIBTC_MCP_NETWORK ?? 'testnet') as 'mainnet' | 'testnet' | 'devnet',
    useDocker: process.env.MCP_USE_DOCKER === 'true',
    dockerContainer: process.env.MCP_DOCKER_CONTAINER ?? 'aibtc-mcp-server',
  },
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? 'https://x402.aibtc.com',
  },
  erc8004: {
    contract: process.env.AGENT_IDENTITY_CONTRACT,
  },
  molbot: {
    registryAddress: process.env.MOLBOT_REGISTRY_ADDRESS,
    paymentAddress: process.env.MOLBOT_PAYMENT_ADDRESS,
  },
  database: {
    path: process.env.DATABASE_PATH ?? './data/agent.db',
  },
  session: {
    durationMs: parseInt(process.env.SESSION_DURATION_MS ?? '1800000', 10),
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY ?? 'default-encryption-key-must-be-32-chars',
    salt: process.env.KEY_DERIVATION_SALT ?? 'default-key-salt',
  },
  log: {
    level: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
  skipValidation: process.env.SKIP_CONFIG_VALIDATION === 'true',
};

if (!config.skipValidation) {
  try {
    envSchema.parse(process.env);
  } catch (error) {
    console.error('Invalid environment configuration:', error);
    process.exit(1);
  }
}
