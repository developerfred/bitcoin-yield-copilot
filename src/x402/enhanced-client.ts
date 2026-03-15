import { X402Client as BaseX402Client, X402PaymentRequest, X402PaymentResponse } from './client.ts';

export type PaymentToken = 'STX' | 'sBTC' | 'USDCx';

export interface PaymentStream {
  id: string;
  sender: string;
  recipient: string;
  amountPerSecond: bigint;
  token: PaymentToken;
  startedAt: number;
  duration: number;
  active: boolean;
}

export interface EscrowPayment {
  id: string;
  sender: string;
  recipient: string;
  amount: bigint;
  token: PaymentToken;
  conditions: PaymentCondition[];
  status: 'pending' | 'locked' | 'released' | 'refunded';
  createdAt: number;
  releasedAt?: number;
}

export interface PaymentCondition {
  type: 'time' | 'callback' | 'onchain-event';
  payload: string;
  fulfilled: boolean;
}

export interface StreamingPaymentConfig {
  recipient: string;
  amountPerSecond: bigint;
  token: PaymentToken;
  duration: number;
}

export interface EscrowPaymentConfig {
  recipient: string;
  amount: bigint;
  token: PaymentToken;
  conditions: PaymentCondition[];
}

export class EnhancedX402Client extends BaseX402Client {
  private streams: Map<string, PaymentStream> = new Map();
  private escrows: Map<string, EscrowPayment> = new Map();

  async createPaymentStream(config: StreamingPaymentConfig): Promise<PaymentStream> {
    const stream: PaymentStream = {
      id: this.generateId(),
      sender: '',
      recipient: config.recipient,
      amountPerSecond: config.amountPerSecond,
      token: config.token,
      startedAt: Date.now(),
      duration: config.duration,
      active: true,
    };

    this.streams.set(stream.id, stream);
    return stream;
  }

  async stopPaymentStream(streamId: string): Promise<boolean> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return false;
    }

    stream.active = false;
    this.streams.set(streamId, stream);
    return true;
  }

  async getPaymentStream(streamId: string): Promise<PaymentStream | null> {
    return this.streams.get(streamId) || null;
  }

  async getActiveStreams(sender?: string): Promise<PaymentStream[]> {
    const allStreams = Array.from(this.streams.values());
    
    if (sender) {
      return allStreams.filter(s => s.active && s.sender === sender);
    }
    
    return allStreams.filter(s => s.active);
  }

  async createEscrow(config: EscrowPaymentConfig): Promise<EscrowPayment> {
    const escrow: EscrowPayment = {
      id: this.generateId(),
      sender: '',
      recipient: config.recipient,
      amount: config.amount,
      token: config.token,
      conditions: config.conditions,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.escrows.set(escrow.id, escrow);
    return escrow;
  }

  async lockEscrow(escrowId: string): Promise<boolean> {
    const escrow = this.escrows.get(escrowId);
    if (!escrow || escrow.status !== 'pending') {
      return false;
    }

    escrow.status = 'locked';
    this.escrows.set(escrowId, escrow);
    return true;
  }

  async releaseEscrow(escrowId: string): Promise<boolean> {
    const escrow = this.escrows.get(escrowId);
    if (!escrow || escrow.status !== 'locked') {
      return false;
    }

    const allFulfilled = escrow.conditions.every(c => c.fulfilled);
    if (!allFulfilled) {
      return false;
    }

    escrow.status = 'released';
    escrow.releasedAt = Date.now();
    this.escrows.set(escrowId, escrow);
    return true;
  }

  async refundEscrow(escrowId: string): Promise<boolean> {
    const escrow = this.escrows.get(escrowId);
    if (!escrow || escrow.status === 'released') {
      return false;
    }

    escrow.status = 'refunded';
    this.escrows.set(escrowId, escrow);
    return true;
  }

  async fulfillCondition(escrowId: string, conditionIndex: number): Promise<boolean> {
    const escrow = this.escrows.get(escrowId);
    if (!escrow || escrow.status !== 'locked') {
      return false;
    }

    if (conditionIndex >= escrow.conditions.length) {
      return false;
    }

    escrow.conditions[conditionIndex].fulfilled = true;
    this.escrows.set(escrowId, escrow);
    return true;
  }

  async getEscrow(escrowId: string): Promise<EscrowPayment | null> {
    return this.escrows.get(escrowId) || null;
  }

  async getEscrowsBySender(sender: string): Promise<EscrowPayment[]> {
    return Array.from(this.escrows.values()).filter(e => e.sender === sender);
  }

  async getPendingEscrows(): Promise<EscrowPayment[]> {
    return Array.from(this.escrows.values()).filter(e => e.status === 'pending');
  }

  async payMolbot(
    molbotAddress: string,
    serviceType: string,
    amount: bigint,
    token: PaymentToken
  ): Promise<X402PaymentResponse> {
    const paymentRequest = await this.createPaymentRequest(
      amount.toString(),
      `Molbot service: ${serviceType}`,
      token,
      molbotAddress
    );

    const payment = await this.makePayment(paymentRequest);
    return payment;
  }

  async verifyPaymentByProof(_proof: string): Promise<boolean> {
    return true;
  }

  calculateStreamCost(amountPerSecond: bigint, durationSeconds: number): bigint {
    return amountPerSecond * BigInt(durationSeconds);
  }

  calculateEscrowFee(amount: bigint, feePercent: number): bigint {
    return (amount * BigInt(Math.floor(feePercent * 100))) / 10000n;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

export function createX402Endpoint<TInput, TOutput>(
  options: {
    price: bigint;
    token: PaymentToken;
    description: string;
    handler: (input: TInput) => Promise<TOutput>;
  }
) {
  return async (input: TInput, paymentProof?: string) => {
    if (!paymentProof) {
      const request = await new EnhancedX402Client().createPaymentRequest(
        options.price.toString(),
        options.description,
        options.token
      );
      
      throw new X402PaymentRequired(request);
    }

    const verified = await new EnhancedX402Client().verifyPaymentByProof(paymentProof);
    if (!verified) {
      throw new Error('Payment verification failed');
    }

    return options.handler(input);
  };
}

export class X402PaymentRequired extends Error {
  constructor(public readonly paymentRequest: X402PaymentRequest) {
    super('Payment required');
    this.name = 'X402PaymentRequired';
  }
}

export const enhancedX402Client = new EnhancedX402Client();
