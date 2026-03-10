import { describe, it, expect, vi } from 'vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe('Environment Schema', () => {
    it('should have valid config structure', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test123');
      vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
      
      const { config } = await import('../src/config');
      
      expect(config.llm).toBeDefined();
      expect(config.telegram).toBeDefined();
      expect(config.stacks).toBeDefined();
      expect(config.wallet).toBeDefined();
      expect(config.mcp).toBeDefined();
      expect(config.database).toBeDefined();
      expect(config.log).toBeDefined();
    });

    it('should default to anthropic provider', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test123');
      vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
      
      const { config } = await import('../src/config');
      
      expect(config.llm.provider).toBe('anthropic');
    });

    it('should default to testnet network', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test123');
      vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
      
      const { config } = await import('../src/config');
      
      expect(config.stacks.network).toBe('testnet');
    });

    it('should use mainnet when specified', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test123');
      vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
      vi.stubEnv('STACKS_NETWORK', 'mainnet');
      
      const { config } = await import('../src/config');
      
      expect(config.stacks.network).toBe('mainnet');
    });

    it('should have wallet config', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test123');
      vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
      vi.stubEnv('APP_DOMAIN', 'https://test.com');
      vi.stubEnv('APP_NAME', 'Test App');
      
      const { config } = await import('../src/config');
      
      expect(config.wallet.appDomain).toBe('https://test.com');
      expect(config.wallet.appName).toBe('Test App');
    });

    it('should have session config', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test123');
      vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
      vi.stubEnv('SESSION_DURATION_MS', '600000');
      
      const { config } = await import('../src/config');
      
      expect(config.session.durationMs).toBe(600000);
    });
  });
});
