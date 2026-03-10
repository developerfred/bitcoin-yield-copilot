import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { X402Client, X402PaymentRequest } from '../client';
import { STACKS_TESTNET } from '@stacks/network';

vi.mock('@stacks/network');
vi.mock('@stacks/transactions');
vi.mock('../../config', () => ({
  config: {
    x402: {
      facilitatorUrl: 'https://x402-test.aibtc.com',
    },
    stacks: {
      network: 'testnet',
      apiUrl: 'https://api.testnet.hiro.so',
    },
    erc8004: {
      contract: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE',
    },
  },
}));

describe('X402Client', () => {
  let client: X402Client;
  let mockFetch: Mock;

  beforeEach(() => {
    client = new X402Client({
      facilitatorUrl: 'https://x402-test.aibtc.com',
      network: 'testnet',
      privateKey: 'test-private-key',
    });

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('createPaymentRequest', () => {
    it('should create a valid payment request', async () => {
      const request = await client.createPaymentRequest(
        '0.001',
        'Test payment',
        'STX',
        'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE'
      );

      expect(request).toEqual({
        scheme: 'stacks-exact',
        price: '0.001',
        network: 'stacks:testnet',
        payTo: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE',
        description: 'Test payment',
        token: 'STX',
        expiration: expect.any(Number),
      });
    });

    it('should use default recipient if not provided', async () => {
      const request = await client.createPaymentRequest('0.001', 'Test payment');
      
      expect(request.payTo).toBe('SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE');
    });
  });

  describe('verifyPayment', () => {
    it('should return verified true for successful transaction', async () => {
      const paymentRequest: X402PaymentRequest = {
        scheme: 'stacks-exact',
        price: '0.001',
        network: 'stacks:testnet',
        payTo: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE',
        description: 'Test payment',
        token: 'STX',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tx_status: 'success',
          tx_id: '0x123456',
          token_transfer: {
            amount: '1000',
            recipient_address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE',
          },
        }),
      });

      const result = await client.verifyPayment(paymentRequest, '0x123456');
      
      expect(result.verified).toBe(true);
      expect(result.details).toBeDefined();
    });

    it('should return verified false for failed transaction', async () => {
      const paymentRequest: X402PaymentRequest = {
        scheme: 'stacks-exact',
        price: '0.001',
        network: 'stacks:testnet',
        payTo: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE',
        description: 'Test payment',
        token: 'STX',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tx_status: 'abort_by_response',
          tx_id: '0x123456',
        }),
      });

      const result = await client.verifyPayment(paymentRequest, '0x123456');
      
      expect(result.verified).toBe(false);
    });

    it('should return verified false for network error', async () => {
      const paymentRequest: X402PaymentRequest = {
        scheme: 'stacks-exact',
        price: '0.001',
        network: 'stacks:testnet',
        payTo: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE',
        description: 'Test payment',
        token: 'STX',
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.verifyPayment(paymentRequest, '0x123456');
      
      expect(result.verified).toBe(false);
    });
  });

  describe('consumePaidEndpoint', () => {
    it('should handle 402 response and retry with payment', async () => {
      const mockPaymentResponse = {
        paymentId: 'pay_123',
        transactionHash: '0x123456',
        settled: false,
        amount: '0.001',
        timestamp: Date.now(),
      };

      const mockDataResponse = {
        data: 'paid content',
      };

      // First call: 402 Payment Required
      mockFetch.mockResolvedValueOnce({
        status: 402,
        ok: false,
        json: () => Promise.resolve({
          scheme: 'stacks-exact',
          price: '0.001',
          network: 'stacks:testnet',
          payTo: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE',
          description: 'Test API',
          token: 'STX',
        }),
      });

      // Mock makePayment
      vi.spyOn(client as any, 'makePayment').mockResolvedValueOnce(mockPaymentResponse);
      
      // Mock waitForConfirmation
      vi.spyOn(client as any, 'waitForConfirmation').mockResolvedValueOnce(undefined);

      // Second call: Successful with payment proof
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDataResponse),
      });

      const result = await client.consumePaidEndpoint(
        'https://api.example.com/paid',
        { retryOn402: true }
      );

      expect(result).toEqual(mockDataResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      const secondCallHeaders = mockFetch.mock.calls[1][1].headers;
      expect(secondCallHeaders['X-Payment-Proof']).toBe('0x123456');
      expect(secondCallHeaders['X-Payment-Id']).toBe('pay_123');
    });

    it('should throw error when 402 and retryOn402 is false', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 402,
        ok: false,
        json: () => Promise.resolve({
          scheme: 'stacks-exact',
          price: '0.001',
          network: 'stacks:testnet',
          payTo: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5VTE',
          description: 'Test API',
          token: 'STX',
        }),
      });

      await expect(
        client.consumePaidEndpoint('https://api.example.com/paid', { retryOn402: false })
      ).rejects.toThrow('Payment required: Test API');
    });

    it('should return data directly for non-402 responses', async () => {
      const mockData = { data: 'free content' };

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await client.consumePaidEndpoint('https://api.example.com/free');
      
      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error for other failed responses', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(
        client.consumePaidEndpoint('https://api.example.com/error')
      ).rejects.toThrow('API error: Internal Server Error');
    });
  });

  describe('createPaymentEndpoint', () => {
    it('should return 402 when no payment proof', async () => {
      const handler = vi.fn();
      const endpoint = client.createPaymentEndpoint('0.001', 'Test API', handler);

      const result = await endpoint({ headers: {} });

      expect(result.status).toBe(402);
      expect(result.headers['X-Payment-Required']).toBe('true');
      expect(result.body.scheme).toBe('stacks-exact');
      expect(result.body.price).toBe('0.001');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should verify payment and execute handler when proof is valid', async () => {
      const mockHandlerResponse = { data: 'processed' };
      const handler = vi.fn().mockResolvedValue(mockHandlerResponse);
      const endpoint = client.createPaymentEndpoint('0.001', 'Test API', handler);

      vi.spyOn(client as any, 'verifyPayment').mockResolvedValueOnce({
        verified: true,
        details: { tx_id: '0x123456' },
      });

      const result = await endpoint({
        headers: { 'x-payment-proof': '0x123456' },
      });

      expect(result).toBe(mockHandlerResponse);
      expect(handler).toHaveBeenCalledWith({
        headers: { 'x-payment-proof': '0x123456' },
      });
    });

    it('should return 402 with verification failed when proof is invalid', async () => {
      const handler = vi.fn();
      const endpoint = client.createPaymentEndpoint('0.001', 'Test API', handler);

      vi.spyOn(client as any, 'verifyPayment').mockResolvedValueOnce({
        verified: false,
      });

      const result = await endpoint({
        headers: { 'x-payment-proof': 'invalid-proof' },
      });

      expect(result.status).toBe(402);
      expect(result.headers['X-Payment-Verification']).toBe('failed');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getPaidAPYData', () => {
    it('should fetch APY data with payment', async () => {
      const mockAPYData = {
        apy: 8.2,
        tvl: 1000000,
        timestamp: Date.now(),
        source: 'zest',
      };

      vi.spyOn(client as any, 'consumePaidEndpoint').mockResolvedValueOnce(mockAPYData);

      const result = await client.getPaidAPYData('zest');

      expect(result).toEqual(mockAPYData);
      expect((client as any).consumePaidEndpoint).toHaveBeenCalledWith(
        'https://x402-test.aibtc.com/api/yield-data/zest',
        {
          retryOn402: true,
          headers: {
            'X-Agent-Id': 'SP000000000000000000002Q6VF78',
            'X-Protocol': 'zest',
          },
        }
      );
    });
  });

  describe('getPaidPriceData', () => {
    it('should fetch price data with payment', async () => {
      const mockPriceData = {
        sBTC: 65000,
        STX: 2.5,
        USDA: 1.0,
      };

      vi.spyOn(client as any, 'consumePaidEndpoint').mockResolvedValueOnce(mockPriceData);

      const result = await client.getPaidPriceData(['sBTC', 'STX', 'USDA']);

      expect(result).toEqual(mockPriceData);
      expect((client as any).consumePaidEndpoint).toHaveBeenCalledWith(
        'https://x402-test.aibtc.com/api/price-data',
        {
          retryOn402: true,
          headers: {
            'X-Agent-Id': 'SP000000000000000000002Q6VF78',
            'X-Tokens': 'sBTC,STX,USDA',
          },
        }
      );
    });
  });
});