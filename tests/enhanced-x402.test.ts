import { describe, it, expect, beforeEach } from 'vitest';
import { 
  EnhancedX402Client, 
  X402PaymentRequired,
  PaymentToken 
} from '../src/x402/enhanced-client.ts';

describe('EnhancedX402Client', () => {
  let client: EnhancedX402Client;

  beforeEach(() => {
    client = new EnhancedX402Client();
  });

  describe('Payment Streams', () => {
    it('should create a payment stream', async () => {
      const stream = await client.createPaymentStream({
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        amountPerSecond: 1000n,
        token: 'STX',
        duration: 3600,
      });

      expect(stream.id).toBeDefined();
      expect(stream.recipient).toBe('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      expect(stream.amountPerSecond).toBe(1000n);
      expect(stream.active).toBe(true);
    });

    it('should stop a payment stream', async () => {
      const stream = await client.createPaymentStream({
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        amountPerSecond: 1000n,
        token: 'STX',
        duration: 3600,
      });

      const stopped = await client.stopPaymentStream(stream.id);
      expect(stopped).toBe(true);

      const updated = await client.getPaymentStream(stream.id);
      expect(updated?.active).toBe(false);
    });

    it('should return null for non-existent stream', async () => {
      const stream = await client.getPaymentStream('non-existent');
      expect(stream).toBeNull();
    });

    it('should get active streams', async () => {
      await client.createPaymentStream({
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        amountPerSecond: 1000n,
        token: 'STX',
        duration: 3600,
      });

      const streams = await client.getActiveStreams();
      expect(streams.length).toBeGreaterThan(0);
    });

    it('should calculate stream cost', () => {
      const cost = client.calculateStreamCost(1000n, 3600);
      expect(cost).toBe(3600000n);
    });
  });

  describe('Escrow Payments', () => {
    it('should create an escrow', async () => {
      const escrow = await client.createEscrow({
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        amount: 1000000n,
        token: 'STX',
        conditions: [
          { type: 'time', payload: '3600', fulfilled: false },
        ],
      });

      expect(escrow.id).toBeDefined();
      expect(escrow.amount).toBe(1000000n);
      expect(escrow.status).toBe('pending');
    });

    it('should lock escrow', async () => {
      const escrow = await client.createEscrow({
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        amount: 1000000n,
        token: 'STX',
        conditions: [],
      });

      const locked = await client.lockEscrow(escrow.id);
      expect(locked).toBe(true);

      const updated = await client.getEscrow(escrow.id);
      expect(updated?.status).toBe('locked');
    });

    it('should release escrow when conditions fulfilled', async () => {
      const escrow = await client.createEscrow({
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        amount: 1000000n,
        token: 'STX',
        conditions: [
          { type: 'time', payload: '3600', fulfilled: false },
        ],
      });

      await client.lockEscrow(escrow.id);
      await client.fulfillCondition(escrow.id, 0);
      
      const released = await client.releaseEscrow(escrow.id);
      expect(released).toBe(true);

      const updated = await client.getEscrow(escrow.id);
      expect(updated?.status).toBe('released');
    });

    it('should refund escrow', async () => {
      const escrow = await client.createEscrow({
        recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        amount: 1000000n,
        token: 'STX',
        conditions: [],
      });

      const refunded = await client.refundEscrow(escrow.id);
      expect(refunded).toBe(true);

      const updated = await client.getEscrow(escrow.id);
      expect(updated?.status).toBe('refunded');
    });

    it('should calculate escrow fee', () => {
      const fee = client.calculateEscrowFee(1000000n, 0.5);
      expect(fee).toBe(5000n);
    });
  });

  describe('X402PaymentRequired', () => {
    it('should create error with payment request', () => {
      const request = {
        scheme: 'x402',
        price: '1000',
        network: 'testnet',
        payTo: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        description: 'Test payment',
        token: 'STX' as const,
      };

      const error = new X402PaymentRequired(request);
      expect(error.name).toBe('X402PaymentRequired');
      expect(error.paymentRequest).toBe(request);
    });
  });
});

describe('PaymentToken type', () => {
  it('should accept valid tokens', () => {
    const tokens: PaymentToken[] = ['STX', 'sBTC', 'USDCx'];
    
    tokens.forEach(token => {
      expect(token).toBeDefined();
    });
  });
});
