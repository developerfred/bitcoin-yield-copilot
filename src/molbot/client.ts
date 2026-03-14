import { callContract, ContractCallResult, Network } from '../utils/contract-call.ts';
import { config } from '../config.ts';
import type {
  MolbotInfo,
  MolbotRegistrationParams,
  MolbotUpdateParams,
  PaymentResult,
  RegistryConfig,
  PaymentToken,
} from './types.ts';

export class MolbotRegistryClient {
  private readonly config: RegistryConfig;
  private readonly registryAddress: string;

  constructor(registryConfig?: Partial<RegistryConfig>) {
    this.config = {
      registryAddress: registryConfig?.registryAddress || config.molbot?.registryAddress || '',
      paymentAddress: registryConfig?.paymentAddress || config.molbot?.paymentAddress || '',
      network: registryConfig?.network || config.stacks.network,
    };
    this.registryAddress = this.config.registryAddress;
  }

  async registerMolbot(params: MolbotRegistrationParams): Promise<ContractCallResult> {
    const { name, description, capability, pricePerCall, paymentToken } = params;

    return callContract(this.config.network as Network, this.registryAddress, 'register-molbot', [
      { type: 'string', value: name },
      { type: 'string', value: description },
      { type: 'string', value: capability },
      { type: 'uint', value: pricePerCall.toString() },
      { type: 'string', value: paymentToken },
    ]);
  }

  async updateMolbot(params: MolbotUpdateParams): Promise<ContractCallResult> {
    const updates = {
      name: params.name || '',
      description: params.description || '',
      capability: params.capability || 'custom',
      pricePerCall: params.pricePerCall || 0n,
      paymentToken: params.paymentToken || 'STX',
    };

    return callContract(this.config.network as Network, this.registryAddress, 'update-molbot', [
      { type: 'string', value: updates.name },
      { type: 'string', value: updates.description },
      { type: 'string', value: updates.capability },
      { type: 'uint', value: updates.pricePerCall.toString() },
      { type: 'string', value: updates.paymentToken },
    ]);
  }

  async setActive(active: boolean): Promise<ContractCallResult> {
    return callContract(this.config.network as Network, this.registryAddress, 'set-active', [
      { type: 'bool', value: String(active) },
    ]);
  }

  async deactivate(): Promise<ContractCallResult> {
    return callContract(this.config.network as Network, this.registryAddress, 'deactivate', []);
  }

  async reactivate(): Promise<ContractCallResult> {
    return callContract(this.config.network as Network, this.registryAddress, 'reactivate', []);
  }

  async getMolbot(address: string): Promise<MolbotInfo | null> {
    const result = await callContract(this.config.network as Network, this.registryAddress, 'get-molbot', [
      { type: 'principal', value: address },
    ]);

    if (!result.ok || !result.value) {
      return null;
    }

    const data = result.value as Record<string, unknown>;
    return {
      address,
      name: data.name as string,
      description: data.description as string,
      capability: data.capability as string,
      pricePerCall: BigInt(data['price-per-call'] as string),
      paymentToken: data['payment-token'] as PaymentToken,
      active: data.active as boolean,
      owner: data.owner as string,
      registeredAt: Number(data['registered-at']),
    };
  }

  async getMolbotPrice(address: string): Promise<bigint | null> {
    const result = await callContract(this.config.network as Network, this.registryAddress, 'get-molbot-price', [
      { type: 'principal', value: address },
    ]);

    if (!result.ok) {
      return null;
    }

    return BigInt(result.value as string);
  }

  async isRegistered(address: string): Promise<boolean> {
    const result = await callContract(this.config.network as Network, this.registryAddress, 'is-registered', [
      { type: 'principal', value: address },
    ]);

    return result.ok && result.value === true;
  }

  async isActive(address: string): Promise<boolean> {
    const result = await callContract(this.config.network as Network, this.registryAddress, 'is-active', [
      { type: 'principal', value: address },
    ]);

    return result.ok && result.value === true;
  }

  async getTotalMolbots(): Promise<number> {
    const result = await callContract(this.config.network as Network, this.registryAddress, 'get-total-molbots', []);

    if (!result.ok) {
      return 0;
    }

    return Number(result.value);
  }
}

export class MolbotPaymentClient {
  private readonly config: RegistryConfig;
  private readonly paymentAddress: string;

  constructor(paymentConfig?: Partial<RegistryConfig>) {
    this.config = {
      registryAddress: paymentConfig?.registryAddress || config.molbot?.registryAddress || '',
      paymentAddress: paymentConfig?.paymentAddress || config.molbot?.paymentAddress || '',
      network: paymentConfig?.network || config.stacks.network,
    };
    this.paymentAddress = this.config.paymentAddress;
  }

  async payMolbot(
    molbotAddress: string,
    amount: bigint,
    token: PaymentToken,
    serviceData: string
  ): Promise<PaymentResult> {
    const result = await callContract(this.config.network as Network, this.paymentAddress, 'pay-molbot', [
      { type: 'principal', value: molbotAddress },
      { type: 'uint', value: amount.toString() },
      { type: 'string', value: token },
      { type: 'buff', value: serviceData },
    ]);

    if (!result.ok) {
      throw new Error(`Payment failed: ${JSON.stringify(result)}`);
    }

    const data = result.value as Record<string, unknown>;
    return {
      paymentId: Number((data as { 'payment-id': unknown })['payment-id']),
      amount: BigInt((data as { amount: unknown }).amount as string),
    };
  }

  async getPayment(sender: string, nonce: number) {
    return callContract(this.config.network as Network, this.paymentAddress, 'get-payment', [
      { type: 'principal', value: sender },
      { type: 'uint', value: nonce.toString() },
    ]);
  }

  async getUserPaymentCount(user: string): Promise<number> {
    const result = await callContract(this.config.network as Network, this.paymentAddress, 'get-user-payment-count', [
      { type: 'principal', value: user },
    ]);

    if (!result.ok) {
      return 0;
    }

    return Number(result.value);
  }

  async getMolbotBalance(molbot: string): Promise<bigint> {
    const result = await callContract(this.config.network as Network, this.paymentAddress, 'get-molbot-balance', [
      { type: 'principal', value: molbot },
    ]);

    if (!result.ok) {
      return 0n;
    }

    return BigInt(result.value as string);
  }

  async getTotalPayments(): Promise<number> {
    const result = await callContract(this.config.network as Network, this.paymentAddress, 'get-total-payments', []);

    if (!result.ok) {
      return 0;
    }

    return Number(result.value);
  }
}

export class MolbotClient {
  readonly registry: MolbotRegistryClient;
  readonly payment: MolbotPaymentClient;

  constructor(config?: Partial<RegistryConfig>) {
    this.registry = new MolbotRegistryClient(config);
    this.payment = new MolbotPaymentClient(config);
  }

  async registerAndPay(
    registration: MolbotRegistrationParams,
    paymentAmount: bigint,
    serviceData: string
  ): Promise<{ registration: ContractCallResult; payment: PaymentResult }> {
    const registrationResult = await this.registry.registerMolbot(registration);
    
    if (!registrationResult.ok) {
      throw new Error(`Registration failed: ${JSON.stringify(registrationResult)}`);
    }

    const paymentResult = await this.payment.payMolbot(
      registrationResult.value as string || '',
      paymentAmount,
      registration.paymentToken,
      serviceData
    );

    return {
      registration: registrationResult,
      payment: paymentResult,
    };
  }
}
