/**
 * Molbot Client Types
 * TypeScript types for molbot registry and payment integration
 */

export type PaymentToken = 'STX' | 'sBTC' | 'USDCx';

export type MolbotCapability = 
  | 'yield-optimizer'
  | 'content-generator'
  | 'data-analyst'
  | 'swap-executor'
  | 'arbitrage-bot'
  | 'custom';

export interface MolbotInfo {
  address: string;
  name: string;
  description: string;
  capability: string;
  pricePerCall: bigint;
  paymentToken: PaymentToken;
  active: boolean;
  owner: string;
  registeredAt: number;
}

export interface MolbotRegistrationParams {
  name: string;
  description: string;
  capability: MolbotCapability;
  pricePerCall: bigint;
  paymentToken: PaymentToken;
}

export interface MolbotUpdateParams {
  name?: string;
  description?: string;
  capability?: MolbotCapability;
  pricePerCall?: bigint;
  paymentToken?: PaymentToken;
}

export interface PaymentRequest {
  sender: string;
  recipient: string;
  amount: bigint;
  token: PaymentToken;
  serviceData: string;
  nonce: number;
}

export interface PaymentResult {
  paymentId: number;
  amount: bigint;
  txId?: string;
}

export interface MolbotTask {
  id: string;
  requester: string;
  molbotAddress: string;
  serviceType: MolbotCapability;
  inputData: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: unknown;
  createdAt: number;
  completedAt?: number;
}

export interface MolbotDiscoveryFilter {
  capability?: MolbotCapability;
  minPrice?: bigint;
  maxPrice?: bigint;
  active?: boolean;
}

export interface RegistryConfig {
  registryAddress: string;
  paymentAddress: string;
  network: 'mainnet' | 'testnet' | 'devnet';
}
