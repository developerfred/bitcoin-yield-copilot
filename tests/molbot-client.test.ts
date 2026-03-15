import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MolbotClient, MolbotRegistryClient, MolbotPaymentClient } from '../src/molbot/client.ts';
import type { MolbotRegistrationParams, RegistryConfig } from '../src/molbot/types.ts';

describe('MolbotClient Types', () => {
  it('should have correct MolbotRegistrationParams shape', () => {
    const params: MolbotRegistrationParams = {
      name: 'Test Bot',
      description: 'A test bot',
      capability: 'yield-optimizer',
      pricePerCall: 1000n,
      paymentToken: 'STX',
    };

    expect(params.name).toBe('Test Bot');
    expect(params.capability).toBe('yield-optimizer');
    expect(params.pricePerCall).toBe(1000n);
    expect(params.paymentToken).toBe('STX');
  });

  it('should support all payment tokens', () => {
    const tokens = ['STX', 'sBTC', 'USDCx'] as const;
    
    tokens.forEach(token => {
      const params: MolbotRegistrationParams = {
        name: 'Test',
        description: 'Test',
        capability: 'custom',
        pricePerCall: 1000n,
        paymentToken: token,
      };
      expect(params.paymentToken).toBe(token);
    });
  });

  it('should support all capabilities', () => {
    const capabilities = [
      'yield-optimizer',
      'content-generator',
      'data-analyst',
      'swap-executor',
      'arbitrage-bot',
      'custom',
    ] as const;

    capabilities.forEach(cap => {
      const params: MolbotRegistrationParams = {
        name: 'Test',
        description: 'Test',
        capability: cap,
        pricePerCall: 1000n,
        paymentToken: 'STX',
      };
      expect(params.capability).toBe(cap);
    });
  });
});

describe('MolbotRegistryClient', () => {
  let client: MolbotRegistryClient;

  beforeEach(() => {
    client = new MolbotRegistryClient({
      registryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.molbot-registry',
      paymentAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.molbot-payment',
      network: 'testnet',
    });
  });

  it('should initialize with correct config', () => {
    expect(client).toBeDefined();
  });

  it('should create instance with custom config', () => {
    const customClient = new MolbotRegistryClient({
      registryAddress: 'ST2CY5V39NHDPWSXMW9QDT3HC3GDDPQDQ2F00HBGC.molbot-registry',
      network: 'mainnet',
    });

    expect(customClient).toBeDefined();
  });
});

describe('MolbotPaymentClient', () => {
  let client: MolbotPaymentClient;

  beforeEach(() => {
    client = new MolbotPaymentClient({
      registryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.molbot-registry',
      paymentAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.molbot-payment',
      network: 'testnet',
    });
  });

  it('should initialize with correct config', () => {
    expect(client).toBeDefined();
  });
});

describe('MolbotClient', () => {
  let molbotClient: MolbotClient;

  beforeEach(() => {
    molbotClient = new MolbotClient({
      registryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.molbot-registry',
      paymentAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.molbot-payment',
      network: 'testnet',
    });
  });

  it('should have registry and payment clients', () => {
    expect(molbotClient.registry).toBeDefined();
    expect(molbotClient.payment).toBeDefined();
  });

  it('should expose registry methods', () => {
    expect(typeof molbotClient.registry.registerMolbot).toBe('function');
    expect(typeof molbotClient.registry.updateMolbot).toBe('function');
    expect(typeof molbotClient.registry.getMolbot).toBe('function');
    expect(typeof molbotClient.registry.isRegistered).toBe('function');
    expect(typeof molbotClient.registry.isActive).toBe('function');
    expect(typeof molbotClient.registry.getTotalMolbots).toBe('function');
  });

  it('should expose payment methods', () => {
    expect(typeof molbotClient.payment.payMolbot).toBe('function');
    expect(typeof molbotClient.payment.getPayment).toBe('function');
    expect(typeof molbotClient.payment.getUserPaymentCount).toBe('function');
    expect(typeof molbotClient.payment.getMolbotBalance).toBe('function');
    expect(typeof molbotClient.payment.getTotalPayments).toBe('function');
  });
});

describe('RegistryConfig', () => {
  it('should allow partial config with defaults', () => {
    const config: Partial<RegistryConfig> = {
      network: 'testnet',
    };

    const client = new MolbotClient(config);
    expect(client).toBeDefined();
  });

  it('should allow full config', () => {
    const config: RegistryConfig = {
      registryAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.molbot-registry',
      paymentAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.molbot-payment',
      network: 'devnet',
    };

    const client = new MolbotClient(config);
    expect(client).toBeDefined();
  });
});
