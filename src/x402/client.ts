import { config } from '../config';
import { createNetwork, STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from '@stacks/network';
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  standardPrincipalCV,
} from '@stacks/transactions';

export interface X402PaymentRequest {
  scheme: string;
  price: string;
  network: string;
  payTo: string;
  description: string;
  token?: 'STX' | 'sBTC' | 'USDCx';
  expiration?: number;
}

export interface X402PaymentResponse {
  paymentId: string;
  transactionHash: string;
  settled: boolean;
  amount: string;
  timestamp: number;
}

export class X402Client {
  private readonly facilitatorUrl: string;
  private readonly network: 'mainnet' | 'testnet' | 'devnet';
  private readonly privateKey: string;

  constructor(options?: {
    facilitatorUrl?: string;
    network?: 'mainnet' | 'testnet' | 'devnet';
    privateKey?: string;
  }) {
    this.facilitatorUrl = options?.facilitatorUrl || config.x402.facilitatorUrl;
    this.network = options?.network || config.stacks.network;
    this.privateKey = options?.privateKey || process.env.AGENT_STACKS_PRIVATE_KEY || '';
  }

  async createPaymentRequest(
    amount: string,
    description: string,
    token: 'STX' | 'sBTC' | 'USDCx' = 'STX',
    recipient?: string
  ): Promise<X402PaymentRequest> {
    const payTo = recipient || config.erc8004.contract || '';
    
    return {
      scheme: 'stacks-exact',
      price: amount,
      network: `stacks:${this.network}`,
      payTo,
      description,
      token,
      expiration: Date.now() + 300000,
    };
  }

  async verifyPayment(
    paymentRequest: X402PaymentRequest,
    transactionHash: string
  ): Promise<{ verified: boolean; details?: any }> {
    try {
      const network = this.getNetwork();
      const tx = await fetch(
        `${network.coreApiUrl}/extended/v1/tx/${transactionHash}`
      ).then(res => res.json()) as any;

      if (!tx || tx.tx_status !== 'success') {
        return { verified: false };
      }

      const isCorrectAmount = this.checkAmount(tx, paymentRequest);
      const isCorrectRecipient = this.checkRecipient(tx, paymentRequest);
      const isWithinExpiry = paymentRequest.expiration 
        ? Date.now() < paymentRequest.expiration 
        : true;

      return {
        verified: isCorrectAmount && isCorrectRecipient && isWithinExpiry,
        details: tx,
      };
    } catch (error) {
      console.error('Payment verification failed:', error);
      return { verified: false };
    }
  }

  async makePayment(
    paymentRequest: X402PaymentRequest,
    options?: { memo?: string; fee?: bigint }
  ): Promise<X402PaymentResponse> {
    if (!this.privateKey) {
      throw new Error('AGENT_STACKS_PRIVATE_KEY is required for payments');
    }

    const network = this.getNetwork();
    const amount = BigInt(Math.floor(parseFloat(paymentRequest.price) * 1000000));
    
    const txOptions = {
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: options?.fee || 1000n,
      nonce: await this.getNonce(),
    };

    const tx = await makeContractCall({
      ...txOptions,
      contractAddress: paymentRequest.payTo.split('.')[0],
      contractName: paymentRequest.payTo.split('.')[1] || '',
      functionName: 'transfer',
      functionArgs: [
        uintCV(Number(amount)),
        standardPrincipalCV(this.getAgentAddress()),
        standardPrincipalCV(paymentRequest.payTo),
      ],
      senderKey: this.privateKey,
    });

    const result = await broadcastTransaction({ transaction: tx });
    
    if (!result || (result as any).error) {
      throw new Error(`Payment failed: ${(result as any)?.error || 'Unknown error'}`);
    }

    return {
      paymentId: this.generatePaymentId(),
      transactionHash: result.txid,
      settled: false,
      amount: paymentRequest.price,
      timestamp: Date.now(),
    };
  }

  async consumePaidEndpoint<T>(
    url: string,
    options?: {
      headers?: Record<string, string>;
      timeout?: number;
      retryOn402?: boolean;
    }
  ): Promise<T> {
    const response = await fetch(url, {
      headers: options?.headers,
      signal: options?.timeout 
        ? AbortSignal.timeout(options.timeout) 
        : undefined,
    });

    if (response.status === 402) {
      const paymentRequest = await response.json() as X402PaymentRequest;
      
      if (!options?.retryOn402) {
        throw new Error(`Payment required: ${paymentRequest.description}`);
      }

      const paymentResponse = await this.makePayment(paymentRequest);
      
      await this.waitForConfirmation(paymentResponse.transactionHash);
      
      const retryResponse = await fetch(url, {
        headers: {
          ...options?.headers,
          'X-Payment-Proof': paymentResponse.transactionHash,
          'X-Payment-Id': paymentResponse.paymentId,
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`Payment failed or insufficient: ${retryResponse.statusText}`);
      }

      return retryResponse.json() as T;
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json() as T;
  }

  createPaymentEndpoint(
    price: string,
    description: string,
    handler: (req: any) => Promise<any>
  ) {
    return async (req: any) => {
      const paymentProof = req.headers['x-payment-proof'] as string;
      
      if (!paymentProof) {
        const paymentRequest = await this.createPaymentRequest(
          price,
          description,
          'STX'
        );
        
        return {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Required': 'true',
          },
          body: paymentRequest,
        };
      }

      const paymentRequest = await this.createPaymentRequest(price, description, 'STX');
      const verification = await this.verifyPayment(paymentRequest, paymentProof);
      
      if (!verification.verified) {
        return {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Required': 'true',
            'X-Payment-Verification': 'failed',
          },
          body: paymentRequest,
        };
      }

      return handler(req);
    };
  }

  async getPaidAPYData(protocol: 'zest' | 'alex' | 'hermetica' | 'bitflow'): Promise<{
    apy: number;
    tvl: number;
    timestamp: number;
    source: string;
  }> {
    const endpoint = `${this.facilitatorUrl}/api/yield-data/${protocol}`;
    
    return this.consumePaidEndpoint(endpoint, {
      retryOn402: true,
      headers: {
        'X-Agent-Id': this.getAgentAddress(),
        'X-Protocol': protocol,
      },
    });
  }

  async getPaidPriceData(tokens: string[]): Promise<Record<string, number>> {
    const endpoint = `${this.facilitatorUrl}/api/price-data`;
    
    return this.consumePaidEndpoint(endpoint, {
      retryOn402: true,
      headers: {
        'X-Agent-Id': this.getAgentAddress(),
        'X-Tokens': tokens.join(','),
      },
    });
  }

  private getNetwork(): any {
    const apiUrl = this.network === 'mainnet' 
      ? 'https://api.mainnet.hiro.so' 
      : 'https://api.testnet.hiro.so';
    return this.network === 'mainnet' 
      ? createNetwork(STACKS_MAINNET, apiUrl)
      : createNetwork(STACKS_TESTNET, apiUrl);
  }

  private getAgentAddress(): string {
    return 'SP000000000000000000002Q6VF78';
  }

  private async getNonce(): Promise<number> {
    const network = this.getNetwork();
    const address = this.getAgentAddress();
    
    const response = await fetch(
      `${network.coreApiUrl}/v2/accounts/${address}`
    );
    const account = await response.json() as any;
    
    return account.nonce || 0;
  }

  private checkAmount(tx: any, paymentRequest: X402PaymentRequest): boolean {
    return true;
  }

  private checkRecipient(tx: any, paymentRequest: X402PaymentRequest): boolean {
    return true;
  }

  private generatePaymentId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async waitForConfirmation(txHash: string, timeout = 60000): Promise<void> {
    const start = Date.now();
    const network = this.getNetwork();
    
    while (Date.now() - start < timeout) {
      const response = await fetch(
        `${network.coreApiUrl}/extended/v1/tx/${txHash}`
      );
      const tx = await response.json() as any;
      
      if (tx.tx_status === 'success') {
        return;
      }
      
      if (tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition') {
        throw new Error(`Transaction failed: ${tx.tx_status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Transaction confirmation timeout');
  }
}

export const x402Client = new X402Client();