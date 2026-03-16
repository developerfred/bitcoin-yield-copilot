import { describe, it, expect } from 'vitest';
import { X402Client } from '../client.js';

describe('X402Client', () => {
  describe('instantiation', () => {
    it('should create instance', () => {
      const client = new X402Client();
      expect(client).toBeDefined();
    });

    it('should create instance with custom options', () => {
      const client = new X402Client({
        facilitatorUrl: 'https://test.com',
        network: 'testnet',
        privateKey: 'test-key'
      });
      expect(client).toBeDefined();
    });
  });

  describe('createPaymentRequest', () => {
    it('should have createPaymentRequest method', () => {
      const client = new X402Client();
      expect(typeof client.createPaymentRequest).toBe('function');
    });
  });

  describe('makePayment', () => {
    it('should have makePayment method', () => {
      const client = new X402Client();
      expect(typeof client.makePayment).toBe('function');
    });
  });

  describe('verifyPayment', () => {
    it('should have verifyPayment method', () => {
      const client = new X402Client();
      expect(typeof client.verifyPayment).toBe('function');
    });
  });

  describe('consumePaidEndpoint', () => {
    it('should have consumePaidEndpoint method', () => {
      const client = new X402Client();
      expect(typeof (client as any).consumePaidEndpoint).toBe('function');
    });
  });

  describe('createPaymentEndpoint', () => {
    it('should have createPaymentEndpoint method', () => {
      const client = new X402Client();
      expect(typeof client.createPaymentEndpoint).toBe('function');
    });
  });

  describe('getPaidAPYData', () => {
    it('should have getPaidAPYData method', () => {
      const client = new X402Client();
      expect(typeof client.getPaidAPYData).toBe('function');
    });
  });

  describe('getPaidPriceData', () => {
    it('should have getPaidPriceData method', () => {
      const client = new X402Client();
      expect(typeof client.getPaidPriceData).toBe('function');
    });
  });
});
